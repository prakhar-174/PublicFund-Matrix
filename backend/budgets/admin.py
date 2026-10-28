from django.contrib import admin

from .models import BudgetAllocation, Department, FiscalYear, PerformanceMetric, SpendingEntry


@admin.register(Department)
class DepartmentAdmin(admin.ModelAdmin):
    list_display = ("name", "code", "head_name")
    search_fields = ("name", "code")


@admin.register(FiscalYear)
class FiscalYearAdmin(admin.ModelAdmin):
    list_display = ("year", "is_active", "total_budget")


@admin.register(BudgetAllocation)
class BudgetAllocationAdmin(admin.ModelAdmin):
    list_display = ("department", "fiscal_year", "allocated_amount", "spent_amount", "status")
    list_filter = ("fiscal_year", "status")
    list_select_related = ("department", "fiscal_year")


@admin.register(PerformanceMetric)
class PerformanceMetricAdmin(admin.ModelAdmin):
    list_display = ("department", "fiscal_year", "metric_name", "metric_value", "weight")
    list_filter = ("fiscal_year",)
    list_select_related = ("department", "fiscal_year")


admin.site.register(SpendingEntry)
