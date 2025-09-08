from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from activities.models import Activity, ActivityParticipant
from matches.models import Match
from swipes.models import Swipe
from chat.models import Message
from reviews.models import Review

User = get_user_model()

class Command(BaseCommand):
    help = 'Purge all users and related data from the database'

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
                    'This will DELETE ALL users and related data permanently!\n'
                    'Use --confirm to proceed.'
                )
            )
            return

        self.stdout.write(self.style.WARNING('Starting database purge...'))

        # Delete in order to respect foreign key constraints
        deleted_counts = {}

        # Delete reviews
        deleted_counts['reviews'] = Review.objects.all().delete()[0]

        # Delete messages
        deleted_counts['messages'] = Message.objects.all().delete()[0]

        # Delete matches
        deleted_counts['matches'] = Match.objects.all().delete()[0]

        # Delete swipes
        deleted_counts['swipes'] = Swipe.objects.all().delete()[0]

        # Delete activity participants
        deleted_counts['activity_participants'] = ActivityParticipant.objects.all().delete()[0]

        # Delete activities
        deleted_counts['activities'] = Activity.objects.all().delete()[0]

        # Finally delete users (this will cascade to related auth data)
        deleted_counts['users'] = User.objects.all().delete()[0]

        self.stdout.write(self.style.SUCCESS('Database purge completed!'))
        self.stdout.write('Deleted records:')
        for model_name, count in deleted_counts.items():
            self.stdout.write(f'  {model_name}: {count}')

        total_deleted = sum(deleted_counts.values())
        self.stdout.write(self.style.SUCCESS(f'Total records deleted: {total_deleted}'))
