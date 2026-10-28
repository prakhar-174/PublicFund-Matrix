import logging

from audit.services import record
from django.db import connection, transaction
from rest_framework import status
from rest_framework.parsers import MultiPartParser
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from users.permissions import IsAdminOrAnalyst

from .services.importer import ImportFileError, read_upload, upsert_allocations, validate_rows

logger = logging.getLogger(__name__)


class BudgetImportView(APIView):
    """POST /api/import/budgets/ (multipart `file`, optional `dry_run=true`).

    All-or-nothing: if any row is invalid nothing is written and every row-level
    error is returned, so the file can be fixed and re-uploaded in one pass.
    """

    permission_classes = [IsAdminOrAnalyst]
    parser_classes = [MultiPartParser]

    def post(self, request):
        uploaded = request.FILES.get("file")
        if uploaded is None:
            return Response({"detail": "Attach a file in the 'file' field."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            df = read_upload(uploaded)
        except ImportFileError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        clean, errors = validate_rows(df)
        if errors:
            return Response(
                {"detail": "Import rejected; no rows were saved.", "rows_total": len(df),
                 "rows_invalid": len(errors), "errors": errors},
                status=status.HTTP_400_BAD_REQUEST,
            )

        dry_run = str(request.data.get("dry_run", "")).lower() in {"1", "true", "yes"}
        if dry_run:
            return Response({"detail": "Validation passed (dry run, nothing saved).", "rows_total": len(df), "dry_run": True})

        with transaction.atomic():
            result = upsert_allocations(clean)
            record(request.user, "import_budgets", "budgetallocation", "",
                   {"filename": uploaded.name, "rows": len(df), **result}, request)
        logger.info("Budget import by %s: %s", request.user.username, result)
        return Response({"detail": "Import complete.", "rows_total": len(df), "dry_run": False, **result},
                        status=status.HTTP_201_CREATED)


class HealthView(APIView):
    """GET /api/health/ (unauthenticated; for load balancers and Docker health checks)."""

    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request):
        try:
            with connection.cursor() as cursor:
                cursor.execute("SELECT 1")
        except Exception:
            logger.exception("Health check: database unreachable")
            return Response({"status": "unhealthy", "database": "unreachable"}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        return Response({"status": "ok", "database": "ok"})
