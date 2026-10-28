from django.conf import settings
from django.core.serializers.json import DjangoJSONEncoder
from django.db import models
from django.utils import timezone


class AppendOnlyQuerySet(models.QuerySet):
    """Audit rows can be created and read, never changed or removed through the ORM."""

    def update(self, **kwargs):
        raise PermissionError("Audit log entries are immutable.")

    def delete(self):
        raise PermissionError("Audit log entries cannot be deleted.")


class AuditLog(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="audit_logs"
    )
    # Snapshot, so the trail still names the actor if the account is later removed.
    username = models.CharField(max_length=150, blank=True)
    action = models.CharField(max_length=50)
    entity_type = models.CharField(max_length=60)
    entity_id = models.CharField(max_length=64, blank=True)
    timestamp = models.DateTimeField(default=timezone.now)
    metadata = models.JSONField(default=dict, blank=True, encoder=DjangoJSONEncoder)
    ip_address = models.GenericIPAddressField(null=True, blank=True)

    objects = AppendOnlyQuerySet.as_manager()

    class Meta:
        ordering = ["-timestamp", "-id"]
        indexes = [
            models.Index(fields=["entity_type", "entity_id"], name="audit_entity_idx"),
            models.Index(fields=["user", "timestamp"], name="audit_user_time_idx"),
            models.Index(fields=["action", "timestamp"], name="audit_action_time_idx"),
        ]

    def save(self, *args, **kwargs):
        if not self._state.adding:
            raise PermissionError("Audit log entries are immutable.")
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        raise PermissionError("Audit log entries cannot be deleted.")

    def __str__(self):
        return f"{self.timestamp:%Y-%m-%d %H:%M} {self.username or 'anonymous'} {self.action} {self.entity_type}:{self.entity_id}"
