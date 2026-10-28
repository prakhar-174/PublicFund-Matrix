from decimal import Decimal

import pytest

from budgets.models import BudgetAllocation, Department, FiscalYear


@pytest.mark.django_db
class TestHealth:
    def test_health_is_public(self, anon):
        res = anon.get("/api/health/")
        assert res.status_code == 200 and res.data["status"] == "ok"


@pytest.mark.django_db
class TestAuthRequired:
    @pytest.mark.parametrize("path", [
        "/api/departments/", "/api/fiscal-years/", "/api/budget-allocations/",
        "/api/performance-metrics/", "/api/analytics/",
    ])
    def test_endpoints_reject_anonymous(self, anon, path):
        assert anon.get(path).status_code == 401


@pytest.mark.django_db
class TestDepartments:
    def test_admin_crud(self, admin_client):
        res = admin_client.post("/api/departments/", {"name": "Water", "code": "wtr"}, format="json")
        assert res.status_code == 201 and res.data["code"] == "WTR"
        pk = res.data["id"]
        assert admin_client.patch(f"/api/departments/{pk}/", {"head_name": "X"}, format="json").status_code == 200
        assert admin_client.delete(f"/api/departments/{pk}/").status_code == 204

    def test_duplicate_code_rejected(self, admin_client, world):
        res = admin_client.post("/api/departments/", {"name": "Other", "code": "HLT"}, format="json")
        assert res.status_code == 400

    def test_non_admins_cannot_write(self, analyst_client, viewer_client, world):
        for client in (analyst_client, viewer_client):
            assert client.post("/api/departments/", {"name": "W", "code": "W"}, format="json").status_code == 403
        assert viewer_client.get("/api/departments/").status_code == 200

    def test_delete_blocked_when_budget_history_exists(self, admin_client, world):
        pk = world["depts"]["HLT"].pk
        res = admin_client.delete(f"/api/departments/{pk}/")
        assert res.status_code == 409
        assert Department.objects.filter(pk=pk).exists()

    def test_budget_history_action(self, viewer_client, world):
        res = viewer_client.get(f"/api/departments/{world['depts']['HLT'].pk}/budget_history/")
        assert res.status_code == 200
        assert [h["fiscal_year_label"] for h in res.data["history"]] == ["FY 2024-25", "FY 2025-26"]

    def test_search_and_pagination(self, viewer_client, world):
        assert viewer_client.get("/api/departments/?search=heal").data["count"] == 1
        res = viewer_client.get("/api/departments/?page_size=2")
        assert res.data["count"] == 3 and "results" in res.data


@pytest.mark.django_db
class TestFiscalYears:
    def test_summary_aggregates_in_db(self, viewer_client, world):
        res = viewer_client.get(f"/api/fiscal-years/{world['fy25'].pk}/summary/")
        assert res.status_code == 200
        assert Decimal(str(res.data["total_allocated"])) == Decimal("1050")
        assert Decimal(str(res.data["total_spent"])) == Decimal("900")
        assert res.data["department_count"] == 3
        assert Decimal(str(res.data["unallocated_budget"])) == Decimal("50")
        assert res.data["utilization_rate"] == pytest.approx(900 / 1050)

    def test_summary_of_empty_year_has_undefined_utilization(self, admin_client):
        fy = FiscalYear.objects.create(year=2030)
        res = admin_client.get(f"/api/fiscal-years/{fy.pk}/summary/")
        assert res.data["utilization_rate"] is None and res.data["department_count"] == 0

    def test_label_uses_indian_fy_format(self, world):
        assert world["fy25"].label == "FY 2025-26"


@pytest.mark.django_db
class TestAllocations:
    def payload(self, world, **extra):
        return {"department": world["depts"]["HLT"].pk, "fiscal_year": FiscalYear.objects.create(year=2031).pk,
                "allocated_amount": "100.00", "spent_amount": "10.00", "requested_amount": "120.00", **extra}

    def test_analyst_creates_draft_with_nested_output(self, analyst_client, world):
        res = analyst_client.post("/api/budget-allocations/", self.payload(world), format="json")
        assert res.status_code == 201
        assert res.data["department_name"] == "Health" and res.data["fiscal_year_label"] == "FY 2031-32"
        assert Decimal(res.data["unspent_amount"]) == Decimal("90.00")
        assert res.data["status"] == "draft"

    def test_viewer_cannot_write(self, viewer_client, world):
        assert viewer_client.post("/api/budget-allocations/", self.payload(world), format="json").status_code == 403

    def test_negative_amounts_rejected(self, analyst_client, world):
        res = analyst_client.post("/api/budget-allocations/", self.payload(world, allocated_amount="-1"), format="json")
        assert res.status_code == 400

    def test_duplicate_department_year_rejected(self, analyst_client, world):
        payload = {"department": world["depts"]["HLT"].pk, "fiscal_year": world["fy25"].pk, "allocated_amount": "1"}
        assert analyst_client.post("/api/budget-allocations/", payload, format="json").status_code == 400

    def test_only_admin_can_approve_and_approver_is_recorded(self, analyst_client, admin_client, admin_user, world):
        alloc = BudgetAllocation.objects.get(department=world["depts"]["HLT"], fiscal_year=world["fy25"])
        url = f"/api/budget-allocations/{alloc.pk}/"
        assert analyst_client.patch(url, {"status": "approved"}, format="json").status_code == 400
        res = admin_client.patch(url, {"status": "approved", "approved_by": 999}, format="json")
        assert res.status_code == 200
        alloc.refresh_from_db()
        assert alloc.status == "approved" and alloc.approved_by == admin_user  # client-supplied approver ignored

    def test_filters_and_ordering(self, viewer_client, world):
        res = viewer_client.get(f"/api/budget-allocations/?fiscal_year={world['fy25'].pk}&ordering=-allocated_amount")
        amounts = [Decimal(r["allocated_amount"]) for r in res.data["results"]]
        assert amounts == sorted(amounts, reverse=True) and len(amounts) == 3
        res = viewer_client.get(f"/api/budget-allocations/?department={world['depts']['ENV'].pk}")
        assert res.data["count"] == 2
        assert viewer_client.get("/api/budget-allocations/?status=approved").data["count"] == 0
        assert viewer_client.get("/api/budget-allocations/?ordering=spent_amount").status_code == 200

    def test_list_avoids_n_plus_one(self, viewer_client, world, django_assert_max_num_queries):
        with django_assert_max_num_queries(6):  # auth + count + page; not one query per row
            assert viewer_client.get("/api/budget-allocations/").status_code == 200

    def test_utilization_undefined_for_zero_allocation(self, world):
        alloc = BudgetAllocation.objects.create(
            department=Department.objects.create(name="Zero", code="ZRO"), fiscal_year=world["fy25"],
            allocated_amount=Decimal("0"), spent_amount=Decimal("0"))
        assert alloc.utilization_rate is None
