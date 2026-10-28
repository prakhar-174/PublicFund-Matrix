import django_filters as df
from django.db.models import Count, Sum
from rest_framework import serializers, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from users.permissions import IsAdminUser

from .models import Approval, OptimizationRun, RecommendedAllocation
from .services.runs import ApprovalError, decide_run

DISCLAIMER = "Decision support requiring human review. Not an approved allocation until a reviewer approves it."


class RecommendedAllocationSerializer(serializers.ModelSerializer):
    department_name = serializers.CharField(source="department.name", read_only=True)
    change_amount = serializers.DecimalField(max_digits=18, decimal_places=2, read_only=True)
    change_percent = serializers.FloatField(read_only=True, allow_null=True)

    class Meta:
        model = RecommendedAllocation
        fields = [
            "id", "department", "department_name", "baseline_allocation", "recommended_allocation",
            "change_amount", "change_percent", "need_score", "need_share", "confidence",
            "data_gaps", "flags", "is_override", "bound_by_stability_cap", "explanation",
        ]
        read_only_fields = fields


class ApprovalSerializer(serializers.ModelSerializer):
    reviewer_username = serializers.CharField(source="reviewer.username", read_only=True, default=None)

    class Meta:
        model = Approval
        fields = ["id", "run", "reviewer", "reviewer_username", "decision", "comments", "decided_at"]
        read_only_fields = fields


class OptimizationRunSerializer(serializers.ModelSerializer):
    fiscal_year_label = serializers.CharField(source="fiscal_year.label", read_only=True)
    created_by_username = serializers.CharField(source="created_by.username", read_only=True, default=None)
    # Annotated in the queryset: no per-row queries.
    total_baseline = serializers.DecimalField(max_digits=18, decimal_places=2, read_only=True)
    total_recommended = serializers.DecimalField(max_digits=18, decimal_places=2, read_only=True)
    department_count = serializers.IntegerField(read_only=True)
    approval = ApprovalSerializer(read_only=True)

    class Meta:
        model = OptimizationRun
        fields = [
            "id", "fiscal_year", "fiscal_year_label", "status", "total_budget", "total_baseline",
            "total_recommended", "department_count", "solver_status", "model_version",
            "created_by", "created_by_username", "created_at", "approval",
        ]
        read_only_fields = fields


class OptimizationRunDetailSerializer(OptimizationRunSerializer):
    allocations = RecommendedAllocationSerializer(many=True, read_only=True)
    disclaimer = serializers.SerializerMethodField()

    class Meta(OptimizationRunSerializer.Meta):
        fields = OptimizationRunSerializer.Meta.fields + ["input_config", "objective_weights", "allocations", "disclaimer"]
        read_only_fields = fields

    def get_disclaimer(self, obj):
        return DISCLAIMER


class DecisionSerializer(serializers.Serializer):
    decision = serializers.ChoiceField(choices=Approval.Decision.choices)
    comments = serializers.CharField(required=False, allow_blank=True, max_length=2000, default="")


class RunFilter(df.FilterSet):
    class Meta:
        model = OptimizationRun
        fields = ["fiscal_year", "status", "created_by"]


class OptimizationRunViewSet(viewsets.ReadOnlyModelViewSet):
    """Saved runs. Created via POST /api/optimizer/ with save=true; never edited or deleted."""

    filterset_class = RunFilter
    ordering_fields = ["created_at", "total_budget", "status"]

    def get_queryset(self):
        qs = OptimizationRun.objects.select_related("fiscal_year", "created_by", "approval__reviewer").annotate(
            total_baseline=Sum("allocations__baseline_allocation"),
            total_recommended=Sum("allocations__recommended_allocation"),
            department_count=Count("allocations"),
        )
        if self.action in ("retrieve", "decision"):
            qs = qs.prefetch_related("allocations__department")
        # annotate() drops Meta.ordering; restate it so pagination is stable.
        return qs.order_by("-created_at", "-id")

    def get_serializer_class(self):
        return OptimizationRunDetailSerializer if self.action == "retrieve" else OptimizationRunSerializer

    @action(detail=True, methods=["post"], permission_classes=[IsAdminUser])
    def decision(self, request, pk=None):
        """Approve or reject a proposed run. Approval applies it to the stored allocations."""
        serializer = DecisionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            run = decide_run(int(pk), request.user, serializer.validated_data["decision"],
                             serializer.validated_data["comments"], request)
        except ApprovalError as exc:
            body = {"detail": exc.message}
            if exc.details:
                body["problems"] = exc.details
            return Response(body, status=exc.status_code)
        return Response(OptimizationRunDetailSerializer(self.get_queryset().get(pk=run.pk)).data)


class ApprovalFilter(df.FilterSet):
    class Meta:
        model = Approval
        fields = ["decision", "reviewer", "run"]


class ApprovalViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Approval.objects.select_related("reviewer", "run")
    serializer_class = ApprovalSerializer
    filterset_class = ApprovalFilter
    ordering_fields = ["decided_at"]
