"""Backward-compatible wrapper around seed_beta_events.

Historically this command created sparse demo users/activities without photos
or approval. Prefer `seed_beta_events` going forward; this entry point remains
so existing docs and scripts keep working.
"""

from django.core.management import call_command
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = "Seed the database with sample users and swipeable activities (delegates to seed_beta_events)."

    def add_arguments(self, parser):
        parser.add_argument(
            "--hub",
            default="youngstown",
            help="City hub passed through to seed_beta_events.",
        )
        parser.add_argument(
            "--password",
            default="BetaHost-pass-123!",
            help="Password for seeded host accounts.",
        )

    def handle(self, *args, **options):
        self.stdout.write("Delegating to seed_beta_events...")
        call_command(
            "seed_beta_events",
            hub=options["hub"],
            password=options["password"],
        )
