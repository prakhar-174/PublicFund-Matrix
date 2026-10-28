from decimal import Decimal

import pytest

from audit.models import AuditLog
from budgets.models import Approval, BudgetAllocation, FiscalYear, OptimizationRun, RecommendedAllocation
from conftest import client_for, make_user


@pytest.fixture
def admin2_client(db):
    return client_for(make_user("admin", username="second_admin"))


def allocations(world):
    return dict(BudgetAllocation.objects.filter(fiscal_year=world["fy25"])
                .values_list("department__code", "allocated_amount"))


def save_run(client, world, **extra):
    body = {"fiscal_year": world["fy25"].pk, "save": True, **extra}
    res = client.post("/api/optimizer/", body, format="json")
    assert res.status_code == 200, res.data
    return res.data["run_id"]


@pytest.mark.django_db
class TestPersistedRuns:
    def test_preview_is_default_and_stores_nothing(self, analyst_client, world):
        res = analyst_client.post("/api/optimizer/", {"fiscal_year": world["fy25"].pk}, format="json")
        assert res.data["saved"] is False and res.data["run_id"] is None
        assert OptimizationRun.objects.count() == 0

    def test_save_stores_inputs_weights_and_recommendations(self, analyst_client, analyst_user, world):
        run_id = save_run(analyst_client, world, max_change_pct=15)
        run = OptimizationRun.objects.get(pk=run_id)
        assert run.status == "proposed" and run.created_by == analyst_user and run.solver_status == "optimal"
        assert run.model_version == "need-v1"
        assert run.objective_weights == {"performance_gap": 0.7, "historical_underfunding": 0.3}
        assert run.input_config["max_change_pct"] == 15
        recs = RecommendedAllocation.objects.filter(run=run)
        assert recs.count() == 3 and sum(r.recommended_allocation for r in recs) == run.total_budget
        assert all("human review" in r.explanation for r in recs)
        assert AuditLog.objects.filter(action="optimization_run_created", entity_id=str(run_id)).count() == 1

    def test_saving_never_touches_approved_allocations(self, analyst_client, world):
        before = allocations(world)
        save_run(analyst_client, world)
        assert allocations(world) == before

    def test_same_inputs_give_same_saved_amounts(self, analyst_client, world):
        a, b = save_run(analyst_client, world), save_run(analyst_client, world)
        amounts = lambda rid: list(RecommendedAllocation.objects.filter(run_id=rid)
                                   .order_by("department_id").values_list("recommended_allocation", flat=True))
        assert amounts(a) == amounts(b)

    def test_infeasible_run_is_not_saved(self, analyst_client, world):
        res = analyst_client.post("/api/optimizer/", {"fiscal_year": world["fy25"].pk, "total_budget": "100", "save": True},
                                  format="json")
        assert res.status_code == 422 and OptimizationRun.objects.count() == 0

    def test_list_and_detail_for_any_authenticated_user(self, analyst_client, viewer_client, anon, world):
        run_id = save_run(analyst_client, world)
        listing = viewer_client.get("/api/optimization-runs/")
        row = listing.data["results"][0]
        assert row["id"] == run_id and row["department_count"] == 3
        assert Decimal(str(row["total_baseline"])) == Decimal("1050.00")
        detail = viewer_client.get(f"/api/optimization-runs/{run_id}/").data
        assert len(detail["allocations"]) == 3 and "human review" in detail["disclaimer"]
        assert detail["allocations"][0]["change_amount"] is not None
        assert anon.get("/api/optimization-runs/").status_code == 401

    def test_filters(self, analyst_client, viewer_client, world):
        save_run(analyst_client, world)
        assert viewer_client.get(f"/api/optimization-runs/?fiscal_year={world['fy25'].pk}&status=proposed").data["count"] == 1
        assert viewer_client.get("/api/optimization-runs/?status=approved").data["count"] == 0

    def test_list_query_count_is_flat(self, analyst_client, viewer_client, world, django_assert_max_num_queries):
        for _ in range(4):
            save_run(analyst_client, world)
        with django_assert_max_num_queries(6):
            assert viewer_client.get("/api/optimization-runs/").data["count"] == 4

    def test_runs_cannot_be_modified_through_api(self, analyst_client, admin_client, world):
        run_id = save_run(analyst_client, world)
        for client in (analyst_client, admin_client):
            assert client.patch(f"/api/optimization-runs/{run_id}/", {"status": "approved"}, format="json").status_code == 405
            assert client.delete(f"/api/optimization-runs/{run_id}/").status_code == 405


