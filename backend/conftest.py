from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model
from django.core.cache import cache
from rest_framework.test import APIClient

from budgets.models import BudgetAllocation, Department, FiscalYear, PerformanceMetric

User = get_user_model()


@pytest.fixture(autouse=True)
def _clear_throttle_cache():
    cache.clear()
    yield
    cache.clear()


def make_user(role, username=None):
    return User.objects.create_user(username=username or f"u_{role}", password="Str0ng-pass-123", role=role)


@pytest.fixture
def admin_user(db):
    return make_user("admin")


@pytest.fixture
def analyst_user(db):
    return make_user("analyst")


@pytest.fixture
def viewer_user(db):
    return make_user("viewer")


def client_for(user):
    client = APIClient()
    client.force_authenticate(user=user)
    return client


@pytest.fixture
def anon():
    return APIClient()


@pytest.fixture
def admin_client(admin_user):
    return client_for(admin_user)


@pytest.fixture
def analyst_client(analyst_user):
    return client_for(analyst_user)


@pytest.fixture
def viewer_client(viewer_user):
    return client_for(viewer_user)


@pytest.fixture
def world(db):
    """Three departments across two fiscal years with allocations and metrics."""
    fy24 = FiscalYear.objects.create(year=2024, total_budget=Decimal("1000.00"))
    fy25 = FiscalYear.objects.create(year=2025, is_active=True, total_budget=Decimal("1100.00"))
    depts = {c: Department.objects.create(name=n, code=c) for c, n in
             [("HLT", "Health"), ("EDU", "Education"), ("ENV", "Environment")]}
    rows = {
        # (code, year): (allocated, spent, requested)
        ("HLT", fy24): (400, 380, 500), ("EDU", fy24): (400, 390, 450), ("ENV", fy24): (200, 100, 220),
        ("HLT", fy25): (420, 400, 600), ("EDU", fy25): (420, 410, 430), ("ENV", fy25): (210, 90, 300),
    }
    for (code, fy), (a, s, r) in rows.items():
        BudgetAllocation.objects.create(
            department=depts[code], fiscal_year=fy, allocated_amount=Decimal(a),
            spent_amount=Decimal(s), requested_amount=Decimal(r))
    for code, val in {"HLT": 55.0, "EDU": 80.0, "ENV": 70.0}.items():
        for fy in (fy24, fy25):
            PerformanceMetric.objects.create(department=depts[code], fiscal_year=fy,
                                             metric_name="Coverage", metric_value=val, weight=1.0)
    return {"fy24": fy24, "fy25": fy25, "depts": depts}
