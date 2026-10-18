"""List (and optionally delete) gathering photo files that no EventPhoto row points at.

Dry run by default: nothing is removed unless ``--delete`` is passed.

    python manage.py find_orphan_photos            # list orphans
    python manage.py find_orphan_photos --delete   # remove them
"""

from __future__ import annotations

from django.core.files.storage import default_storage
from django.core.management.base import BaseCommand

from activities.models import EventPhoto

PHOTO_DIR = "event_photos"


def orphan_photo_names(storage=default_storage) -> list[str]:
    try:
        _dirs, files = storage.listdir(PHOTO_DIR)
    except (FileNotFoundError, NotADirectoryError, OSError):
        return []
    known = set(EventPhoto.objects.exclude(image="").values_list("image", flat=True))
    names = (f"{PHOTO_DIR}/{name}" for name in files)
    return sorted(name for name in names if name not in known)


class Command(BaseCommand):
    help = "Find gathering photo files in media storage with no matching EventPhoto row."

    def add_arguments(self, parser):
        parser.add_argument(
            "--delete",
            action="store_true",
            help="Remove the orphan files. Without this flag the command only lists them.",
        )

    def handle(self, *args, **options):
        orphans = orphan_photo_names()
        for name in orphans:
            self.stdout.write(name)
        if options["delete"]:
            for name in orphans:
                try:
                    default_storage.delete(name)
                except OSError as exc:  # pragma: no cover - keep going past one bad file
                    self.stderr.write(f"Could not delete {name}: {exc}")
            self.stdout.write(f"Deleted {len(orphans)} orphan photo file(s).")
        else:
            self.stdout.write(
                f"{len(orphans)} orphan photo file(s) found (dry run; pass --delete to remove)."
            )
        return None
