from django.core.management.base import BaseCommand
from django.db import transaction
from users.models import User
from activities.models import Activity
from swipes.models import Swipe
from matches.models import Match
from reviews.models import Review
from chat.models import Conversation, Message


class Command(BaseCommand):
    help = 'Purge all data from the database (users, activities, swipes, matches, reviews, messages)'

    def add_arguments(self, parser):
        parser.add_argument(
            '--confirm',
            action='store_true',
            help='Confirm that you want to delete all data',
        )

    def handle(self, *args, **options):
        if not options['confirm']:
            self.stdout.write(
                self.style.WARNING(
                    'WARNING: This will delete ALL data from the database!\n'
                    'Users, activities, swipes, matches, reviews, and messages will all be permanently deleted.\n\n'
                    'To proceed, run: python manage.py purge_data --confirm'
                )
            )
            return

        self.stdout.write(self.style.WARNING('Starting data purge...'))

        try:
            with transaction.atomic():
                # Delete in order to handle foreign key relationships
                # Messages and conversations will be deleted via CASCADE
                self.stdout.write('Deleting messages...')
                Message.objects.all().delete()

                self.stdout.write('Deleting conversations...')
                Conversation.objects.all().delete()

                self.stdout.write('Deleting reviews...')
                Review.objects.all().delete()

                self.stdout.write('Deleting swipes...')
                Swipe.objects.all().delete()

                self.stdout.write('Deleting matches...')
                Match.objects.all().delete()

                self.stdout.write('Deleting activities...')
                Activity.objects.all().delete()

                # Finally delete users (this will cascade to related user data)
                self.stdout.write('Deleting users...')
                User.objects.all().delete()

            self.stdout.write(
                self.style.SUCCESS(
                    '✅ Data purge completed successfully!\n'
                    'All users, activities, swipes, matches, reviews, and messages have been deleted.'
                )
            )

        except Exception as e:
            self.stdout.write(
                self.style.ERROR(f'❌ Error during data purge: {str(e)}')
            )
            raise