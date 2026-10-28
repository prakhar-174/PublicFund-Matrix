from django.contrib import admin
from django.urls import include, path
from rest_framework.routers import DefaultRouter

from audit.views import AuditLogViewSet
from budgets.analytics_views import AnalyticsView
from budgets.run_views import ApprovalViewSet, OptimizationRunViewSet
from budgets.import_views import BudgetImportView, HealthView
from budgets.optimizer_views import OptimizerView
from budgets.views import (
    BudgetAllocationViewSet,
    DepartmentViewSet,
    FiscalYearViewSet,
    PerformanceMetricViewSet,
)

router = DefaultRouter()
router.register("departments", DepartmentViewSet, basename="department")
router.register("fiscal-years", FiscalYearViewSet, basename="fiscal-year")
router.register("budget-allocations", BudgetAllocationViewSet, basename="budget-allocation")
router.register("performance-metrics", PerformanceMetricViewSet, basename="performance-metric")
router.register("optimization-runs", OptimizationRunViewSet, basename="optimization-run")
router.register("approvals", ApprovalViewSet, basename="approval")
router.register("audit-logs", AuditLogViewSet, basename="audit-log")

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/auth/", include("users.urls")),
    path("api/health/", HealthView.as_view(), name="health"),
    path("api/analytics/", AnalyticsView.as_view(), name="analytics"),
    path("api/optimizer/", OptimizerView.as_view(), name="optimizer"),
    path("api/import/budgets/", BudgetImportView.as_view(), name="import-budgets"),
    path("api/", include(router.urls)),
]
