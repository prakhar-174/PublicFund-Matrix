from django.core.exceptions import ObjectDoesNotExist
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .services.analytics import BudgetAnalyticsService

REPORTS = {
    "year_over_year": {"params": ["department"], "description": "Allocation vs spend per year for a department."},
    "department_comparison": {"params": ["fiscal_year"], "description": "Departments ranked by utilization and performance."},
    "spending_trend": {"params": ["fiscal_year"], "description": "Monthly and quarterly spend progression."},
    "underfunded": {"params": ["fiscal_year", "threshold (optional, default 0.8)"], "description": "Departments funded below the threshold of their request."},
}


def _int_param(request, name):
    raw = request.query_params.get(name)
    if raw is None:
        raise ValueError(f"Query parameter '{name}' is required.")
    try:
        return int(raw)
    except ValueError:
        raise ValueError(f"Query parameter '{name}' must be an integer.")


class AnalyticsView(APIView):
    """GET /api/analytics/?report=<name>&... (read-only for any authenticated user)."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        report = request.query_params.get("report")
        if not report:
            return Response({"available_reports": REPORTS})
        if report not in REPORTS:
            return Response({"detail": f"Unknown report '{report}'.", "available_reports": REPORTS}, status=400)

        service = BudgetAnalyticsService()
        try:
            if report == "year_over_year":
                data = service.get_year_over_year(_int_param(request, "department"))
            elif report == "department_comparison":
                data = service.get_department_comparison(_int_param(request, "fiscal_year"))
            elif report == "spending_trend":
                data = service.get_spending_trend(_int_param(request, "fiscal_year"))
            else:
                threshold = float(request.query_params.get("threshold", 0.8))
                data = service.get_underfunded_departments(_int_param(request, "fiscal_year"), threshold)
        except ObjectDoesNotExist:
            return Response({"detail": "Department or fiscal year not found."}, status=404)
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=400)
        return Response(data)
