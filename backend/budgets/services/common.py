"""Helpers shared by the analytics and optimizer services."""
from __future__ import annotations

import math
from typing import Any

import numpy as np
import pandas as pd

from budgets.models import BudgetAllocation, PerformanceMetric


def to_python(value: Any) -> Any:
    """Convert numpy / pandas scalars to JSON-safe Python values; NaN and inf become None."""
    if value is None or value is pd.NaT:
        return None
    if isinstance(value, (np.integer,)):
        return int(value)
    if isinstance(value, (np.floating, float)):
        f = float(value)
        return None if math.isnan(f) or math.isinf(f) else f
    if isinstance(value, np.bool_):
        return bool(value)
    return value


def to_records(df: pd.DataFrame) -> list[dict]:
    """DataFrame to a list of JSON-safe dicts."""
    if df.empty:
        return []
    return [{k: to_python(v) for k, v in row.items()} for row in df.to_dict("records")]


def safe_ratio(numerator: pd.Series, denominator: pd.Series) -> pd.Series:
    """Element-wise ratio that is NaN (undefined), never 0 or inf, when the denominator is 0."""
    denom = denominator.astype(float).where(denominator.astype(float) != 0)
    return numerator.astype(float) / denom


def allocations_frame(**filters) -> pd.DataFrame:
    """Allocation rows as a float-typed DataFrame, loaded with a single query."""
    rows = BudgetAllocation.objects.filter(**filters).values(
        "id", "department_id", "department__name", "department__code",
        "fiscal_year_id", "fiscal_year__year",
        "allocated_amount", "spent_amount", "requested_amount", "status",
    )
    df = pd.DataFrame.from_records(
        rows,
        columns=[
            "id", "department_id", "department__name", "department__code",
            "fiscal_year_id", "fiscal_year__year",
            "allocated_amount", "spent_amount", "requested_amount", "status",
        ],
    )
    for col in ("allocated_amount", "spent_amount", "requested_amount"):
        df[col] = df[col].astype(float)
    return df


def performance_scores(**filters) -> pd.DataFrame:
    """Weighted-average performance score (0 to 100) per (department, fiscal year).

    Departments with no metrics are absent from the result, so callers get NaN
    (unknown) on merge rather than a misleading score of 0.
    """
    rows = PerformanceMetric.objects.filter(**filters).values(
        "department_id", "fiscal_year_id", "metric_value", "weight"
    )
    df = pd.DataFrame.from_records(rows, columns=["department_id", "fiscal_year_id", "metric_value", "weight"])
    if df.empty:
        return pd.DataFrame(columns=["department_id", "fiscal_year_id", "performance_score", "metric_count"])
    df["weighted"] = df["metric_value"].astype(float) * df["weight"].astype(float)
    grouped = df.groupby(["department_id", "fiscal_year_id"]).agg(
        weighted=("weighted", "sum"), weight=("weight", "sum"), metric_count=("metric_value", "size")
    )
    grouped["performance_score"] = grouped["weighted"] / grouped["weight"]
    return grouped.reset_index()[["department_id", "fiscal_year_id", "performance_score", "metric_count"]]
