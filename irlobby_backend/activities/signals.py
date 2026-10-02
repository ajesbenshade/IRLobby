"""Remove an EventPhoto's file from storage whenever its row is deleted."""

import logging

from django.db import transaction
from django.db.models.signals import post_delete
from django.dispatch import receiver

from .models import EventPhoto

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
