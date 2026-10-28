from decimal import Decimal

from django.conf import settings
from django.db import models
from django.db.models import Q


class Department(models.Model):
    name = models.CharField(max_length=150, unique=True)
    code = models.CharField(max_length=20, unique=True)
    description = models.TextField(blank=True)
    head_name = models.CharField(max_length=150, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return f"{self.name} ({self.code})"


class FiscalYear(models.Model):
    """Indian financial year. `year` is the starting calendar year, so 2025 is FY 2025-26 (Apr 2025 to Mar 2026)."""

    year = models.PositiveIntegerField(unique=True)
    is_active = models.BooleanField(default=False)
    total_budget = models.DecimalField(max_digits=18, decimal_places=2, default=Decimal("0.00"))

    class Meta:
        ordering = ["-year"]
        constraints = [
            models.CheckConstraint(check=Q(total_budget__gte=0), name="fiscalyear_total_budget_gte_0"),
        ]

    @property
    def label(self) -> str:
        return f"FY {self.year}-{str(self.year + 1)[-2:]}"

    def __str__(self):
        return self.label


class BudgetAllocation(models.Model):
    class Status(models.TextChoices):
        DRAFT = "draft", "Draft"
        APPROVED = "approved", "Approved"
        REVISED = "revised", "Revised"

    # PROTECT: deleting a department or year must never silently erase financial history.
    department = models.ForeignKey(Department, on_delete=models.PROTECT, related_name="allocations")
    fiscal_year = models.ForeignKey(FiscalYear, on_delete=models.PROTECT, related_name="allocations")
    allocated_amount = models.DecimalField(max_digits=18, decimal_places=2, default=Decimal("0.00"))
    spent_amount = models.DecimalField(max_digits=18, decimal_places=2, default=Decimal("0.00"))
    requested_amount = models.DecimalField(max_digits=18, decimal_places=2, default=Decimal("0.00"))
    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="approved_allocations",
    )
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.DRAFT)

    class Meta:
        ordering = ["-fiscal_year__year", "department__name"]
        constraints = [
            models.UniqueConstraint(fields=["department", "fiscal_year"], name="uniq_allocation_dept_year"),
            models.CheckConstraint(check=Q(allocated_amount__gte=0), name="alloc_allocated_gte_0"),
            models.CheckConstraint(check=Q(spent_amount__gte=0), name="alloc_spent_gte_0"),
            models.CheckConstraint(check=Q(requested_amount__gte=0), name="alloc_requested_gte_0"),
        ]
        indexes = [
            models.Index(fields=["fiscal_year", "status"], name="alloc_year_status_idx"),
        ]

    def __str__(self):
        return f"{self.department.code} {self.fiscal_year.label}: {self.allocated_amount}"

    @property
    def unspent_amount(self) -> Decimal:
        return self.allocated_amount - self.spent_amount

    @property
    def utilization_rate(self):
        """Spent / allocated, or None when nothing was allocated (undefined, not zero)."""
        if not self.allocated_amount:
            return None
        return self.spent_amount / self.allocated_amount


class PerformanceMetric(models.Model):
    department = models.ForeignKey(Department, on_delete=models.CASCADE, related_name="metrics")
    fiscal_year = models.ForeignKey(FiscalYear, on_delete=models.CASCADE, related_name="metrics")
    metric_name = models.CharField(max_length=100)
    # Scored on a 0 to 100 scale (higher is better).
    metric_value = models.FloatField()
    weight = models.FloatField(default=1.0)
    description = models.TextField(blank=True)

    class Meta:
        ordering = ["department__name", "metric_name"]
        constraints = [
            models.UniqueConstraint(
                fields=["department", "fiscal_year", "metric_name"], name="uniq_metric_dept_year_name"
            ),
            models.CheckConstraint(
                check=Q(metric_value__gte=0) & Q(metric_value__lte=100), name="metric_value_0_100"
            ),
            models.CheckConstraint(check=Q(weight__gt=0), name="metric_weight_gt_0"),
        ]
        indexes = [
            models.Index(fields=["department", "fiscal_year"], name="metric_dept_year_idx"),
        ]

    def __str__(self):
        return f"{self.department.code} {self.fiscal_year.label} {self.metric_name}={self.metric_value}"


