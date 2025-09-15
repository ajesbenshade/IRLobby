from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from django.utils import timezone
from datetime import timedelta
import random
from activities.models import Activity, ActivityParticipant

User = get_user_model()

class Command(BaseCommand):
    help = 'Seed the database with sample users and activities'

    def handle(self, *args, **options):
        self.stdout.write('Seeding database with sample data...')

        # Create sample users
        users_data = [
            {
                'username': 'alice_smith',
                'email': 'alice@example.com',
                'first_name': 'Alice',
                'last_name': 'Smith',
                'bio': 'Love hiking and outdoor adventures!',
                'location': 'San Francisco, CA',
                'latitude': 37.7749,
                'longitude': -122.4194,
                'preferences': {'interests': ['hiking', 'photography', 'camping']}
            },
            {
                'username': 'bob_johnson',
                'email': 'bob@example.com',
                'first_name': 'Bob',
                'last_name': 'Johnson',
                'bio': 'Foodie and cooking enthusiast',
                'location': 'New York, NY',
                'latitude': 40.7128,
                'longitude': -74.0060,
                'preferences': {'interests': ['cooking', 'food', 'wine']}
            },
            {
                'username': 'carol_davis',
                'email': 'carol@example.com',
                'first_name': 'Carol',
                'last_name': 'Davis',
                'bio': 'Yoga instructor and wellness coach',
                'location': 'Los Angeles, CA',
                'latitude': 34.0522,
                'longitude': -118.2437,
                'preferences': {'interests': ['yoga', 'meditation', 'wellness']}
            },
            {
                'username': 'david_wilson',
                'email': 'david@example.com',
                'first_name': 'David',
                'last_name': 'Wilson',
                'bio': 'Tech entrepreneur and gamer',
                'location': 'Seattle, WA',
                'latitude': 47.6062,
                'longitude': -122.3321,
                'preferences': {'interests': ['gaming', 'technology', 'board games']}
            },
            {
                'username': 'emma_brown',
                'email': 'emma@example.com',
                'first_name': 'Emma',
                'last_name': 'Brown',
                'bio': 'Artist and museum lover',
                'location': 'Chicago, IL',
                'latitude': 41.8781,
                'longitude': -87.6298,
                'preferences': {'interests': ['art', 'museums', 'painting']}
            },
            {
                'username': 'frank_miller',
                'email': 'frank@example.com',
                'first_name': 'Frank',
                'last_name': 'Miller',
                'bio': 'Fitness trainer and sports enthusiast',
                'location': 'Miami, FL',
                'latitude': 25.7617,
                'longitude': -80.1918,
                'preferences': {'interests': ['fitness', 'sports', 'running']}
            },
            {
                'username': 'grace_lee',
                'email': 'grace@example.com',
                'first_name': 'Grace',
                'last_name': 'Lee',
                'bio': 'Book lover and writer',
                'location': 'Boston, MA',
                'latitude': 42.3601,
                'longitude': -71.0589,
                'preferences': {'interests': ['books', 'writing', 'literature']}
            },
            {
                'username': 'henry_garcia',
                'email': 'henry@example.com',
                'first_name': 'Henry',
                'last_name': 'Garcia',
                'bio': 'Music producer and DJ',
                'location': 'Austin, TX',
                'latitude': 30.2672,
                'longitude': -97.7431,
                'preferences': {'interests': ['music', 'dj', 'concerts']}
            }
        ]

        # Create users
        users = []
        for user_data in users_data:
            user, created = User.objects.get_or_create(
                username=user_data['username'],
                defaults={
                    'email': user_data['email'],
                    'first_name': user_data['first_name'],
                    'last_name': user_data['last_name'],
                    'bio': user_data['bio'],
                    'location': user_data['location'],
                    'latitude': user_data['latitude'],
                    'longitude': user_data['longitude'],
                    'preferences': user_data['preferences']
                }
            )
            if created:
                user.set_password('password123')  # Set a default password
                user.save()
                self.stdout.write(f'Created user: {user.username}')
            users.append(user)

        # Create sample activities
        activities_data = [
            {
                'title': 'Golden Gate Park Hiking',
                'description': 'Join us for a scenic hike through Golden Gate Park! We\'ll explore the trails, enjoy the views, and have a picnic lunch.',
                'location': 'Golden Gate Park, San Francisco, CA',
                'latitude': 37.7694,
                'longitude': -122.4862,
                'capacity': 8,
                'tags': ['hiking', 'outdoors', 'nature'],
                'hours_from_now': 48  # 2 days from now
            },
            {
                'title': 'Italian Cooking Class',
                'description': 'Learn to make authentic Italian pasta from scratch! We\'ll cover dough making, sauce recipes, and wine pairing.',
                'location': 'Culinary Institute, New York, NY',
                'latitude': 40.7589,
                'longitude': -73.9851,
                'capacity': 12,
                'tags': ['cooking', 'food', 'italian'],
                'hours_from_now': 72  # 3 days from now
            },
            {
                'title': 'Sunset Yoga Session',
                'description': 'Relax and rejuvenate with a beautiful sunset yoga session overlooking the ocean. All levels welcome!',
                'location': 'Venice Beach, Los Angeles, CA',
                'latitude': 33.9850,
                'longitude': -118.4695,
                'capacity': 15,
                'tags': ['yoga', 'wellness', 'meditation'],
                'hours_from_now': 24  # 1 day from now
            },
            {
                'title': 'Board Game Night',
                'description': 'Come join us for an evening of board games and strategy! We have Settlers of Catan, Ticket to Ride, and more.',
                'location': 'Tech Hub, Seattle, WA',
                'latitude': 47.6062,
                'longitude': -122.3321,
                'capacity': 6,
                'tags': ['gaming', 'board games', 'strategy'],
                'hours_from_now': 96  # 4 days from now
            },
            {
                'title': 'Art Gallery Tour',
                'description': 'Private tour of the Chicago Art Institute! Our expert guide will show you the highlights of the collection.',
                'location': 'Art Institute of Chicago, Chicago, IL',
                'latitude': 41.8796,
                'longitude': -87.6237,
                'capacity': 10,
                'tags': ['art', 'museum', 'culture'],
                'hours_from_now': 120  # 5 days from now
            },
            {
                'title': 'Beach Volleyball Tournament',
                'description': 'Join our casual beach volleyball tournament! Teams will be formed on-site. All skill levels welcome.',
                'location': 'South Beach, Miami, FL',
                'latitude': 25.7617,
                'longitude': -80.1918,
                'capacity': 16,
                'tags': ['sports', 'volleyball', 'beach'],
                'hours_from_now': 168  # 1 week from now
            },
            {
                'title': 'Book Club Discussion',
                'description': 'Monthly book club meeting to discuss "The Midnight Library" by Matt Haig. Light refreshments provided.',
                'location': 'Central Library, Boston, MA',
                'latitude': 42.3601,
                'longitude': -71.0589,
                'capacity': 8,
                'tags': ['books', 'literature', 'discussion'],
                'hours_from_now': 216  # 9 days from now
            },
            {
                'title': 'Live Music Jam Session',
                'description': 'Open mic and jam session at our favorite local venue. Bring your instrument or just come to listen!',
                'location': 'The Continental Club, Austin, TX',
                'latitude': 30.2672,
                'longitude': -97.7431,
                'capacity': 20,
                'tags': ['music', 'live music', 'jam session'],
                'hours_from_now': 48  # 2 days from now
            },
            {
                'title': 'Photography Workshop',
                'description': 'Learn street photography techniques from a professional photographer. We\'ll explore the city and practice composition.',
                'location': 'Union Square, San Francisco, CA',
                'latitude': 37.7879,
                'longitude': -122.4074,
                'capacity': 8,
                'tags': ['photography', 'workshop', 'urban'],
                'hours_from_now': 144  # 6 days from now
            },
            {
                'title': 'Farmers Market Cooking Demo',
                'description': 'Cooking demonstration using fresh, local ingredients from the farmers market. Learn seasonal recipes!',
                'location': 'Pike Place Market, Seattle, WA',
                'latitude': 47.6085,
                'longitude': -122.3399,
                'capacity': 14,
                'tags': ['cooking', 'farmers market', 'local food'],
                'hours_from_now': 72  # 3 days from now
            }
        ]

        # Create activities
        activities = []
        for i, activity_data in enumerate(activities_data):
            # Rotate through users as hosts
            host = users[i % len(users)]

            activity, created = Activity.objects.get_or_create(
                title=activity_data['title'],
                host=host,
                defaults={
                    'description': activity_data['description'],
                    'location': activity_data['location'],
                    'latitude': activity_data['latitude'],
                    'longitude': activity_data['longitude'],
                    'time': timezone.now() + timedelta(hours=activity_data['hours_from_now']),
                    'capacity': activity_data['capacity'],
                    'tags': activity_data['tags'],
                    'images': []
                }
            )
            if created:
                self.stdout.write(f'Created activity: {activity.title}')
            activities.append(activity)

        # Add some participants to activities
        for activity in activities:
            # Add 2-4 random participants (excluding the host)
            available_users = [u for u in users if u != activity.host]
            num_participants = random.randint(2, min(4, len(available_users)))
            participants = random.sample(available_users, num_participants)

            for participant in participants:
                participant_obj, created = ActivityParticipant.objects.get_or_create(
                    activity=activity,
                    user=participant,
                    defaults={'status': 'confirmed'}
                )
                if created:
                    self.stdout.write(f'Added {participant.username} to {activity.title}')

        self.stdout.write(self.style.SUCCESS('Successfully seeded database with sample data!'))
        self.stdout.write(f'Created {len(users)} users and {len(activities)} activities')

        # Print login credentials
        self.stdout.write('\n' + '='*50)
        self.stdout.write('SAMPLE USER CREDENTIALS:')
        self.stdout.write('Password for all users: password123')
        self.stdout.write('='*50)
        for user in users:
            self.stdout.write(f'{user.username}: {user.email}')