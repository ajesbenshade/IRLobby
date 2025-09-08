from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from django.utils import timezone
from datetime import timedelta
import random

from activities.models import Activity, ActivityParticipant

User = get_user_model()

# Sample data for generating realistic test content
FIRST_NAMES = [
    'Alice', 'Bob', 'Charlie', 'Diana', 'Eve', 'Frank', 'Grace', 'Henry',
    'Ivy', 'Jack', 'Kate', 'Liam', 'Mia', 'Noah', 'Olivia', 'Peter',
    'Quinn', 'Ryan', 'Sophia', 'Thomas', 'Uma', 'Victor', 'Wendy', 'Xavier',
    'Yara', 'Zach', 'Anna', 'Brian', 'Clara', 'David', 'Emma', 'Felix'
]

LAST_NAMES = [
    'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller',
    'Davis', 'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez',
    'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin'
]

ACTIVITY_TEMPLATES = [
    {
        'title': 'Hiking in {location}',
        'description': 'Join us for a scenic hike through beautiful trails. Perfect for all skill levels with stunning views and great company.',
        'location': 'Mountain Trail',
        'tags': ['outdoor', 'fitness', 'nature'],
        'capacity': random.randint(8, 15)
    },
    {
        'title': 'Coffee Meetup at {location}',
        'description': 'Casual coffee meetup to chat, network, and enjoy great conversation. Bring your favorite coffee or try something new!',
        'location': 'Local Cafe',
        'tags': ['social', 'casual', 'networking'],
        'capacity': random.randint(6, 12)
    },
    {
        'title': 'Board Game Night at {location}',
        'description': 'Fun evening of board games and strategy. All games provided, just bring your enthusiasm and competitive spirit!',
        'location': 'Game Cafe',
        'tags': ['games', 'strategy', 'social'],
        'capacity': random.randint(6, 10)
    },
    {
        'title': 'Photography Walk in {location}',
        'description': 'Capture the beauty of the city through your lens. Great opportunity to learn from fellow photographers and share techniques.',
        'location': 'Downtown',
        'tags': ['photography', 'art', 'outdoor'],
        'capacity': random.randint(8, 12)
    },
    {
        'title': 'Cooking Class: {cuisine} Cuisine',
        'description': 'Learn to cook authentic {cuisine} dishes in a fun, hands-on environment. All ingredients and equipment provided.',
        'location': 'Community Kitchen',
        'tags': ['cooking', 'food', 'learning'],
        'capacity': random.randint(10, 16)
    },
    {
        'title': 'Yoga Session at {location}',
        'description': 'Relaxing yoga session suitable for all levels. Focus on mindfulness, flexibility, and stress relief.',
        'location': 'Park',
        'tags': ['fitness', 'wellness', 'relaxation'],
        'capacity': random.randint(12, 20)
    },
    {
        'title': 'Book Club Discussion: {genre}',
        'description': 'Engaging discussion about current book selection. Share your thoughts, interpretations, and favorite passages.',
        'location': 'Library',
        'tags': ['books', 'discussion', 'literature'],
        'capacity': random.randint(8, 15)
    },
    {
        'title': 'Volleyball Game at {location}',
        'description': 'Casual volleyball game for all skill levels. Great exercise and team building opportunity.',
        'location': 'Beach',
        'tags': ['sports', 'fitness', 'team'],
        'capacity': random.randint(10, 16)
    }
]

LOCATIONS = [
    'Central Park', 'Riverside Trail', 'Downtown Square', 'Mountain View',
    'Lake Shore', 'City Garden', 'Harbor View', 'Forest Trail',
    'Community Center', 'Local Brewery', 'Art Gallery', 'Music Venue',
    'Sports Complex', 'Yoga Studio', 'Coffee Shop', 'Bookstore'
]

CUISINES = ['Italian', 'Mexican', 'Thai', 'Japanese', 'Mediterranean', 'Indian', 'French', 'Chinese']
GENRES = ['Mystery', 'Science Fiction', 'Romance', 'Biography', 'History', 'Self-Help', 'Fantasy', 'Thriller']

