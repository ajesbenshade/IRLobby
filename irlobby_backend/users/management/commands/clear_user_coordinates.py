"""Set every member's stored latitude/longitude to null.

Dry run by default: prints how many accounts have coordinates and changes nothing.
Pass ``--apply`` to write. Run by hand only; never part of a migration or deploy.
Gathering (Activity) coordinates are not touched.

    python manage.py clear_user_coordinates          # count only
    python manage.py clear_user_coordinates --apply  # clear them
"""

from django.core.management.base import BaseCommand
from django.db.models import Q

from users.models import User


class Command(BaseCommand):
    help = "Clear User.latitude/longitude for all users (dry run unless --apply)."

    def add_arguments(self, parser):
        parser.add_argument(
            "--apply",
            action="store_true",
            help="Write the change. Without it the command only prints the count.",
        )

    def handle(self, *args, **options):
        with_coords = User.objects.filter(Q(latitude__isnull=False) | Q(longitude__isnull=False))
        count = with_coords.count()
        if not options["apply"]:
            self.stdout.write(
                f"{count} user(s) have stored coordinates (dry run; pass --apply to clear)."
            )
            return
        updated = with_coords.update(latitude=None, longitude=None)
        self.stdout.write(f"Cleared coordinates for {updated} user(s).")
