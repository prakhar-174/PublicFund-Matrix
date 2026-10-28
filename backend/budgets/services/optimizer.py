"""Deterministic budget recommendation engine.

Model
-----
For each department i with an allocation row in the target fiscal year:

    need_i = 0.70 * performance_gap_i + 0.30 * historical_underfunding_i

    performance_gap_i        = (100 - performance_score_i) / 100        in [0, 1]
    historical_underfunding_i = mean over fiscal years <= target of
                                max(0, requested - allocated) / requested   in [0, 1]

Needs are normalized to shares that sum to 1, and the unconstrained target is
share_i * total_budget. A low performance score is treated as a signal of unmet
outcomes that may reflect lack of resources; it is NOT proof of inefficiency, and
the reasoning text says so. It is a screening signal for human reviewers.

Constraints (solved exactly, never silently relaxed)
----------------------------------------------------
    sum(x_i) = total_budget
    lo_i <= x_i <= hi_i

where lo/hi come from the stability cap (current allocation +/- max_change_pct) and
from manual overrides (lo = hi = override). The solution is x_i = clip(lam * need_i,
lo_i, hi_i) with lam found by bisection so the total matches: this is the
proportional-with-bounds (water-filling) optimum and is fully deterministic. If the
bounds cannot sum to the total, OptimizationError explains why instead of returning a
misleading answer.

Missing data
------------
A department with no metrics (or no request history) receives the MEDIAN of the
departments that do have data for that component, and is flagged with a data gap and
lower confidence. Absence of evidence is never treated as evidence of low need.
"""
from __future__ import annotations

from decimal import ROUND_FLOOR, Decimal

import numpy as np
import pandas as pd

from budgets.models import FiscalYear

from .common import allocations_frame, performance_scores, safe_ratio

MODEL_VERSION = "need-v1"
W_PERFORMANCE_GAP = 0.70
W_UNDERFUNDING = 0.30
OBJECTIVE_WEIGHTS = {"performance_gap": W_PERFORMANCE_GAP, "historical_underfunding": W_UNDERFUNDING}
DEFAULT_MAX_CHANGE_PCT = 25.0
LOW_UTILIZATION = 0.70
CENT = Decimal("0.01")


class OptimizationError(ValueError):
    """Inputs or constraints that cannot produce a valid allocation."""


def _money(value) -> Decimal:
    return Decimal(str(value)).quantize(CENT)


def _water_fill(weights: np.ndarray, lo: np.ndarray, hi: np.ndarray, total: float) -> np.ndarray:
    """Return x with sum(x) == total and x_i = clip(lam * w_i, lo_i, hi_i) (deterministic bisection)."""
    if total < lo.sum() - 1e-6:
        raise OptimizationError(
            f"Infeasible: minimum allocations sum to {lo.sum():,.2f}, which exceeds the budget of {total:,.2f}."
        )
    if total > hi.sum() + 1e-6:
        raise OptimizationError(
            f"Infeasible: maximum allocations sum to {hi.sum():,.2f}, which is below the budget of {total:,.2f}."
        )
    w = np.maximum(weights, 1e-12)  # equal split when every need is zero
    lam_lo, lam_hi = 0.0, float(np.max(hi / w)) + 1.0
    for _ in range(200):
        lam = (lam_lo + lam_hi) / 2
        if np.clip(lam * w, lo, hi).sum() < total:
            lam_lo = lam
        else:
            lam_hi = lam
    return np.clip(lam_hi * w, lo, hi)


def _to_cents_exact(x: np.ndarray, lo: np.ndarray, hi: np.ndarray, total: Decimal) -> list[Decimal]:
    """Round to paise so the amounts sum EXACTLY to `total` (largest-remainder, ties by position)."""
    floors = [Decimal(str(v)).quantize(CENT, rounding=ROUND_FLOOR) for v in x]
    lo_c = [_money(v) for v in lo]
    hi_c = [_money(v) for v in hi]
    floors = [min(max(f, l), h) for f, l, h in zip(floors, lo_c, hi_c)]
    leftover_cents = int((total - sum(floors)) / CENT)
    order = sorted(range(len(x)), key=lambda i: (-(Decimal(str(x[i])) - floors[i]), i))
    step = CENT if leftover_cents > 0 else -CENT
    guard = 0
    while leftover_cents != 0 and guard < 10 * len(x) + abs(leftover_cents):
        moved = False
        for i in order:
            if leftover_cents == 0:
                break
            candidate = floors[i] + step
            if lo_c[i] <= candidate <= hi_c[i]:
                floors[i] = candidate
                leftover_cents -= 1 if step > 0 else -1
                moved = True
        guard += 1
        if not moved:
            break
    if sum(floors) != total:
        raise OptimizationError("Could not round allocations to paise within the constraints.")
    return floors


