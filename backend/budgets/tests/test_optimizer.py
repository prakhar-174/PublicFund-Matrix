from decimal import Decimal

import pytest

from budgets.models import BudgetAllocation, Department, FiscalYear, PerformanceMetric
from budgets.services.optimizer import BudgetOptimizer, OptimizationError


def total(rows, key="recommended_allocation"):
    return sum((r[key] for r in rows), Decimal("0"))


def by_name(rows):
    return {r["department_name"]: r for r in rows}


@pytest.mark.django_db
class TestRecommendations:
    def test_sums_exactly_to_budget(self, world):
        rows = BudgetOptimizer(max_change_pct=None).generate_recommendations(world["fy25"].pk, Decimal("1050.00"))
        assert total(rows) == Decimal("1050.00")

    def test_sums_to_budget_with_awkward_amounts(self, world):
        for budget in ("1050.01", "999.99", "1234567.89"):
            rows = BudgetOptimizer(max_change_pct=None).generate_recommendations(world["fy25"].pk, Decimal(budget))
            assert total(rows) == Decimal(budget)

    def test_defaults_to_current_total_and_is_reproducible(self, world):
        a = BudgetOptimizer().generate_recommendations(world["fy25"].pk)
        b = BudgetOptimizer().generate_recommendations(world["fy25"].pk)
        assert a == b
        assert total(a) == total(a, "current_allocation") == Decimal("1050.00")

    def test_stability_cap_respected_and_flagged(self, world):
        rows = by_name(BudgetOptimizer(max_change_pct=10).generate_recommendations(world["fy25"].pk))
        for r in rows.values():
            assert abs(r["change_percent"]) <= 10 + 1e-6
        assert any(r["bound_by_stability_cap"] for r in rows.values())

    def test_lower_performer_with_shortfall_gets_larger_share_but_no_one_zeroed(self, world):
        rows = by_name(BudgetOptimizer(max_change_pct=None).generate_recommendations(world["fy25"].pk))
        assert rows["Health"]["need_score"] > rows["Education"]["need_score"]
        assert rows["Health"]["recommended_allocation"] > rows["Education"]["recommended_allocation"]

    def test_sorted_by_change_magnitude(self, world):
        rows = BudgetOptimizer().generate_recommendations(world["fy25"].pk, Decimal("1150"))
        mags = [abs(r["change_amount"]) for r in rows]
        assert mags == sorted(mags, reverse=True)

    def test_every_row_carries_reasoning_and_disclaimer(self, world):
        for r in BudgetOptimizer().generate_recommendations(world["fy25"].pk):
            assert "human review" in r["reasoning"] and r["confidence"] in {"high", "medium", "low"}

    def test_inputs_are_not_modified(self, world):
        before = list(BudgetAllocation.objects.order_by("id").values_list("allocated_amount", "status"))
        BudgetOptimizer(max_change_pct=None).generate_recommendations(world["fy25"].pk, Decimal("2000"))
        assert before == list(BudgetAllocation.objects.order_by("id").values_list("allocated_amount", "status"))


