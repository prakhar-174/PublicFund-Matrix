from django.db.models import Count, ProtectedError, Sum
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from audit.mixins import AuditedModelViewSetMixin
from users.permissions import IsAdminOrAnalystOrReadOnly, IsAdminOrReadOnly

from .filters import (
    BudgetAllocationFilter,
    DepartmentFilter,
    FiscalYearFilter,
    PerformanceMetricFilter,
)
from .models import BudgetAllocation, Department, FiscalYear, PerformanceMetric
from .serializers import (
    BudgetAllocationSerializer,
    DepartmentSerializer,
    FiscalYearSerializer,
    PerformanceMetricSerializer,
)


class ProtectedDeleteMixin:
    """Return 409 (not 500) when a delete is blocked by dependent financial records."""

    def destroy(self, request, *args, **kwargs):
        try:
            return super().destroy(request, *args, **kwargs)
        except ProtectedError:
            return Response(
                {"detail": "Cannot delete: budget records still reference this item."},
                status=status.HTTP_409_CONFLICT,
            )


class DepartmentViewSet(AuditedModelViewSetMixin, ProtectedDeleteMixin, viewsets.ModelViewSet):
    queryset = Department.objects.all()
    serializer_class = DepartmentSerializer
    permission_classes = [IsAdminOrReadOnly]
    filterset_class = DepartmentFilter
    search_fields = ["name", "code", "head_name"]
    ordering_fields = ["name", "code", "created_at"]

    @action(detail=True, methods=["get"], permission_classes=[IsAdminOrAnalystOrReadOnly])
    def budget_history(self, request, pk=None):
        """All allocations for this department across fiscal years, oldest first."""
        department = self.get_object()
        allocations = (
            BudgetAllocation.objects.filter(department=department)
            .select_related("department", "fiscal_year", "approved_by")
            .order_by("fiscal_year__year")
        )
        serializer = BudgetAllocationSerializer(allocations, many=True, context={"request": request})
        return Response(
            {
                "department": DepartmentSerializer(department).data,
                "history": serializer.data,
            }
        )


class FiscalYearViewSet(AuditedModelViewSetMixin, ProtectedDeleteMixin, viewsets.ModelViewSet):
    queryset = FiscalYear.objects.all()
    serializer_class = FiscalYearSerializer
    permission_classes = [IsAdminOrReadOnly]
    filterset_class = FiscalYearFilter
    ordering_fields = ["year", "total_budget"]

    @action(detail=True, methods=["get"])
    def summary(self, request, pk=None):
        """Totals for one fiscal year, aggregated in the database."""
        fiscal_year = self.get_object()
        totals = BudgetAllocation.objects.filter(fiscal_year=fiscal_year).aggregate(
            total_allocated=Sum("allocated_amount"),
            total_spent=Sum("spent_amount"),
            total_requested=Sum("requested_amount"),
            department_count=Count("department", distinct=True),
        )
        allocated = totals["total_allocated"] or 0
        spent = totals["total_spent"] or 0
        return Response(
            {
                "fiscal_year": FiscalYearSerializer(fiscal_year).data,
                "total_allocated": allocated,
                "total_spent": spent,
                "total_requested": totals["total_requested"] or 0,
                "total_unspent": allocated - spent,
                # None (not 0) when nothing is allocated: utilization is undefined.
                "utilization_rate": float(spent) / float(allocated) if allocated else None,
                "unallocated_budget": fiscal_year.total_budget - allocated,
                "department_count": totals["department_count"],
            }
        )


class BudgetAllocationViewSet(AuditedModelViewSetMixin, viewsets.ModelViewSet):
    queryset = BudgetAllocation.objects.select_related("department", "fiscal_year", "approved_by")
    serializer_class = BudgetAllocationSerializer
    permission_classes = [IsAdminOrAnalystOrReadOnly]
    filterset_class = BudgetAllocationFilter
    search_fields = ["department__name", "department__code"]
    ordering_fields = ["allocated_amount", "spent_amount", "requested_amount", "fiscal_year__year", "department__name"]


class PerformanceMetricViewSet(AuditedModelViewSetMixin, viewsets.ModelViewSet):
    queryset = PerformanceMetric.objects.select_related("department", "fiscal_year")
    serializer_class = PerformanceMetricSerializer
    permission_classes = [IsAdminOrAnalystOrReadOnly]
    filterset_class = PerformanceMetricFilter
    search_fields = ["metric_name", "department__name"]
    ordering_fields = ["metric_value", "weight", "metric_name", "fiscal_year__year"]
