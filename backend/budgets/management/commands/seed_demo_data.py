"""Load FICTIONAL demo data: 10 departments, 3 fiscal years, allocations, metrics, monthly spend.

Figures are synthetic and must not be presented as official government data.
The command is deterministic (fixed seed) and idempotent (safe to re-run).
"""
import random
import secrets
from datetime import date
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.db import transaction

from budgets.models import BudgetAllocation, Department, FiscalYear, PerformanceMetric, SpendingEntry

CRORE = Decimal("10000000")
FISCAL_YEARS = [2023, 2024, 2025]

# (name, code, head, base allocation in crore, base performance, base utilization)
DEPARTMENTS = [
    ("Health and Family Welfare", "HLTH", "Dr. A. Rao", 6200, 72, 0.96),
    ("School and Higher Education", "EDUC", "S. Iyer", 8400, 68, 0.97),
    ("Agriculture and Farmers Welfare", "AGRI", "M. Singh", 3900, 64, 0.91),
    ("Rural Development", "RURL", "P. Nair", 5600, 61, 0.88),
    ("Urban Development", "URBN", "K. Mehta", 4300, 70, 0.93),
    ("Transport", "TRNS", "R. Das", 5100, 66, 0.90),
    ("Infrastructure and Public Works", "INFR", "V. Reddy", 7200, 63, 0.84),
    ("Public Safety and Home Affairs", "SAFE", "N. Khan", 3100, 74, 0.98),
    ("Environment and Climate", "ENVR", "L. Bose", 1400, 58, 0.62),  # persistent under-utilizer
    ("Social Welfare", "SOCW", "T. Joshi", 4800, 69, 0.95),
]
METRICS = [
    ("Service delivery coverage", 2.0, "Share of the eligible population reached (scored 0-100)."),
    ("Project completion rate", 1.5, "Share of planned projects completed on schedule (scored 0-100)."),
    ("Citizen satisfaction", 1.0, "Survey-based satisfaction score (scored 0-100)."),
]
# FY2025 metrics are deliberately missing for this department to exercise missing-data handling.
NO_METRICS = {("ENVR", 2025)}


def crore(value: float) -> Decimal:
    return (Decimal(str(round(value, 4))) * CRORE).quantize(Decimal("0.01"))


class Command(BaseCommand):
    help = "Load fictional demo budget data (departments, fiscal years, allocations, metrics, monthly spend)."

    def add_arguments(self, parser):
        parser.add_argument("--with-users", action="store_true",
                            help="Also create demo admin/analyst/viewer users with a generated password (printed once).")

    @transaction.atomic
    def handle(self, *args, **options):
        rng = random.Random(42)
        departments = {}
        for name, code, head, *_ in DEPARTMENTS:
            dept, _ = Department.objects.update_or_create(
                code=code,
                defaults={"name": name, "head_name": head,
                          "description": "FICTIONAL demo department. Synthetic data, not official."},
            )
            departments[code] = dept

        years = {y: FiscalYear.objects.update_or_create(year=y, defaults={"is_active": y == FISCAL_YEARS[-1]})[0]
                 for y in FISCAL_YEARS}

        totals = {y: Decimal("0") for y in FISCAL_YEARS}
        for name, code, _head, base, perf, util in DEPARTMENTS:
            for step, y in enumerate(FISCAL_YEARS):
                growth = (1 + rng.uniform(0.03, 0.09)) ** step
                allocated = crore(base * growth)
                requested = (allocated * Decimal(str(round(rng.uniform(1.02, 1.30), 4)))).quantize(Decimal("0.01"))
                spent_ratio = min(0.995, max(0.3, util + rng.uniform(-0.03, 0.03)))
                spent = (allocated * Decimal(str(round(spent_ratio, 4)))).quantize(Decimal("0.01"))
                status = (BudgetAllocation.Status.DRAFT if y == FISCAL_YEARS[-1]
                          else BudgetAllocation.Status.APPROVED)
                alloc, _ = BudgetAllocation.objects.update_or_create(
                    department=departments[code], fiscal_year=years[y],
                    defaults={"allocated_amount": allocated, "spent_amount": spent,
                              "requested_amount": requested, "status": status},
                )
                totals[y] += allocated
                self._spending_entries(alloc, y, spent, rng)

                if (code, y) in NO_METRICS:
                    PerformanceMetric.objects.filter(department=departments[code], fiscal_year=years[y]).delete()
                    continue
                for metric_name, weight, description in METRICS:
                    value = min(100.0, max(0.0, perf + step * rng.uniform(0, 2.5) + rng.uniform(-6, 6)))
                    PerformanceMetric.objects.update_or_create(
                        department=departments[code], fiscal_year=years[y], metric_name=metric_name,
                        defaults={"metric_value": round(value, 1), "weight": weight, "description": description},
                    )

        for y, total in totals.items():
            # Keep roughly 3% of the envelope unallocated as a reserve.
            years[y].total_budget = (total / Decimal("0.97")).quantize(Decimal("0.01"))
            years[y].save(update_fields=["total_budget"])

        self.stdout.write(self.style.SUCCESS(
            f"Loaded {len(DEPARTMENTS)} departments, {len(FISCAL_YEARS)} fiscal years (FICTIONAL demo data)."))
        if options["with_users"]:
            self._create_users(departments)

    @staticmethod
    def _spending_entries(alloc, year, spent, rng):
        """Split `spent` across the 12 fiscal months with a back-loaded profile (Indian FY: Apr to Mar)."""
        weights = [rng.uniform(0.5, 1.5) * (0.6 + 0.08 * i) for i in range(12)]
        scale = sum(weights)
        months = [date(year, m, 1) for m in range(4, 13)] + [date(year + 1, m, 1) for m in range(1, 4)]
        remaining = spent
        for i, month in enumerate(months):
            amount = remaining if i == 11 else (spent * Decimal(str(round(weights[i] / scale, 6)))).quantize(Decimal("0.01"))
            amount = min(amount, remaining)
            remaining -= amount
            SpendingEntry.objects.update_or_create(allocation=alloc, month=month, defaults={"amount": amount})

    def _create_users(self, departments):
        User = get_user_model()
        password = secrets.token_urlsafe(12)
        for username, role in [("demo_admin", "admin"), ("demo_analyst", "analyst"), ("demo_viewer", "viewer")]:
            user, created = User.objects.get_or_create(username=username, defaults={"role": role})
            if created:
                user.set_password(password)
                user.save()
                self.stdout.write(f"Created {username} ({role})")
        self.stdout.write(self.style.WARNING(
            f"Demo user password (shown once, only applied to newly created users): {password}"))
