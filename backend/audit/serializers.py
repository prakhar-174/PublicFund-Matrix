from rest_framework import serializers

from .models import AuditLog


class AuditLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = AuditLog
        fields = ["id", "user", "username", "action", "entity_type", "entity_id", "timestamp", "metadata", "ip_address"]
        read_only_fields = fields