class Command(BaseCommand):
    help = 'Populate database with test users and activities'

    def add_arguments(self, parser):
        parser.add_argument(
            '--users',
            type=int,
            default=30,
            help='Number of test users to create',
        )
        parser.add_argument(
            '--activities',
            type=int,
            default=50,
            help='Number of test activities to create',
        )

    def handle(self, *args, **options):
        num_users = options['users']
        num_activities = options['activities']

        self.stdout.write(self.style.WARNING(f'Creating {num_users} test users and {num_activities} test activities...'))

        # Create test users
        users = self.create_test_users(num_users)

        # Create test activities
        activities = self.create_test_activities(num_activities, users)

        # Add some users to activities
        self.create_participants(users, activities)

        self.stdout.write(self.style.SUCCESS(
            f'Successfully created {len(users)} users and {len(activities)} activities!'
        ))

    def create_test_users(self, count):
        users = []
        existing_usernames = set(User.objects.values_list('username', flat=True))

        for i in range(count):
            first_name = random.choice(FIRST_NAMES)
            last_name = random.choice(LAST_NAMES)
            username = f"{first_name.lower()}{last_name.lower()}{i}"

            # Ensure unique username
            counter = 0
            original_username = username
            while username in existing_usernames:
                counter += 1
                username = f"{original_username}{counter}"

            email = f"{username}@example.com"

            user = User.objects.create_user(
                username=username,
                email=email,
                password='testpass123',
                first_name=first_name,
                last_name=last_name,
                bio=f"Hi! I'm {first_name} and I love meeting new people and trying new activities!",
                location=random.choice(LOCATIONS),
                latitude=round(random.uniform(40.0, 45.0), 6),
                longitude=round(random.uniform(-75.0, -70.0), 6)
            )
            users.append(user)
            existing_usernames.add(username)

        self.stdout.write(f'Created {len(users)} test users')
        return users

    def create_test_activities(self, count, users):
        activities = []

        for i in range(count):
            # Select random user as host
            host = random.choice(users)

            # Select random activity template
            template = random.choice(ACTIVITY_TEMPLATES).copy()

            # Customize template with random data
            location = random.choice(LOCATIONS)
            title = template['title'].format(
                location=location,
                cuisine=random.choice(CUISINES) if '{cuisine}' in template['title'] else '',
                genre=random.choice(GENRES) if '{genre}' in template['title'] else ''
            )

            description = template['description'].format(
                cuisine=random.choice(CUISINES) if '{cuisine}' in template['description'] else '',
                genre=random.choice(GENRES) if '{genre}' in template['description'] else ''
            )

            # Generate random time (next 30 days)
            days_ahead = random.randint(1, 30)
            hours_ahead = random.randint(1, 23)
            activity_time = timezone.now() + timedelta(days=days_ahead, hours=hours_ahead)

            activity = Activity.objects.create(
                host=host,
                title=title,
                description=description,
                location=location,
                latitude=round(random.uniform(40.0, 45.0), 6),
                longitude=round(random.uniform(-75.0, -70.0), 6),
                time=activity_time,
                capacity=template['capacity'],
                tags=template['tags']
            )
            activities.append(activity)

        self.stdout.write(f'Created {len(activities)} test activities')
        return activities

    def create_participants(self, users, activities):
        participants_created = 0

        for activity in activities:
            # Skip activities that are full
            if activity.participants.count() >= activity.capacity:
                continue

            # Random number of participants (1-70% of capacity)
            num_participants = random.randint(1, max(1, int(activity.capacity * 0.7)))

            # Select random users (excluding the host)
            available_users = [u for u in users if u != activity.host]
            selected_users = random.sample(available_users, min(num_participants, len(available_users)))

            for user in selected_users:
                # Check if user is already a participant
                if not ActivityParticipant.objects.filter(activity=activity, user=user).exists():
                    # 80% chance of confirmed, 20% pending
                    status = 'confirmed' if random.random() < 0.8 else 'pending'
                    ActivityParticipant.objects.create(
                        activity=activity,
                        user=user,
                        status=status
                    )
                    participants_created += 1

        self.stdout.write(f'Created {participants_created} activity participants')
