import io
from decimal import Decimal

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile

from audit.models import AuditLog
from budgets.models import BudgetAllocation, Department


def logs(**filters):
    return AuditLog.objects.filter(**filters)


@pytest.mark.django_db
class TestAuditOnWrites:
    def test_create_update_delete_are_logged_with_actor_and_changes(self, admin_client, admin_user):
        pk = admin_client.post("/api/departments/", {"name": "Water", "code": "wtr"}, format="json").data["id"]
        created = logs(action="create", entity_type="department", entity_id=str(pk)).get()
        assert created.user == admin_user and created.username == "u_admin"
        assert created.metadata["values"]["code"] == "WTR"

        admin_client.patch(f"/api/departments/{pk}/", {"head_name": "R. Kumar"}, format="json")
        changes = logs(action="update", entity_type="department", entity_id=str(pk)).get().metadata["changes"]
        assert changes == {"head_name": {"from": "", "to": "R. Kumar"}}

        admin_client.delete(f"/api/departments/{pk}/")
        assert logs(action="delete", entity_type="department", entity_id=str(pk)).get().metadata["values"]["name"] == "Water"

    def test_noop_update_not_logged_and_failed_write_not_logged(self, admin_client, world):
        pk = world["depts"]["HLT"].pk
        admin_client.patch(f"/api/departments/{pk}/", {"name": "Health"}, format="json")
        assert not logs(action="update").exists()
        admin_client.post("/api/departments/", {"name": "X", "code": "HLT"}, format="json")  # duplicate code
        assert not logs(action="create").exists()

    def test_blocked_delete_is_not_logged(self, admin_client, world):
        assert admin_client.delete(f"/api/departments/{world['depts']['HLT'].pk}/").status_code == 409
        assert not logs(action="delete").exists()

    def test_allocation_money_change_recorded_as_strings(self, analyst_client, world):
        alloc = BudgetAllocation.objects.get(department=world["depts"]["HLT"], fiscal_year=world["fy25"])
        analyst_client.patch(f"/api/budget-allocations/{alloc.pk}/", {"allocated_amount": "450.00"}, format="json")
        entry = logs(action="update", entity_type="budgetallocation").get()
        assert entry.metadata["changes"]["allocated_amount"] == {"from": "420.00", "to": "450.00"}

    def test_user_role_change_logged_and_password_never_stored(self, admin_client, viewer_user):
        admin_client.patch(f"/api/auth/users/{viewer_user.pk}/", {"role": "analyst"}, format="json")
        entry = logs(action="update", entity_type="user").get()
        assert entry.metadata["changes"]["role"] == {"from": "viewer", "to": "analyst"}
        admin_client.post("/api/auth/register/", {"username": "pw", "password": "Str0ng-pass-123",
                                                  "password_confirm": "Str0ng-pass-123"}, format="json")
        admin_client.patch(f"/api/auth/users/{viewer_user.pk}/", {"is_active": False}, format="json")
        dumped = " ".join(str(m) for m in AuditLog.objects.values_list("metadata", flat=True))
        assert "Str0ng-pass-123" not in dumped and "pbkdf2" not in dumped

    def test_audit_failure_rolls_back_the_change(self, admin_client, monkeypatch):
        import audit.mixins as mixins

        def boom(*a, **k):
            raise RuntimeError("audit store down")

        monkeypatch.setattr(mixins, "record", boom)
        admin_client.raise_request_exception = False
        res = admin_client.post("/api/departments/", {"name": "Ghost", "code": "GHO"}, format="json")
        assert res.status_code == 500
        assert not Department.objects.filter(code="GHO").exists()

    def test_import_logged_once(self, analyst_client, world):
        csv = "department_code,fiscal_year,allocated_amount\nHLT,2025,430\nEDU,2025,425\n"
        analyst_client.post("/api/import/budgets/", {"file": SimpleUploadedFile("b.csv", csv.encode())}, format="multipart")
        entry = logs(action="import_budgets").get()
        assert entry.metadata["rows"] == 2 and entry.metadata["updated"] == 2 and entry.metadata["filename"] == "b.csv"


@pytest.mark.django_db
class TestAuditOnAuth:
    def test_register_login_logout_and_failed_login(self, anon, analyst_user):
        anon.post("/api/auth/register/", {"username": "nn", "password": "Str0ng-pass-123",
                                          "password_confirm": "Str0ng-pass-123"}, format="json")
        assert logs(action="register").get().metadata["role"] == "viewer"

        anon.post("/api/auth/login/", {"username": "u_analyst", "password": "nope"}, format="json")
        failed = logs(action="login_failed").get()
        assert failed.username == "u_analyst" and failed.user is None
        assert "nope" not in str(failed.metadata)

        tokens = anon.post("/api/auth/login/", {"username": "u_analyst", "password": "Str0ng-pass-123"}, format="json").data
        assert logs(action="login", username="u_analyst").count() == 1
        anon.credentials(HTTP_AUTHORIZATION=f"Bearer {tokens['access']}")
        anon.post("/api/auth/logout/", {"refresh": tokens["refresh"]}, format="json")
        assert logs(action="logout", username="u_analyst").count() == 1


@pytest.mark.django_db
class TestAuditTrailIntegrity:
    def test_entries_are_immutable(self, admin_user):
        from audit.services import record
        entry = record(admin_user, "x", "thing", 1)
        entry.action = "tampered"
        with pytest.raises(PermissionError):
            entry.save()
        with pytest.raises(PermissionError):
            entry.delete()
        with pytest.raises(PermissionError):
            AuditLog.objects.all().delete()
        with pytest.raises(PermissionError):
            AuditLog.objects.all().update(action="y")

    def test_username_survives_user_deletion(self, admin_user, viewer_user):
        from audit.services import record
        record(viewer_user, "x", "thing", 1)
        viewer_user.delete()
        assert logs(action="x").get().username == "u_viewer"


@pytest.mark.django_db
class TestAuditEndpoint:
    def test_admin_only(self, anon, viewer_client, analyst_client, admin_client):
        assert anon.get("/api/audit-logs/").status_code == 401
        assert viewer_client.get("/api/audit-logs/").status_code == 403
        assert analyst_client.get("/api/audit-logs/").status_code == 403
        assert admin_client.get("/api/audit-logs/").status_code == 200

    def test_no_write_methods(self, admin_client, admin_user):
        from audit.services import record
        entry = record(admin_user, "x", "thing", 1)
        assert admin_client.post("/api/audit-logs/", {"action": "forged"}, format="json").status_code == 405
        assert admin_client.patch(f"/api/audit-logs/{entry.pk}/", {"action": "forged"}, format="json").status_code == 405
        assert admin_client.delete(f"/api/audit-logs/{entry.pk}/").status_code == 405

    def test_filters(self, admin_client, world):
        admin_client.post("/api/departments/", {"name": "A", "code": "A1"}, format="json")
        admin_client.post("/api/fiscal-years/", {"year": 2040}, format="json")
        res = admin_client.get("/api/audit-logs/?entity_type=department&action=create")
        assert res.data["count"] == 1
        res = admin_client.get("/api/audit-logs/?since=2999-01-01T00:00:00Z")
        assert res.data["count"] == 0
        assert admin_client.get("/api/audit-logs/?search=u_admin").data["count"] >= 2