class BudgetOptimizer:
    def __init__(self, max_change_pct: float | None = DEFAULT_MAX_CHANGE_PCT):
        if max_change_pct is not None and max_change_pct < 0:
            raise OptimizationError("max_change_pct must not be negative.")
        self.max_change_pct = max_change_pct

    # ------------------------------------------------------------------ public

    def generate_recommendations(self, fiscal_year_id: int, total_budget=None) -> list[dict]:
        """Recommend allocations for every department in the year, largest change first."""
        return self._solve(fiscal_year_id, total_budget, overrides={})

    def run_scenario(self, fiscal_year_id: int, overrides: dict, total_budget=None) -> list[dict]:
        """Fix some departments at manual amounts and redistribute the remainder optimally."""
        return self._solve(fiscal_year_id, total_budget, overrides=overrides or {})

    # ----------------------------------------------------------------- internals

    def _solve(self, fiscal_year_id, total_budget, overrides) -> list[dict]:
        fiscal_year = FiscalYear.objects.get(pk=fiscal_year_id)
        frame = self._load(fiscal_year)
        if frame.empty:
            raise OptimizationError(f"No budget allocations exist for {fiscal_year.label}.")

        current = frame["allocated_amount"].to_numpy(dtype=float)
        total = _money(total_budget if total_budget is not None else Decimal(str(current.sum())))
        if total < 0:
            raise OptimizationError("total_budget must not be negative.")

        ids = [int(i) for i in frame["department_id"]]
        fixed = self._validate_overrides(overrides, ids)

        lo, hi = self._bounds(current, float(total))
        for idx, amount in fixed.items():
            lo[idx] = hi[idx] = float(amount)

        # Weight only matters for non-fixed departments; fixed ones are pinned by lo == hi.
        need = frame["need_score"].to_numpy(dtype=float)
        x = _water_fill(need, lo, hi, float(total))
        amounts = _to_cents_exact(x, lo, hi, total)

        shares = need / need.sum() if need.sum() > 0 else np.full(len(need), 1 / len(need))
        results = []
        for i, row in enumerate(frame.to_dict("records")):
            results.append(
                self._build_row(row, amounts[i], float(shares[i]), float(lo[i]), float(hi[i]),
                                is_override=i in fixed, fiscal_year=fiscal_year)
            )
        results.sort(key=lambda r: (-abs(r["change_amount"]), r["department_name"]))
        return results

    def _load(self, fiscal_year: FiscalYear) -> pd.DataFrame:
        alloc = allocations_frame(fiscal_year_id=fiscal_year.id)
        if alloc.empty:
            return alloc
        alloc = alloc.sort_values("department_id").reset_index(drop=True)

        # Historical underfunding across all years up to and including the target.
        history = allocations_frame(fiscal_year__year__lte=fiscal_year.year, department_id__in=alloc["department_id"])
        history = history[history["requested_amount"] > 0].copy()
        history["shortfall"] = (
            (history["requested_amount"] - history["allocated_amount"]).clip(lower=0) / history["requested_amount"]
        )
        under = history.groupby("department_id")["shortfall"].mean().rename("underfunding")
        alloc = alloc.merge(under, on="department_id", how="left")

        # Latest performance score on or before the target year.
        scores = performance_scores(fiscal_year__year__lte=fiscal_year.year, department_id__in=alloc["department_id"])
        if scores.empty:
            alloc["performance_score"] = np.nan
            alloc["performance_year"] = np.nan
        else:
            year_map = dict(FiscalYear.objects.values_list("id", "year"))
            scores["performance_year"] = scores["fiscal_year_id"].map(year_map)
            latest = scores.sort_values("performance_year").groupby("department_id").tail(1)
            alloc = alloc.merge(
                latest[["department_id", "performance_score", "performance_year"]], on="department_id", how="left"
            )

        alloc["utilization_rate"] = safe_ratio(alloc["spent_amount"], alloc["allocated_amount"])
        alloc["gap_missing"] = alloc["performance_score"].isna()
        alloc["under_missing"] = alloc["underfunding"].isna()
        alloc["performance_gap"] = (100 - alloc["performance_score"]) / 100
        # Median imputation (neutral) so missing data neither rewards nor punishes.
        gap_fill = alloc["performance_gap"].median() if alloc["performance_gap"].notna().any() else 0.0
        under_fill = alloc["underfunding"].median() if alloc["underfunding"].notna().any() else 0.0
        alloc["performance_gap"] = alloc["performance_gap"].fillna(gap_fill).clip(0, 1)
        alloc["underfunding"] = alloc["underfunding"].fillna(under_fill).clip(0, 1)
        alloc["need_score"] = W_PERFORMANCE_GAP * alloc["performance_gap"] + W_UNDERFUNDING * alloc["underfunding"]
        return alloc

    def _bounds(self, current: np.ndarray, total: float):
        """Stability cap around the current allocation. Departments with no current funding are uncapped above.

        The lower bound is deliberately NOT clipped to the total: if the minimums cannot fit
        in the budget, _water_fill must report infeasibility rather than quietly relax the cap.
        """
        if self.max_change_pct is None:
            return np.zeros_like(current), np.full_like(current, total)
        f = self.max_change_pct / 100.0
        lo = current * (1 - f)
        hi = np.where(current > 0, current * (1 + f), total)
        return lo, np.minimum(hi, max(total, 0.0))

    @staticmethod
    def _validate_overrides(overrides: dict, ids: list[int]) -> dict[int, Decimal]:
        fixed = {}
        for key, amount in overrides.items():
            try:
                dept_id = int(key)
                value = _money(amount)
            except (ValueError, ArithmeticError, TypeError):
                raise OptimizationError(f"Invalid override for department '{key}': {amount!r}.")
            if dept_id not in ids:
                raise OptimizationError(f"Department {dept_id} has no allocation in this fiscal year.")
            if value < 0:
                raise OptimizationError(f"Override for department {dept_id} must not be negative.")
            fixed[ids.index(dept_id)] = value
        return fixed

    def _build_row(self, row, recommended: Decimal, need_share, lo, hi, is_override, fiscal_year) -> dict:
        current = _money(row["allocated_amount"])
        change = recommended - current
        pct = float(change / current * 100) if current > 0 else None
        data_gaps, flags = [], []
        if row["gap_missing"]:
            data_gaps.append("no performance metrics on record (median used for this component)")
        elif row["performance_year"] != fiscal_year.year:
            data_gaps.append(
                f"no performance metrics for {fiscal_year.label}; score taken from FY "
                f"{int(row['performance_year'])}-{str(int(row['performance_year']) + 1)[-2:]} (may be outdated)"
            )
        if row["under_missing"]:
            data_gaps.append("no funding-request history (median used for this component)")
        confidence = {0: "high", 1: "medium"}.get(len(data_gaps), "low")

        util = row["utilization_rate"]
        if util is not None and not pd.isna(util) and util < LOW_UTILIZATION:
            flags.append(
                f"Utilization is {util:.0%}. Investigate causes (procurement delays, vacancies, implementation "
                "barriers, unrealistic estimates) before treating this as lower need."
            )

        at_cap = (not is_override) and self.max_change_pct is not None and (
            abs(float(recommended) - hi) < 0.01 or abs(float(recommended) - lo) < 0.01
        )
        return {
            "department_id": int(row["department_id"]),
            "department_name": row["department__name"],
            "current_allocation": current,
            "recommended_allocation": recommended,
            "change_amount": change,
            "change_percent": pct,
            "need_score": round(float(row["need_score"]), 6),
            "need_share": round(need_share, 6),
            "is_override": is_override,
            "bound_by_stability_cap": bool(at_cap),
            "confidence": confidence,
            "data_gaps": data_gaps,
            "flags": flags,
            "reasoning": self._reasoning(row, current, recommended, change, pct, is_override, at_cap, fiscal_year),
        }

    @staticmethod
    def _reasoning(row, current, recommended, change, pct, is_override, at_cap, fiscal_year) -> str:
        if is_override:
            return f"Set manually to {recommended:,.2f} (override); not derived from the need model."
        score = "not available" if row["gap_missing"] else f"{row['performance_score']:.1f}/100"
        under = "no request history" if row["under_missing"] else f"{row['underfunding']:.1%} average shortfall vs requests"
        direction = "increase" if change > 0 else "decrease" if change < 0 else "no change"
        parts = [
            f"{direction.capitalize()} from {current:,.2f} to {recommended:,.2f}"
            + (f" ({pct:+.1f}%)" if pct is not None else "")
            + ".",
            f"Inputs: performance score {score}; {under}; combined need score {row['need_score']:.3f} "
            f"(70% performance gap, 30% historical underfunding).",
        ]
        if at_cap:
            parts.append("Held at the year-over-year stability limit; the model alone would move it further.")
        parts.append("Decision support only: requires human review.")
        return " ".join(parts)