@pytest.mark.django_db
class TestApproval:
    def decide(self, client, run_id, decision="approved", comments=""):
        return client.post(f"/api/optimization-runs/{run_id}/decision/",
                           {"decision": decision, "comments": comments}, format="json")

    def test_only_admin_can_decide(self, analyst_client, viewer_client, anon, world):
        run_id = save_run(analyst_client, world)
        assert self.decide(analyst_client, run_id).status_code == 403
        assert self.decide(viewer_client, run_id).status_code == 403
        assert self.decide(anon, run_id).status_code == 401
        assert Approval.objects.count() == 0 and OptimizationRun.objects.get().status == "proposed"

    def test_approval_applies_amounts_atomically_and_records_reviewer(self, analyst_client, admin_client, admin_user, world):
        run_id = save_run(analyst_client, world, max_change_pct=10)
        recs = {r.department.code: r.recommended_allocation for r in RecommendedAllocation.objects.select_related("department")}
        res = self.decide(admin_client, run_id, comments="Looks right")
        assert res.status_code == 200 and res.data["status"] == "approved"
        assert res.data["approval"]["reviewer_username"] == "u_admin"
        assert allocations(world) == recs
        for alloc in BudgetAllocation.objects.filter(fiscal_year=world["fy25"]):
            assert alloc.status == "approved" and alloc.approved_by == admin_user
        # Other years are untouched.
        assert BudgetAllocation.objects.get(department__code="HLT", fiscal_year=world["fy24"]).allocated_amount == 400

    def test_approval_is_audited_per_allocation_and_for_the_run(self, analyst_client, admin_client, world):
        run_id = save_run(analyst_client, world, max_change_pct=10)
        self.decide(admin_client, run_id)
        assert AuditLog.objects.filter(action="optimization_run_approved", entity_id=str(run_id)).count() == 1
        per_alloc = AuditLog.objects.filter(action="allocation_updated_by_approval")
        assert per_alloc.count() == 3 and all(e.metadata["run"] == run_id for e in per_alloc)

    def test_decisions_are_final(self, analyst_client, admin_client, admin2_client, world):
        run_id = save_run(analyst_client, world)
        assert self.decide(admin_client, run_id, "rejected", "No").status_code == 200
        assert self.decide(admin2_client, run_id).status_code == 409
        assert Approval.objects.count() == 1

    def test_rejection_requires_comment_and_changes_nothing(self, analyst_client, admin_client, world):
        run_id = save_run(analyst_client, world)
        before = allocations(world)
        assert self.decide(admin_client, run_id, "rejected").status_code == 400
        assert self.decide(admin_client, run_id, "rejected", "   ").status_code == 400
        res = self.decide(admin_client, run_id, "rejected", "Cuts too deep for Education")
        assert res.status_code == 200 and res.data["status"] == "rejected"
        assert allocations(world) == before
        assert not BudgetAllocation.objects.filter(approved_by__isnull=False).exists()

    def test_creator_cannot_approve_own_run(self, admin_client, world):
        run_id = save_run(admin_client, world)
        res = self.decide(admin_client, run_id)
        assert res.status_code == 403 and "cannot approve" in res.data["detail"]
        assert OptimizationRun.objects.get(pk=run_id).status == "proposed"
        # ...but a different administrator can, and the creator may withdraw by rejecting.
        assert self.decide(admin_client, run_id, "rejected", "Withdrawn").status_code == 200

    def test_separation_can_be_relaxed_by_setting(self, admin_client, world, settings):
        settings.REQUIRE_SEPARATE_REVIEWER = False
        assert self.decide(admin_client, save_run(admin_client, world), comments="solo").status_code == 200

    def test_stale_run_is_refused_with_reasons(self, analyst_client, admin_client, admin2_client, world):
        run_id = save_run(analyst_client, world)
        BudgetAllocation.objects.filter(department__code="HLT", fiscal_year=world["fy25"]).update(allocated_amount=Decimal("430"))
        res = self.decide(admin2_client, run_id)
        assert res.status_code == 409 and "stale" in res.data["detail"]
        assert any("Health" in p and "430" in p for p in res.data["problems"])
        assert OptimizationRun.objects.get(pk=run_id).status == "proposed"
        assert allocations(world)["EDU"] == 420  # nothing partially applied

    def test_approving_one_run_makes_a_competing_run_stale(self, analyst_client, admin_client, admin2_client, world):
        first = save_run(analyst_client, world, max_change_pct=10)
        second = save_run(analyst_client, world, max_change_pct=20)
        assert self.decide(admin_client, first).status_code == 200
        assert self.decide(admin2_client, second).status_code == 409

    def test_new_department_after_run_makes_it_stale(self, analyst_client, admin_client, world):
        from budgets.models import Department
        run_id = save_run(analyst_client, world)
        BudgetAllocation.objects.create(department=Department.objects.create(name="New", code="NEW"),
                                        fiscal_year=world["fy25"], allocated_amount=Decimal("5"))
        res = self.decide(admin_client, run_id)
        assert res.status_code == 409 and any("gained an allocation" in p for p in res.data["problems"])

    def test_total_exceeding_fiscal_year_envelope_is_refused(self, analyst_client, admin_client, world):
        FiscalYear.objects.filter(pk=world["fy25"].pk).update(total_budget=Decimal("1040"))  # run totals 1050
        res = self.decide(admin_client, save_run(analyst_client, world))
        assert res.status_code == 409 and "exceeds" in res.data["detail"]
        assert allocations(world)["HLT"] == 420

    def test_approvals_list(self, analyst_client, admin_client, viewer_client, world):
        run_id = save_run(analyst_client, world)
        self.decide(admin_client, run_id, "rejected", "No")
        res = viewer_client.get("/api/approvals/?decision=rejected")
        assert res.data["count"] == 1 and res.data["results"][0]["comments"] == "No"
        assert viewer_client.get("/api/approvals/?decision=approved").data["count"] == 0
        assert viewer_client.post("/api/approvals/", {}, format="json").status_code == 405

    def test_invalid_payload_and_unknown_run(self, admin_client, world):
        assert self.decide(admin_client, 99999).status_code == 404
        assert admin_client.post("/api/optimization-runs/1/decision/", {"decision": "maybe"}, format="json").status_code == 400