@pytest.mark.django_db
class TestMissingData:
    def test_missing_metrics_use_neutral_value_and_lower_confidence(self, world):
        PerformanceMetric.objects.filter(department=world["depts"]["ENV"]).delete()
        rows = by_name(BudgetOptimizer(max_change_pct=None).generate_recommendations(world["fy25"].pk))
        env = rows["Environment"]
        assert env["confidence"] == "medium" and any("performance" in g for g in env["data_gaps"])
        # Median of the other two gaps (0.45, 0.20) -> 0.325; NOT a worst-case gap of 1 and NOT zero.
        known = [rows["Health"], rows["Education"]]
        assert min(k["need_score"] for k in known) <= env["need_score"] <= max(k["need_score"] for k in known) + 0.2
        assert env["recommended_allocation"] > 0

    def test_all_data_missing_splits_without_error(self, world):
        PerformanceMetric.objects.all().delete()
        BudgetAllocation.objects.update(requested_amount=0)
        rows = BudgetOptimizer(max_change_pct=None).generate_recommendations(world["fy25"].pk, Decimal("900"))
        assert {r["confidence"] for r in rows} == {"low"}
        assert total(rows) == Decimal("900.00")
        assert {r["recommended_allocation"] for r in rows} == {Decimal("300.00")}

    def test_falls_back_to_most_recent_earlier_metrics(self, world):
        PerformanceMetric.objects.filter(fiscal_year=world["fy25"]).delete()
        rows = BudgetOptimizer().generate_recommendations(world["fy25"].pk)
        # The stale score is used (not treated as low need) but is disclosed and lowers confidence.
        assert all(r["confidence"] == "medium" for r in rows)
        assert all("score taken from FY 2024-25" in r["data_gaps"][0] for r in rows)
        assert all("no performance metrics on record" not in " ".join(r["data_gaps"]) for r in rows)

    def test_low_utilization_triggers_investigation_flag(self, world):
        rows = by_name(BudgetOptimizer().generate_recommendations(world["fy25"].pk))
        assert any("Investigate" in f for f in rows["Environment"]["flags"])
        assert not rows["Education"]["flags"]


@pytest.mark.django_db
class TestConstraintsAndErrors:
    def test_infeasible_budget_too_small_is_explained_not_relaxed(self, world):
        with pytest.raises(OptimizationError, match="minimum allocations"):
            BudgetOptimizer(max_change_pct=10).generate_recommendations(world["fy25"].pk, Decimal("500"))

    def test_infeasible_budget_too_large(self, world):
        with pytest.raises(OptimizationError, match="maximum allocations"):
            BudgetOptimizer(max_change_pct=10).generate_recommendations(world["fy25"].pk, Decimal("5000"))

    def test_zero_budget(self, world):
        rows = BudgetOptimizer(max_change_pct=None).generate_recommendations(world["fy25"].pk, Decimal("0"))
        assert total(rows) == 0
        with pytest.raises(OptimizationError):
            BudgetOptimizer(max_change_pct=10).generate_recommendations(world["fy25"].pk, Decimal("0"))

    def test_negative_budget_and_cap_rejected(self, world):
        with pytest.raises(OptimizationError):
            BudgetOptimizer().generate_recommendations(world["fy25"].pk, Decimal("-1"))
        with pytest.raises(OptimizationError):
            BudgetOptimizer(max_change_pct=-5)

    def test_year_without_allocations(self, db):
        fy = FiscalYear.objects.create(year=2040)
        with pytest.raises(OptimizationError, match="No budget allocations"):
            BudgetOptimizer().generate_recommendations(fy.pk)

    def test_zero_cap_means_no_change(self, world):
        rows = BudgetOptimizer(max_change_pct=0).generate_recommendations(world["fy25"].pk)
        assert all(r["change_amount"] == 0 for r in rows)

    def test_department_with_no_current_funding_is_uncapped_above(self, world):
        new = Department.objects.create(name="New", code="NEW")
        BudgetAllocation.objects.create(department=new, fiscal_year=world["fy25"], allocated_amount=Decimal("0"),
                                        requested_amount=Decimal("100"))
        rows = by_name(BudgetOptimizer(max_change_pct=10).generate_recommendations(world["fy25"].pk, Decimal("1100")))
        assert rows["New"]["recommended_allocation"] > 0
        assert total(list(rows.values())) == Decimal("1100.00")


