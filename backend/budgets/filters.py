import django_filters as df

from .models import BudgetAllocation, Department, FiscalYear, PerformanceMetric


class DepartmentFilter(df.FilterSet):
    name = df.CharFilter(lookup_expr="icontains")
    code = df.CharFilter(lookup_expr="iexact")

    class Meta:
        model = Department
        fields = ["name", "code"]


class FiscalYearFilter(df.FilterSet):
    class Meta:
        model = FiscalYear
        fields = ["year", "is_active"]


class BudgetAllocationFilter(df.FilterSet):
    min_allocated = df.NumberFilter(field_name="allocated_amount", lookup_expr="gte")
    max_allocated = df.NumberFilter(field_name="allocated_amount", lookup_expr="lte")

    class Meta:
        model = BudgetAllocation
        fields = ["fiscal_year", "department", "status"]


class PerformanceMetricFilter(df.FilterSet):
    class Meta:
        model = PerformanceMetric
        fields = ["fiscal_year", "department", "metric_name"]
