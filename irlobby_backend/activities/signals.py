"""Remove an EventPhoto's file from storage whenever its row is deleted, and log every
gathering created (the weekly hosting limit counts the log, which outlives the gathering)."""

import logging

from django.db import transaction
from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver
from django.utils import timezone

from .models import Activity, EventCreationLog, EventPhoto

logger = logging.getLogger(__name__)


def _delete_stored_file(storage, name):
    try:
        storage.delete(name)
    except Exception:  # pragma: no cover - a missing/locked file must not break deletion
        logger.warning("Could not remove stored photo file %s", name)


@receiver(post_delete, sender=EventPhoto, dispatch_uid="remove_event_photo_file")
def remove_event_photo_file(sender, instance, **kwargs):
    """Runs for every delete path: the host's delete, a cancelled/deleted gathering, a deleted
    account. The file goes only once the surrounding transaction commits."""
    name = instance.image.name if instance.image else ""
    if not name:
        return
    storage = instance.image.storage
    transaction.on_commit(lambda: _delete_stored_file(storage, name))


@receiver(post_save, sender=Activity, dispatch_uid="log_event_creation")
def log_event_creation(sender, instance, created, raw=False, **kwargs):
    """Every creation path (API, admin, seed commands) leaves a durable row."""
    if not created or raw:
        return
    EventCreationLog.objects.create(
        user_id=instance.host_id,
        activity_id=instance.id,
        created_at=instance.created_at or timezone.now(),
    )
