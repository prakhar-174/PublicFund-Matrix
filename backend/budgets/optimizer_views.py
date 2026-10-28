from decimal import Decimal

from django.core.exceptions import ObjectDoesNotExist
from rest_framework import serializers, status
from rest_framework.response import Response
from rest_framework.views import APIView

from users.permissions import IsAdminOrAnalyst

from .services.runs import create_run
from .services.optimizer import (
    DEFAULT_MAX_CHANGE_PCT,
    W_PERFORMANCE_GAP,
    W_UNDERFUNDING,
    BudgetOptimizer,
    OptimizationError,
)


class OptimizerRequestSerializer(serializers.Serializer):
    fiscal_year = serializers.IntegerField()
    total_budget = serializers.DecimalField(max_digits=18, decimal_places=2, required=False, min_value=Decimal("0"))
    # Omit for the default cap; send null to disable the cap entirely.
    max_change_pct = serializers.FloatField(required=False, allow_null=True, min_value=0)
    overrides = serializers.DictField(child=serializers.DecimalField(max_digits=18, decimal_places=2), required=False)
    # False (default) = preview only. True stores the result as a proposed run for review.
    save = serializers.BooleanField(required=False, default=False)


class OptimizerView(APIView):
    """POST /api/optimizer/ : compute recommendations. Never writes to stored allocations."""

    permission_classes = [IsAdminOrAnalyst]

    def post(self, request):
        serializer = OptimizerRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        max_change = data.get("max_change_pct", DEFAULT_MAX_CHANGE_PCT)
        overrides = data.get("overrides") or {}

        optimizer = BudgetOptimizer(max_change_pct=max_change)
        try:
            if overrides:
                rows = optimizer.run_scenario(data["fiscal_year"], overrides, data.get("total_budget"))
            else:
                rows = optimizer.generate_recommendations(data["fiscal_year"], data.get("total_budget"))
        except ObjectDoesNotExist:
            return Response({"detail": "Fiscal year not found."}, status=status.HTTP_404_NOT_FOUND)
        except OptimizationError as exc:
            return Response({"detail": str(exc), "feasible": False}, status=status.HTTP_422_UNPROCESSABLE_ENTITY)

        run_id = None
        if data["save"]:
            config = {
                "requested_total_budget": data.get("total_budget"),
                "max_change_pct": max_change,
                "overrides": overrides,
            }
            run_id = create_run(request.user, data["fiscal_year"], rows, config, request).pk

        return Response(
            {
                "feasible": True,
                "run_id": run_id,
                "saved": run_id is not None,
                "fiscal_year": data["fiscal_year"],
                "total_current": sum((r["current_allocation"] for r in rows), Decimal("0")),
                "total_recommended": sum((r["recommended_allocation"] for r in rows), Decimal("0")),
                "assumptions": {
                    "need_score": f"{W_PERFORMANCE_GAP:.0%} performance gap + {W_UNDERFUNDING:.0%} historical underfunding",
                    "max_change_pct": max_change,
                    "overrides_applied": len(overrides),
                    "missing_data": "Median value used and confidence reduced; missing data is never treated as low need.",
                },
                "disclaimer": (
                    "Decision support requiring human review. Recommendations are not approved allocations, "
                    "and no stored budget was changed. A saved run only takes effect if a reviewer approves it."
                ),
                "allocations": rows,
            }
        )
