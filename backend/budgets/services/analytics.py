"""Pandas-based budget analytics.

Every public method returns plain dicts/lists that are safe to JSON-serialize.
Ratios whose denominator is zero are reported as null (undefined), never as 0,
so an unfunded department is not mistaken for a fully-utilized one.
"""
from __future__ import annotations

import pandas as pd

from budgets.models import BudgetAllocation, Department, FiscalYear, SpendingEntry

from .common import allocations_frame, performance_scores, safe_ratio, to_python, to_records

# Indian fiscal year runs April to March.
FISCAL_MONTH_ORDER = [4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3]


class BudgetAnalyticsService:
    def get_year_over_year(self, department_id: int) -> dict:
        """Allocation and spending per fiscal year for one department, with year-on-year change."""
        department = Department.objects.get(pk=department_id)
        df = allocations_frame(department_id=department_id)
        if df.empty:
            return {"department": {"id": department.id, "name": department.name}, "years": []}

        df = df.sort_values("fiscal_year__year").reset_index(drop=True)
        df["utilization_rate"] = safe_ratio(df["spent_amount"], df["allocated_amount"])
        df["unspent_amount"] = df["allocated_amount"] - df["spent_amount"]
        for col in ("allocated_amount", "spent_amount"):
            df[f"{col}_change"] = df[col].diff()
            # pct_change is undefined when the previous year was zero.
            prev = df[col].shift(1)
            df[f"{col}_change_pct"] = safe_ratio(df[f"{col}_change"], prev) * 100

        out = df.rename(columns={"fiscal_year__year": "year"})[
            [
                "year", "allocated_amount", "spent_amount", "requested_amount", "unspent_amount",
                "utilization_rate", "allocated_amount_change", "allocated_amount_change_pct",
                "spent_amount_change", "spent_amount_change_pct", "status",
            ]
        ]
        return {"department": {"id": department.id, "name": department.name}, "years": to_records(out)}

    def get_department_comparison(self, fiscal_year_id: int) -> dict:
        """Departments for one year ranked by utilization, alongside their performance score."""
        fiscal_year = FiscalYear.objects.get(pk=fiscal_year_id)
        df = allocations_frame(fiscal_year_id=fiscal_year_id)
        if df.empty:
            return {"fiscal_year": fiscal_year.label, "departments": []}

        df["utilization_rate"] = safe_ratio(df["spent_amount"], df["allocated_amount"])
        scores = performance_scores(fiscal_year_id=fiscal_year_id)
        df = df.merge(scores, on=["department_id", "fiscal_year_id"], how="left")

        df["utilization_rank"] = df["utilization_rate"].rank(ascending=False, method="min")
        df["performance_rank"] = df["performance_score"].rank(ascending=False, method="min")
        df = df.sort_values(
            ["utilization_rate", "department__name"], ascending=[False, True], na_position="last"
        )
        out = df.rename(
            columns={
                "department_id": "department",
                "department__name": "department_name",
                "department__code": "department_code",
            }
        )[
            [
                "department", "department_name", "department_code", "allocated_amount", "spent_amount",
                "utilization_rate", "utilization_rank", "performance_score",
                "performance_rank", "metric_count",
            ]
        ]
        return {"fiscal_year": fiscal_year.label, "departments": to_records(out)}

    def get_spending_trend(self, fiscal_year_id: int) -> dict:
        """Monthly and fiscal-quarter spend progression built from SpendingEntry rows.

        The authoritative spent total lives on BudgetAllocation. Entries may cover
        only part of it, so `coverage` reports how much, and no spend is invented
        to fill gaps.
        """
        fiscal_year = FiscalYear.objects.get(pk=fiscal_year_id)
        rows = SpendingEntry.objects.filter(allocation__fiscal_year_id=fiscal_year_id).values("month", "amount")
        df = pd.DataFrame.from_records(rows, columns=["month", "amount"])
        recorded_total = float(
            sum(
                BudgetAllocation.objects.filter(fiscal_year_id=fiscal_year_id).values_list("spent_amount", flat=True)
            )
        )

        if df.empty:
            return {
                "fiscal_year": fiscal_year.label,
                "monthly": [],
                "quarterly": [],
                "coverage": {"entries_total": 0.0, "recorded_spent_total": recorded_total, "coverage_ratio": None},
            }

        df["amount"] = df["amount"].astype(float)
        df["month"] = pd.to_datetime(df["month"])
        monthly = df.groupby("month", as_index=False)["amount"].sum()
        monthly["fiscal_order"] = monthly["month"].dt.month.map(FISCAL_MONTH_ORDER.index)
        monthly = monthly.sort_values(["fiscal_order"]).reset_index(drop=True)
        monthly["cumulative"] = monthly["amount"].cumsum()
        monthly["quarter"] = "Q" + (monthly["fiscal_order"] // 3 + 1).astype(str)
        monthly["month_label"] = monthly["month"].dt.strftime("%Y-%m")

        quarterly = monthly.groupby("quarter", as_index=False)["amount"].sum()
        quarterly["cumulative"] = quarterly["amount"].cumsum()

        entries_total = float(df["amount"].sum())
        return {
            "fiscal_year": fiscal_year.label,
            "monthly": to_records(
                monthly.rename(columns={"amount": "spent"})[["month_label", "spent", "cumulative", "quarter"]]
            ),
            "quarterly": to_records(quarterly.rename(columns={"amount": "spent"})),
            "coverage": {
                "entries_total": entries_total,
                "recorded_spent_total": recorded_total,
                "coverage_ratio": entries_total / recorded_total if recorded_total else None,
            },
        }

    def get_underfunded_departments(self, fiscal_year_id: int, threshold: float = 0.8) -> dict:
        """Departments funded below `threshold` of what they requested.

        funded_ratio = allocated / requested. A department is listed when that is
        below the threshold (0.8 means "received less than 80% of its request").
        Departments with no request are skipped: no request is not a funding gap.
        A request is a claim, not proof of need, so treat the list as a prompt
        for review rather than a verdict.
        """
        if not 0 < threshold <= 1:
            raise ValueError("threshold must be greater than 0 and at most 1.")
        fiscal_year = FiscalYear.objects.get(pk=fiscal_year_id)
        df = allocations_frame(fiscal_year_id=fiscal_year_id)
        if df.empty:
            return {"fiscal_year": fiscal_year.label, "threshold": threshold, "departments": []}

        df = df[df["requested_amount"] > 0].copy()
        df["funded_ratio"] = df["allocated_amount"] / df["requested_amount"]
        df["funding_gap"] = df["requested_amount"] - df["allocated_amount"]
        df["utilization_rate"] = safe_ratio(df["spent_amount"], df["allocated_amount"])
        flagged = df[df["funded_ratio"] < threshold].sort_values("funded_ratio")
        out = flagged.rename(
            columns={
                "department_id": "department",
                "department__name": "department_name",
                "department__code": "department_code",
            }
        )[
            [
                "department", "department_name", "department_code", "allocated_amount", "requested_amount",
                "funded_ratio", "funding_gap", "utilization_rate",
            ]
        ]
        return {
            "fiscal_year": fiscal_year.label,
            "threshold": to_python(threshold),
            "note": "Requests are claims, not verified need. Review before acting.",
            "departments": to_records(out),
        }
