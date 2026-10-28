from datetime import date
from decimal import Decimal

import pytest

from budgets.models import BudgetAllocation, SpendingEntry
from budgets.services.analytics import BudgetAnalyticsService

svc = BudgetAnalyticsService()


@pytest.mark.django_db
class TestYearOverYear:
    def test_changes_computed(self, world):
        out = svc.get_year_over_year(world["depts"]["HLT"].pk)
        first, second = out["years"]
        assert first["year"] == 2024 and first["allocated_amount_change"] is None
        assert second["allocated_amount_change"] == pytest.approx(20.0)
        assert second["allocated_amount_change_pct"] == pytest.approx(5.0)
        assert second["utilization_rate"] == pytest.approx(400 / 420)

    def test_department_without_data(self, world):
        from budgets.models import Department
        d = Department.objects.create(name="Empty", code="EMP")
        assert svc.get_year_over_year(d.pk)["years"] == []


@pytest.mark.django_db
class TestComparison:
    def test_ranked_by_utilization_with_performance(self, world):
        out = svc.get_department_comparison(world["fy25"].pk)["departments"]
        names = [d["department_name"] for d in out]
        assert names == ["Education", "Health", "Environment"]  # 97.6%, 95.2%, 42.9%
        edu = out[0]
        assert edu["utilization_rank"] == 1 and edu["performance_score"] == pytest.approx(80.0)
        assert out[2]["performance_rank"] == 2

    def test_zero_allocation_has_null_utilization_not_zero(self, world):
        from budgets.models import Department
        BudgetAllocation.objects.create(department=Department.objects.create(name="Z", code="Z"),
                                        fiscal_year=world["fy25"], allocated_amount=Decimal("0"))
        out = svc.get_department_comparison(world["fy25"].pk)["departments"]
        z = next(d for d in out if d["department_name"] == "Z")
        assert z["utilization_rate"] is None and z["performance_score"] is None
        assert out[-1] is z  # undefined sorts last

    def test_output_is_json_safe(self, world):
        import json
        json.dumps(svc.get_department_comparison(world["fy25"].pk), allow_nan=False)


@pytest.mark.django_db
class TestUnderfunded:
    def test_flags_below_funded_threshold(self, world):
        out = svc.get_underfunded_departments(world["fy25"].pk, threshold=0.8)["departments"]
        # Health 420/600 = 0.70, Environment 210/300 = 0.70; Education 420/430 = 0.98
        assert {d["department_name"] for d in out} == {"Health", "Environment"}
        assert all(d["funded_ratio"] < 0.8 for d in out)

    def test_no_request_is_not_a_gap(self, world):
        BudgetAllocation.objects.filter(fiscal_year=world["fy25"]).update(requested_amount=0)
        assert svc.get_underfunded_departments(world["fy25"].pk)["departments"] == []

    def test_invalid_threshold(self, world):
        with pytest.raises(ValueError):
            svc.get_underfunded_departments(world["fy25"].pk, threshold=0)


@pytest.mark.django_db
class TestSpendingTrend:
    def test_fiscal_order_and_coverage(self, world):
        alloc = BudgetAllocation.objects.get(department=world["depts"]["HLT"], fiscal_year=world["fy25"])
        for month, amount in [(date(2026, 1, 1), 100), (date(2025, 4, 1), 50), (date(2025, 8, 1), 150)]:
            SpendingEntry.objects.create(allocation=alloc, month=month, amount=Decimal(amount))
        out = svc.get_spending_trend(world["fy25"].pk)
        assert [m["month_label"] for m in out["monthly"]] == ["2025-04", "2025-08", "2026-01"]
        assert [m["cumulative"] for m in out["monthly"]] == [50, 200, 300]
        assert [q["quarter"] for q in out["quarterly"]] == ["Q1", "Q2", "Q4"]
        assert out["coverage"]["entries_total"] == 300
        assert out["coverage"]["coverage_ratio"] == pytest.approx(300 / 900)  # honest: only part of spend is itemized

    def test_no_entries_means_empty_not_invented(self, world):
        out = svc.get_spending_trend(world["fy25"].pk)
        assert out["monthly"] == [] and out["coverage"]["coverage_ratio"] is None


@pytest.mark.django_db
class TestAnalyticsEndpoint:
    def test_index_and_reports(self, viewer_client, world):
        assert "available_reports" in viewer_client.get("/api/analytics/").data
        res = viewer_client.get(f"/api/analytics/?report=underfunded&fiscal_year={world['fy25'].pk}")
        assert res.status_code == 200 and res.data["departments"]
        res = viewer_client.get(f"/api/analytics/?report=year_over_year&department={world['depts']['EDU'].pk}")
        assert len(res.data["years"]) == 2

    def test_errors(self, viewer_client):
        assert viewer_client.get("/api/analytics/?report=nope").status_code == 400
        assert viewer_client.get("/api/analytics/?report=spending_trend").status_code == 400
        assert viewer_client.get("/api/analytics/?report=spending_trend&fiscal_year=abc").status_code == 400
        assert viewer_client.get("/api/analytics/?report=spending_trend&fiscal_year=9999").status_code == 404
        assert viewer_client.get("/api/analytics/?report=underfunded&fiscal_year=1&threshold=2").status_code in (400, 404)
