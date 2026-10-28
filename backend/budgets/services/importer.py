"""CSV / Excel import of budget allocations (validated, then upserted in bulk)."""
from __future__ import annotations

from decimal import Decimal, InvalidOperation

import pandas as pd
from django.db import transaction

from budgets.models import BudgetAllocation, Department, FiscalYear

REQUIRED_COLUMNS = ["department_code", "fiscal_year", "allocated_amount"]
OPTIONAL_COLUMNS = ["spent_amount", "requested_amount", "status"]
AMOUNT_COLUMNS = ["allocated_amount", "spent_amount", "requested_amount"]
MAX_ROWS = 20000
MAX_BYTES = 5 * 1024 * 1024


class ImportFileError(ValueError):
    """The file itself is unusable (type, size, missing columns)."""


def read_upload(uploaded) -> pd.DataFrame:
    name = (uploaded.name or "").lower()
    if uploaded.size > MAX_BYTES:
        raise ImportFileError(f"File exceeds the {MAX_BYTES // (1024 * 1024)} MB limit.")
    try:
        if name.endswith(".csv"):
            df = pd.read_csv(uploaded, dtype=str, keep_default_na=False)
        elif name.endswith((".xlsx", ".xls")):
            df = pd.read_excel(uploaded, dtype=str, keep_default_na=False)
        else:
            raise ImportFileError("Unsupported file type. Upload a .csv or .xlsx file.")
    except ImportFileError:
        raise
    except Exception as exc:  # malformed file contents
        raise ImportFileError(f"Could not read the file: {exc}")
    df.columns = [str(c).strip().lower() for c in df.columns]
    missing = [c for c in REQUIRED_COLUMNS if c not in df.columns]
    if missing:
        raise ImportFileError(f"Missing required column(s): {', '.join(missing)}.")
    if len(df) > MAX_ROWS:
        raise ImportFileError(f"Too many rows ({len(df)}); the limit is {MAX_ROWS}.")
    return df


def _parse_amount(raw: str, column: str, required: bool):
    text = (raw or "").strip().replace(",", "")
    if text == "":
        if required:
            return None, f"{column} is missing."
        return Decimal("0.00"), None
    try:
        value = Decimal(text)
    except InvalidOperation:
        return None, f"{column} '{raw}' is not a number."
    if not value.is_finite():
        return None, f"{column} '{raw}' is not a finite number."
    if value < 0:
        return None, f"{column} must not be negative."
    return value.quantize(Decimal("0.01")), None


def validate_rows(df: pd.DataFrame):
    """Return (clean_rows, errors). Errors are row-level: {row, field_errors: [...]} (row 2 = first data row)."""
    departments = {d.code.upper(): d for d in Department.objects.all()}
    years = {fy.year: fy for fy in FiscalYear.objects.all()}
    clean, errors, seen = [], [], {}
    existing_status = {
        (d, f): s for d, f, s in BudgetAllocation.objects.values_list("department_id", "fiscal_year_id", "status")
    }

    for position, record in enumerate(df.to_dict("records")):
        row_no = position + 2  # header is row 1
        problems = []
        code = str(record.get("department_code", "")).strip().upper()
        department = departments.get(code)
        if not code:
            problems.append("department_code is missing.")
        elif department is None:
            problems.append(f"Unknown department_code '{code}'.")

        year_raw = str(record.get("fiscal_year", "")).strip()
        fiscal_year = None
        try:
            fiscal_year = years.get(int(year_raw[:4])) if year_raw else None
            if not year_raw:
                problems.append("fiscal_year is missing.")
            elif fiscal_year is None:
                problems.append(f"Unknown fiscal_year '{year_raw}'.")
        except ValueError:
            problems.append(f"fiscal_year '{year_raw}' is not valid (use e.g. 2025 or 2025-26).")

        amounts = {}
        for col in AMOUNT_COLUMNS:
            value, problem = _parse_amount(record.get(col, ""), col, required=(col == "allocated_amount"))
            if problem:
                problems.append(problem)
            amounts[col] = value

        status = str(record.get("status", "")).strip().lower()
        if not status:
            # No status given: keep an existing row's status, except that changing the
            # numbers of an approved allocation makes it "revised", not still-approved.
            prior = existing_status.get((department.id, fiscal_year.id)) if department and fiscal_year else None
            status = (
                BudgetAllocation.Status.REVISED if prior == BudgetAllocation.Status.APPROVED
                else prior or BudgetAllocation.Status.DRAFT
            )
        if status not in BudgetAllocation.Status.values:
            problems.append(f"status '{status}' must be one of {', '.join(BudgetAllocation.Status.values)}.")
        elif status == BudgetAllocation.Status.APPROVED:
            problems.append("Imports cannot mark allocations approved; approval is a separate administrator action.")

        if department and fiscal_year:
            key = (department.id, fiscal_year.id)
            if key in seen:
                problems.append(f"Duplicate of row {seen[key]} (same department and fiscal year).")
            else:
                seen[key] = row_no

        if problems:
            errors.append({"row": row_no, "errors": problems})
        else:
            clean.append({"department": department, "fiscal_year": fiscal_year, "status": status, **amounts})
    return clean, errors


@transaction.atomic
def upsert_allocations(clean_rows: list[dict]) -> dict:
    """Create or update allocations in bulk (all or nothing)."""
    existing = {
        (a.department_id, a.fiscal_year_id)
        for a in BudgetAllocation.objects.filter(
            department__in={r["department"] for r in clean_rows},
            fiscal_year__in={r["fiscal_year"] for r in clean_rows},
        )
    }
    objects = [
        BudgetAllocation(
            department=r["department"], fiscal_year=r["fiscal_year"],
            allocated_amount=r["allocated_amount"], spent_amount=r["spent_amount"],
            requested_amount=r["requested_amount"], status=r["status"],
        )
        for r in clean_rows
    ]
    BudgetAllocation.objects.bulk_create(
        objects,
        update_conflicts=True,
        unique_fields=["department", "fiscal_year"],
        update_fields=["allocated_amount", "spent_amount", "requested_amount", "status"],
    )
    updated = sum(1 for r in clean_rows if (r["department"].id, r["fiscal_year"].id) in existing)
    return {"created": len(clean_rows) - updated, "updated": updated}