class OptimizationRun(models.Model):
    """A saved optimizer result. Proposed allocations live here, separate from approved budgets."""

    class Status(models.TextChoices):
        PROPOSED = "proposed", "Proposed"
        APPROVED = "approved", "Approved"
        REJECTED = "rejected", "Rejected"

    fiscal_year = models.ForeignKey(FiscalYear, on_delete=models.PROTECT, related_name="optimization_runs")
    total_budget = models.DecimalField(max_digits=18, decimal_places=2)
    # Everything needed to reproduce the run: requested total, stability cap, overrides.
    input_config = models.JSONField(default=dict)
    objective_weights = models.JSONField(default=dict)
    solver_status = models.CharField(max_length=20, default="optimal")
    model_version = models.CharField(max_length=30)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.PROPOSED)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="optimization_runs"
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at", "-id"]
        indexes = [models.Index(fields=["fiscal_year", "status"], name="run_year_status_idx")]

    def __str__(self):
        return f"Run {self.pk} {self.fiscal_year.label} ({self.status})"


class RecommendedAllocation(models.Model):
    run = models.ForeignKey(OptimizationRun, on_delete=models.CASCADE, related_name="allocations")
    department = models.ForeignKey(Department, on_delete=models.PROTECT, related_name="recommendations")
    baseline_allocation = models.DecimalField(max_digits=18, decimal_places=2)
    recommended_allocation = models.DecimalField(max_digits=18, decimal_places=2)
    need_score = models.FloatField()
    need_share = models.FloatField()
    confidence = models.CharField(max_length=10)
    data_gaps = models.JSONField(default=list)
    flags = models.JSONField(default=list)
    is_override = models.BooleanField(default=False)
    bound_by_stability_cap = models.BooleanField(default=False)
    explanation = models.TextField()

    class Meta:
        ordering = ["department__name"]
        constraints = [
            models.UniqueConstraint(fields=["run", "department"], name="uniq_recommendation_run_dept"),
            models.CheckConstraint(check=Q(recommended_allocation__gte=0), name="rec_amount_gte_0"),
        ]

    @property
    def change_amount(self) -> Decimal:
        return self.recommended_allocation - self.baseline_allocation

    @property
    def change_percent(self):
        if not self.baseline_allocation:
            return None
        return float(self.change_amount / self.baseline_allocation * 100)


class Approval(models.Model):
    """A reviewer's decision on a run. One decision per run, and it is final."""

    class Decision(models.TextChoices):
        APPROVED = "approved", "Approved"
        REJECTED = "rejected", "Rejected"

    run = models.OneToOneField(OptimizationRun, on_delete=models.PROTECT, related_name="approval")
    reviewer = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="approval_decisions"
    )
    decision = models.CharField(max_length=10, choices=Decision.choices)
    comments = models.TextField(blank=True)
    decided_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-decided_at", "-id"]

    def __str__(self):
        return f"Run {self.run_id}: {self.decision}"


class SpendingEntry(models.Model):
    """Optional period-level spend, used only for spending-trend analytics.

    `BudgetAllocation.spent_amount` stays the authoritative total; entries are
    granular detail where the source data has it, so trend endpoints report how
    much of the total they actually cover instead of inventing a monthly split.
    """

    allocation = models.ForeignKey(BudgetAllocation, on_delete=models.CASCADE, related_name="spending_entries")
    month = models.DateField(help_text="First day of the month the spend relates to.")
    amount = models.DecimalField(max_digits=18, decimal_places=2)

    class Meta:
        ordering = ["month"]
        constraints = [
            models.UniqueConstraint(fields=["allocation", "month"], name="uniq_spend_alloc_month"),
            models.CheckConstraint(check=Q(amount__gte=0), name="spend_amount_gte_0"),
        ]
        indexes = [models.Index(fields=["allocation", "month"], name="spend_alloc_month_idx")]

    def __str__(self):
        return f"{self.allocation_id} {self.month:%Y-%m}: {self.amount}"
