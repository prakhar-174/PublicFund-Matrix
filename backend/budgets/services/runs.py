"""Persisting optimizer results and deciding on them.

Approving a run is the ONLY path by which optimizer output reaches the approved
allocations. It is explicit, reviewer-initiated, atomic, and refuses to apply a
proposal that no longer matches the current budget.
"""
from __future__ import annotations

from decimal import Decimal

from django.conf import settings
from django.db import transaction

from audit.services import record
from budgets.models import Approval, BudgetAllocation, OptimizationRun, RecommendedAllocation

from .optimizer import MODEL_VERSION, OBJECTIVE_WEIGHTS


class ApprovalError(Exception):
    """A decision that cannot be made. `status_code` maps straight to the HTTP response."""

    def __init__(self, message: str, status_code: int = 409, details=None):
        super().__init__(message)
        self.message, self.status_code, self.details = message, status_code, details or []


@transaction.atomic
def create_run(user, fiscal_year_id: int, rows: list[dict], input_config: dict, request=None) -> OptimizationRun:
    """Store an optimizer result (status: proposed). Stored allocations are not touched."""
    run = OptimizationRun.objects.create(
        fiscal_year_id=fiscal_year_id,
        total_budget=sum((r["recommended_allocation"] for r in rows), Decimal("0")),
        input_config=input_config,
        objective_weights=OBJECTIVE_WEIGHTS,
        model_version=MODEL_VERSION,
        created_by=user,
    )
    RecommendedAllocation.objects.bulk_create(
        RecommendedAllocation(
            run=run,
            department_id=r["department_id"],
            baseline_allocation=r["current_allocation"],
            recommended_allocation=r["recommended_allocation"],
            need_score=r["need_score"],
            need_share=r["need_share"],
            confidence=r["confidence"],
            data_gaps=r["data_gaps"],
            flags=r["flags"],
            is_override=r["is_override"],
            bound_by_stability_cap=r["bound_by_stability_cap"],
            explanation=r["reasoning"],
        )
        for r in rows
    )
    record(user, "optimization_run_created", "optimizationrun", run.pk,
           {"fiscal_year": fiscal_year_id, "total_budget": run.total_budget, "input_config": input_config,
            "model_version": MODEL_VERSION}, request)
    return run


@transaction.atomic
def decide_run(run_id: int, reviewer, decision: str, comments: str = "", request=None) -> OptimizationRun:
    try:
        run = OptimizationRun.objects.select_for_update().select_related("fiscal_year").get(pk=run_id)
    except OptimizationRun.DoesNotExist:
        raise ApprovalError("Optimization run not found.", 404)

    if run.status != OptimizationRun.Status.PROPOSED:
        raise ApprovalError(f"This run was already {run.status}; decisions are final.")
    if decision not in Approval.Decision.values:
        raise ApprovalError("Decision must be 'approved' or 'rejected'.", 400)
    comments = (comments or "").strip()

    if decision == Approval.Decision.REJECTED:
        if not comments:
            raise ApprovalError("A comment explaining the rejection is required.", 400)
    else:
        if settings.REQUIRE_SEPARATE_REVIEWER and run.created_by_id == reviewer.id:
            raise ApprovalError("The creator of a run cannot approve it; another administrator must.", 403)
        applied = _apply_run(run, reviewer, request)

    Approval.objects.create(run=run, reviewer=reviewer, decision=decision, comments=comments)
    run.status = decision
    run.save(update_fields=["status"])
    meta = {"decision": decision, "comments": comments, "fiscal_year": run.fiscal_year_id}
    if decision == Approval.Decision.APPROVED:
        meta["applied"] = applied
    record(reviewer, f"optimization_run_{decision}", "optimizationrun", run.pk, meta, request)
    return run


def _apply_run(run: OptimizationRun, reviewer, request) -> list[dict]:
    recs = list(run.allocations.select_related("department"))
    current = {
        a.department_id: a
        for a in BudgetAllocation.objects.select_for_update().filter(fiscal_year_id=run.fiscal_year_id)
    }

    problems = []
    for rec in recs:
        alloc = current.get(rec.department_id)
        if alloc is None:
            problems.append(f"{rec.department.name}: allocation no longer exists.")
        elif alloc.allocated_amount != rec.baseline_allocation:
            problems.append(
                f"{rec.department.name}: allocation changed from {rec.baseline_allocation} to "
                f"{alloc.allocated_amount} since this run was created."
            )
    covered = {r.department_id for r in recs}
    problems += [f"Department {d} gained an allocation after this run was created." for d in current if d not in covered]
    if problems:
        raise ApprovalError("Run is stale; re-run the optimizer against the current budget.", 409, problems)

    envelope = run.fiscal_year.total_budget
    if envelope > 0 and run.total_budget > envelope:
        raise ApprovalError(
            f"Recommended total {run.total_budget} exceeds the fiscal year's total budget of {envelope}.", 409
        )

    applied = []
    for rec in recs:
        alloc = current[rec.department_id]
        before = alloc.allocated_amount
        alloc.allocated_amount = rec.recommended_allocation
        alloc.status = BudgetAllocation.Status.APPROVED
        alloc.approved_by = reviewer
        alloc.save(update_fields=["allocated_amount", "status", "approved_by"])
        change = {"department": rec.department.code, "from": before, "to": rec.recommended_allocation}
        applied.append(change)
        record(reviewer, "allocation_updated_by_approval", "budgetallocation", alloc.pk,
               {"run": run.pk, **change}, request)
    return applied
