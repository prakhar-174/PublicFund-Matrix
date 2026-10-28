"""Helpers for writing audit entries. Call inside the same transaction as the change."""
from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal

from .models import AuditLog

# Never written to the trail.
SENSITIVE_FIELDS = {"password"}


def _jsonable(value):
    if isinstance(value, Decimal):
        return str(value)
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    return value


def snapshot(instance) -> dict:
    """Concrete field values of a model instance as a JSON-safe dict (secrets excluded)."""
    return {
        f.attname: _jsonable(getattr(instance, f.attname))
        for f in instance._meta.concrete_fields
        if f.name not in SENSITIVE_FIELDS
    }


def diff(before: dict, after: dict) -> dict:
    return {k: {"from": before.get(k), "to": after[k]} for k in after if before.get(k) != after[k]}


def client_ip(request):
    if request is None:
        return None
    forwarded = request.META.get("HTTP_X_FORWARDED_FOR")
    return (forwarded.split(",")[0].strip() if forwarded else request.META.get("REMOTE_ADDR")) or None


def record(user, action: str, entity_type: str, entity_id="", metadata: dict | None = None, request=None) -> AuditLog:
    actor = user if getattr(user, "is_authenticated", False) else None
    meta = dict(metadata or {})
    return AuditLog.objects.create(
        user=actor,
        username=actor.get_username() if actor else str(meta.get("username", "")),
        action=action,
        entity_type=entity_type,
        entity_id=str(entity_id),
        metadata=meta,
        ip_address=client_ip(request),
    )
