from django.db import transaction

from .services import diff, record, snapshot


class AuditedModelViewSetMixin:
    """Record create/update/delete in the audit trail, atomically with the change itself.

    If the audit write fails the change is rolled back, so no sensitive change goes unlogged.
    """

    def _entity(self, instance) -> str:
        return instance._meta.model_name

    def perform_create(self, serializer):
        with transaction.atomic():
            instance = serializer.save()
            record(self.request.user, "create", self._entity(instance), instance.pk,
                   {"values": snapshot(instance)}, self.request)

    def perform_update(self, serializer):
        with transaction.atomic():
            before = snapshot(serializer.instance)
            instance = serializer.save()
            changes = diff(before, snapshot(instance))
            if changes:
                record(self.request.user, "update", self._entity(instance), instance.pk,
                       {"changes": changes}, self.request)

    def perform_destroy(self, instance):
        with transaction.atomic():
            values, pk, entity = snapshot(instance), instance.pk, self._entity(instance)
            instance.delete()
            record(self.request.user, "delete", entity, pk, {"values": values}, self.request)