@pytest.mark.django_db
class TestScenarioOverrides:
    def test_override_is_honoured_and_remainder_redistributed(self, world):
        hlt = world["depts"]["HLT"].pk
        rows = by_name(BudgetOptimizer(max_change_pct=None).run_scenario(
            world["fy25"].pk, {hlt: "500.00"}, Decimal("1050")))
        assert rows["Health"]["recommended_allocation"] == Decimal("500.00") and rows["Health"]["is_override"]
        assert total(list(rows.values())) == Decimal("1050.00")

    def test_overrides_exceeding_budget_are_infeasible(self, world):
        o = {world["depts"]["HLT"].pk: "900", world["depts"]["EDU"].pk: "900"}
        with pytest.raises(OptimizationError):
            BudgetOptimizer(max_change_pct=None).run_scenario(world["fy25"].pk, o, Decimal("1050"))

    def test_all_overridden_must_match_total_exactly(self, world):
        d = world["depts"]
        ok = {d["HLT"].pk: "400", d["EDU"].pk: "400", d["ENV"].pk: "250"}
        assert total(BudgetOptimizer(max_change_pct=None).run_scenario(world["fy25"].pk, ok, Decimal("1050"))) == 1050
        with pytest.raises(OptimizationError):
            BudgetOptimizer(max_change_pct=None).run_scenario(world["fy25"].pk, ok, Decimal("1000"))

    def test_invalid_overrides(self, world):
        opt = BudgetOptimizer(max_change_pct=None)
        with pytest.raises(OptimizationError, match="no allocation"):
            opt.run_scenario(world["fy25"].pk, {99999: "10"})
        with pytest.raises(OptimizationError, match="negative"):
            opt.run_scenario(world["fy25"].pk, {world["depts"]["HLT"].pk: "-5"})
        with pytest.raises(OptimizationError, match="Invalid"):
            opt.run_scenario(world["fy25"].pk, {world["depts"]["HLT"].pk: "abc"})

    def test_scenario_does_not_touch_stored_budgets(self, world):
        before = list(BudgetAllocation.objects.order_by("id").values_list("allocated_amount", flat=True))
        BudgetOptimizer(max_change_pct=None).run_scenario(world["fy25"].pk, {world["depts"]["HLT"].pk: "500"})
        assert before == list(BudgetAllocation.objects.order_by("id").values_list("allocated_amount", flat=True))


@pytest.mark.django_db
class TestOptimizerEndpoint:
    def test_analyst_runs_and_gets_assumptions(self, analyst_client, world):
        res = analyst_client.post("/api/optimizer/", {"fiscal_year": world["fy25"].pk}, format="json")
        assert res.status_code == 200 and res.data["feasible"] is True
        assert "human review" in res.data["disclaimer"] and res.data["assumptions"]["max_change_pct"] == 25.0
        assert Decimal(res.data["total_recommended"]) == Decimal(res.data["total_current"])

    def test_scenario_via_endpoint(self, analyst_client, world):
        body = {"fiscal_year": world["fy25"].pk, "total_budget": "1100.00", "max_change_pct": None,
                "overrides": {str(world["depts"]["EDU"].pk): "450.00"}}
        res = analyst_client.post("/api/optimizer/", body, format="json")
        assert res.status_code == 200
        edu = next(r for r in res.data["allocations"] if r["department_name"] == "Education")
        assert Decimal(str(edu["recommended_allocation"])) == Decimal("450.00") and res.data["assumptions"]["max_change_pct"] is None

    def test_infeasible_returns_422_with_reason(self, analyst_client, world):
        res = analyst_client.post("/api/optimizer/", {"fiscal_year": world["fy25"].pk, "total_budget": "100"}, format="json")
        assert res.status_code == 422 and res.data["feasible"] is False and "Infeasible" in res.data["detail"]

    def test_validation_and_permissions(self, analyst_client, viewer_client, anon, world):
        assert analyst_client.post("/api/optimizer/", {}, format="json").status_code == 400
        assert analyst_client.post("/api/optimizer/", {"fiscal_year": 9999}, format="json").status_code == 404
        assert analyst_client.post("/api/optimizer/", {"fiscal_year": world["fy25"].pk, "total_budget": "-5"},
                                   format="json").status_code == 400
        assert viewer_client.post("/api/optimizer/", {"fiscal_year": world["fy25"].pk}, format="json").status_code == 403
        assert anon.post("/api/optimizer/", {"fiscal_year": world["fy25"].pk}, format="json").status_code == 401
