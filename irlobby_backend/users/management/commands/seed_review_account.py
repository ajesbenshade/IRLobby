import os
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from activities.models import Activity, ActivityParticipant
from chat.models import Conversation, Message
from matches.models import Match

User = get_user_model()

REVIEW_EMAIL = "app-review@irlobby.com"
REVIEW_USERNAME = "app_review"

# Apple Park, Cupertino. The review account's feed is anchored here regardless of
# device location (see ActivityListCreateView), so reviewers see this content anywhere.
BASE_LAT = 37.3349
BASE_LON = -122.0090

COMPANIONS = [
    {
        "username": "review_maya",
        "first_name": "Maya",
        "last_name": "Chen",
        "bio": "Weekend hiker, coffee snob, always down for trivia.",
        "interests": ["hiking", "coffee", "trivia"],
    },
    {
        "username": "review_jordan",
        "first_name": "Jordan",
        "last_name": "Reyes",
        "bio": "Pickup basketball and taco Tuesdays.",
        "interests": ["basketball", "food", "sports"],
    },
    {
        "username": "review_priya",
        "first_name": "Priya",
        "last_name": "Patel",
        "bio": "Board games, bookstores, and sunset walks.",
        "interests": ["board games", "books", "walking"],
    },
    {
        "username": "review_sam",
        "first_name": "Sam",
        "last_name": "Okafor",
        "bio": "Amateur photographer looking for new spots to shoot.",
        "interests": ["photography", "art", "outdoors"],
    },
]

# (host index into COMPANIONS or None for the review account, title, description,
#  category, lat offset, lon offset, hours from now, capacity, tags)
ACTIVITIES = [
    (0, "Rancho San Antonio Morning Hike", "Easy 4-mile loop, then coffee after.",
     "Outdoors", 0.012, -0.008, 26, 8, ["hiking", "outdoors"]),
    (1, "Pickup Basketball at Memorial Park", "Casual 3v3, all skill levels.",
     "Sports", -0.006, 0.010, 50, 6, ["basketball", "sports"]),
    (2, "Board Game Night", "Catan, Codenames, and snacks. Newcomers welcome!",
     "Social", 0.004, 0.006, 74, 6, ["board games", "social"]),
    (3, "Golden Hour Photo Walk", "Bring any camera, phones count.",
     "Arts", -0.010, -0.012, 98, 8, ["photography", "art"]),
    (0, "Trivia at the Taproom", "Team trivia night, we need a fourth!",
     "Social", 0.008, 0.002, 122, 4, ["trivia", "social"]),
    (None, "Sunday Farmers Market Stroll", "Grab breakfast and wander the stalls.",
     "Food", -0.003, -0.004, 146, 6, ["food", "market"]),
]

CHAT_SCRIPT = [
    (0, "Hey! Saw you joined the hike on Saturday 👋"),
    (None, "Yes! Is it beginner friendly?"),
    (0, "Totally, it's mostly flat. We'll meet at the main parking lot at 8."),
    (0, "Bring water, and there's coffee after if you're up for it."),
]


class Command(BaseCommand):
    help = (
        "Create or refresh the App Store / Play Store reviewer demo account with "
        "pre-populated activities, other users, a match, and a chat."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--password",
            help="Password for the review account. Defaults to $REVIEW_ACCOUNT_PASSWORD.",
        )

    @transaction.atomic
    def handle(self, *args, **options):
        password = options.get("password") or os.environ.get("REVIEW_ACCOUNT_PASSWORD")
        if not password:
            raise CommandError("Pass --password or set REVIEW_ACCOUNT_PASSWORD.")

        now = timezone.now()
        reviewer = self._upsert_user(
            username=REVIEW_USERNAME,
            email=REVIEW_EMAIL,
            first_name="App",
            last_name="Reviewer",
            bio="Demo account for App Review.",
            interests=["hiking", "board games", "food"],
            now=now,
            app_review_account=True,
        )
        reviewer.set_password(password)
        reviewer.is_active = True
        reviewer.save()

        companions = [
            self._upsert_user(
                username=c["username"],
                email=f"{c['username']}@irlobby.com",
                first_name=c["first_name"],
                last_name=c["last_name"],
                bio=c["bio"],
                interests=c["interests"],
                now=now,
            )
            for c in COMPANIONS
        ]
        # Replace previously seeded activities so dates are always in the future.
        seeded_hosts = [reviewer, *companions]
        Activity.objects.filter(host__in=seeded_hosts).delete()

        activities = []
        for host_idx, title, desc, category, dlat, dlon, hours, capacity, tags in ACTIVITIES:
            host = reviewer if host_idx is None else companions[host_idx]
            start = now + timedelta(hours=hours)
            activities.append(
                Activity.objects.create(
                    host=host,
                    is_approved=True,
                    title=title,
                    description=desc,
                    category=category,
                    location="Cupertino, CA",
                    latitude=BASE_LAT + dlat,
                    longitude=BASE_LON + dlon,
                    time=start,
                    end_time=start + timedelta(hours=2),
                    capacity=capacity,
                    tags=tags,
                )
            )

        # Companions fill out each other's activities.
        for activity in activities:
            for companion in companions:
                if companion != activity.host:
                    ActivityParticipant.objects.create(
                        activity=activity, user=companion, status="confirmed"
                    )

        # Reviewer has joined the hike; one companion is waiting on the reviewer's event.
        hike = activities[0]
        ActivityParticipant.objects.create(activity=hike, user=reviewer, status="confirmed")
        ActivityParticipant.objects.filter(activity=activities[-1], user=companions[1]).update(
            status="pending"
        )

        # A match + conversation with message history.
        Match.objects.filter(user_a=reviewer).delete()
        Match.objects.filter(user_b=reviewer).delete()
        match = Match.objects.create(activity=hike, user_a=companions[0], user_b=reviewer)
        conversation = Conversation.objects.create(match=match)
        for sender_idx, text in CHAT_SCRIPT:
            Message.objects.create(
                conversation=conversation,
                sender=reviewer if sender_idx is None else companions[sender_idx],
                text=text,
            )

        self.stdout.write(
            self.style.SUCCESS(
                f"Review account ready: {REVIEW_EMAIL} "
                f"({len(activities)} activities, {len(companions)} other users, 1 chat)."
            )
        )

    def _upsert_user(self, *, username, email, first_name, last_name, bio, interests, now,
                     app_review_account=False):
        user = User.objects.filter(email=email).first() or User(username=username, email=email)
        user.first_name = first_name
        user.last_name = last_name
        user.bio = bio
        user.location = "Cupertino, CA"
        user.latitude = BASE_LAT
        user.longitude = BASE_LON
        user.terms_accepted_at = user.terms_accepted_at or now
        user.privacy_accepted_at = user.privacy_accepted_at or now
        preferences = dict(user.preferences or {})
        preferences.update({"onboarding_completed": True, "interests": interests})
        if app_review_account:
            preferences["app_review_account"] = True
        user.preferences = preferences
        if user.pk is None:
            user.set_unusable_password()
        user.save()
        return user
