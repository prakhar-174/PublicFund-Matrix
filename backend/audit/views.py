import django_filters as df
from rest_framework import viewsets

from users.permissions import IsAdminUser

from .models import AuditLog
from .serializers import AuditLogSerializer


class AuditLogFilter(df.FilterSet):
    since = df.IsoDateTimeFilter(field_name="timestamp", lookup_expr="gte")
    until = df.IsoDateTimeFilter(field_name="timestamp", lookup_expr="lte")

    class Meta:
        model = AuditLog
        fields = ["user", "action", "entity_type", "entity_id"]


class AuditLogViewSet(viewsets.ReadOnlyModelViewSet):
    """Admin-only, read-only. There is deliberately no write endpoint."""

    queryset = AuditLog.objects.select_related("user")
    serializer_class = AuditLogSerializer
    permission_classes = [IsAdminUser]
    filterset_class = AuditLogFilter
    search_fields = ["username", "entity_id"]
    ordering_fields = ["timestamp", "action", "entity_type"]
