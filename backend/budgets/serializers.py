from rest_framework import serializers

from .models import BudgetAllocation, Department, FiscalYear, PerformanceMetric, SpendingEntry


class DepartmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Department
        fields = ["id", "name", "code", "description", "head_name", "created_at"]
        read_only_fields = ["id", "created_at"]

    def validate_code(self, value):
        return value.strip().upper()


class FiscalYearSerializer(serializers.ModelSerializer):
    label = serializers.CharField(read_only=True)

    class Meta:
        model = FiscalYear
        fields = ["id", "year", "label", "is_active", "total_budget"]
        read_only_fields = ["id"]

    def validate_year(self, value):
        if not 1950 <= value <= 2100:
            raise serializers.ValidationError("Year must be between 1950 and 2100.")
        return value


class BudgetAllocationSerializer(serializers.ModelSerializer):
    # Nested, read-only context so clients need no extra lookups.
    department_detail = DepartmentSerializer(source="department", read_only=True)
    department_name = serializers.CharField(source="department.name", read_only=True)
    fiscal_year_label = serializers.CharField(source="fiscal_year.label", read_only=True)
    fiscal_year_detail = FiscalYearSerializer(source="fiscal_year", read_only=True)
    unspent_amount = serializers.DecimalField(max_digits=18, decimal_places=2, read_only=True)
    utilization_rate = serializers.FloatField(read_only=True, allow_null=True)
    approved_by_username = serializers.CharField(source="approved_by.username", read_only=True, default=None)

    class Meta:
        model = BudgetAllocation
        fields = [
            "id", "department", "department_name", "department_detail",
            "fiscal_year", "fiscal_year_label", "fiscal_year_detail",
            "allocated_amount", "spent_amount", "requested_amount",
            "unspent_amount", "utilization_rate",
            "status", "approved_by", "approved_by_username",
        ]
        # approved_by is set by the server on approval; never accepted from clients.
        read_only_fields = ["id", "approved_by"]

    def validate(self, attrs):
        for field in ("allocated_amount", "spent_amount", "requested_amount"):
            if attrs.get(field) is not None and attrs[field] < 0:
                raise serializers.ValidationError({field: "Must not be negative."})

        # Only administrators may mark an allocation approved.
        status = attrs.get("status")
        request = self.context.get("request")
        user = getattr(request, "user", None)
        if status == BudgetAllocation.Status.APPROVED and not (user and user.is_admin_role):
            raise serializers.ValidationError({"status": "Only an administrator can approve an allocation."})
        return attrs

    def create(self, validated_data):
        self._stamp_approver(validated_data)
        return super().create(validated_data)

    def update(self, instance, validated_data):
        self._stamp_approver(validated_data)
        return super().update(instance, validated_data)

    def _stamp_approver(self, validated_data):
        if validated_data.get("status") == BudgetAllocation.Status.APPROVED:
            validated_data["approved_by"] = self.context["request"].user


class PerformanceMetricSerializer(serializers.ModelSerializer):
    department_name = serializers.CharField(source="department.name", read_only=True)
    fiscal_year_label = serializers.CharField(source="fiscal_year.label", read_only=True)

    class Meta:
        model = PerformanceMetric
        fields = [
            "id", "department", "department_name", "fiscal_year", "fiscal_year_label",
            "metric_name", "metric_value", "weight", "description",
        ]
        read_only_fields = ["id"]

    def validate_metric_value(self, value):
        if not 0 <= value <= 100:
            raise serializers.ValidationError("Metric values are scored on a 0 to 100 scale.")
        return value

    def validate_weight(self, value):
        if value <= 0:
            raise serializers.ValidationError("Weight must be greater than zero.")
        return value


class SpendingEntrySerializer(serializers.ModelSerializer):
    class Meta:
        model = SpendingEntry
        fields = ["id", "allocation", "month", "amount"]
        read_only_fields = ["id"]
