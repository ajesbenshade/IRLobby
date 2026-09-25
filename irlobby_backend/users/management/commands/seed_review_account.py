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

IMG = {
    "hike": "https://images.unsplash.com/photo-1551632811-561732d1e306?auto=format&fit=crop&w=1200&q=80",
    "hike2": "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1200&q=80",
    "basketball": "https://images.unsplash.com/photo-1546519638-68e109498ffc?auto=format&fit=crop&w=1200&q=80",
    "board_games": "https://images.unsplash.com/photo-1606167668584-78701c57f13d?auto=format&fit=crop&w=1200&q=80",
    "photo": "https://images.unsplash.com/photo-1452587925148-ce544e77e70d?auto=format&fit=crop&w=1200&q=80",
    "bar": "https://images.unsplash.com/photo-1572116469696-31de0f17cc34?auto=format&fit=crop&w=1200&q=80",
    "market": "https://images.unsplash.com/photo-1488459716781-31db52582fe9?auto=format&fit=crop&w=1200&q=80",
    "avatar_maya": "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=400&q=80",
    "avatar_jordan": "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80",
    "avatar_priya": "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=400&q=80",
    "avatar_sam": "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&q=80",
}

COMPANIONS = [
    {
        "username": "review_maya",
        "first_name": "Maya",
        "last_name": "Chen",
        "bio": "Weekend hiker, coffee snob, always down for trivia.",
        "interests": ["hiking", "coffee", "trivia"],
        "avatar": IMG["avatar_maya"],
    },
    {
        "username": "review_jordan",
        "first_name": "Jordan",
        "last_name": "Reyes",
        "bio": "Pickup basketball and taco Tuesdays.",
        "interests": ["basketball", "food", "sports"],
        "avatar": IMG["avatar_jordan"],
    },
    {
        "username": "review_priya",
        "first_name": "Priya",
        "last_name": "Patel",
        "bio": "Board games, bookstores, and sunset walks.",
        "interests": ["board games", "books", "walking"],
        "avatar": IMG["avatar_priya"],
    },
    {
        "username": "review_sam",
        "first_name": "Sam",
        "last_name": "Okafor",
        "bio": "Amateur photographer looking for new spots to shoot.",
        "interests": ["photography", "art", "outdoors"],
        "avatar": IMG["avatar_sam"],
    },
]

# (host index into COMPANIONS or None for the review account, title, description,
#  category, location label, lat offset, lon offset, hours from now, capacity,
#  tags, images, skill_level)
ACTIVITIES = [
    (
        0,
        "Rancho San Antonio Morning Hike",
        "Easy 4-mile loop with rolling trails and a coffee stop after. "
        "Conversational pace — beginners are welcome. Meet at the main parking "
        "lot; bring water and layers for the shady stretches.",
        "Outdoor Adventures",
        "Rancho San Antonio Preserve, Cupertino, CA",
        0.012,
        -0.008,
        26,
        8,
        ["hiking", "outdoors"],
        [IMG["hike"], IMG["hike2"]],
        "beginner",
    ),
    (
        1,
        "Pickup Basketball at Memorial Park",
        "Casual 3v3 until we hit 21. All skill levels welcome — we'll mix teams "
        "so nobody sits long. Courtside water recommended; sneakers required.",
        "Sports & Fitness",
        "Memorial Park, Cupertino, CA",
        -0.006,
        0.010,
        50,
        6,
        ["basketball", "sports"],
        [IMG["basketball"]],
        "all levels",
    ),
    (
        2,
        "Board Game Night",
        "Catan, Codenames, and snacks. Newcomers welcome — we'll teach as we go. "
        "Bring a favorite game if you have one, or just show up ready to play.",
        "Gaming",
        "Downtown Cupertino game lounge, CA",
        0.004,
        0.006,
        74,
        6,
        ["board games", "social"],
        [IMG["board_games"]],
        "all levels",
    ),
    (
        3,
        "Golden Hour Photo Walk",
        "Bring any camera — phones count. We'll wander a few photogenic blocks, "
        "share composition tips, and finish with a cafe debrief of our favorite shots.",
        "Arts & Culture",
        "Cupertino arts district, CA",
        -0.010,
        -0.012,
        98,
        8,
        ["photography", "art"],
        [IMG["photo"]],
        "beginner",
    ),
    (
        0,
        "Trivia at the Taproom",
        "Team trivia night — we need a fourth! Music, movies, geography, and a "
        "few local curveballs. Grab a seat early so we can claim a good table.",
        "Social",
        "Neighborhood taproom, Cupertino, CA",
        0.008,
        0.002,
        122,
        4,
        ["trivia", "social"],
        [IMG["bar"]],
        "all levels",
    ),
    (
        None,
        "Sunday Farmers Market Stroll",
        "Grab breakfast and wander the stalls together. Slow morning energy — "
        "sample seasonal produce, chat with vendors, and leave with something tasty.",
        "Food & Drinks",
        "Cupertino farmers market, CA",
        -0.003,
        -0.004,
        146,
        6,
        ["food", "market"],
        [IMG["market"]],
        "all levels",
    ),
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
            avatar="",
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
                avatar=c["avatar"],
                now=now,
            )
            for c in COMPANIONS
        ]
        # Replace previously seeded activities so dates are always in the future.
        seeded_hosts = [reviewer, *companions]
        Activity.objects.filter(host__in=seeded_hosts).delete()

        activities = []
        for (
            host_idx,
            title,
            desc,
            category,
            location,
            dlat,
            dlon,
            hours,
            capacity,
            tags,
            images,
            skill_level,
        ) in ACTIVITIES:
            host = reviewer if host_idx is None else companions[host_idx]
            start = now + timedelta(hours=hours)
            activities.append(
                Activity.objects.create(
                    host=host,
                    is_approved=True,
                    title=title,
                    description=desc,
                    category=category,
                    location=location,
                    latitude=BASE_LAT + dlat,
                    longitude=BASE_LON + dlon,
                    time=start,
                    end_time=start + timedelta(hours=2),
                    capacity=capacity,
                    tags=tags,
                    images=images,
                    skill_level=skill_level,
                    visibility=["public"],
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

    def _upsert_user(
        self,
        *,
        username,
        email,
        first_name,
        last_name,
        bio,
        interests,
        avatar,
        now,
        app_review_account=False,
    ):
        user = User.objects.filter(email=email).first() or User(username=username, email=email)
        user.first_name = first_name
        user.last_name = last_name
        user.bio = bio
        user.avatar_url = avatar or user.avatar_url
        user.location = "Cupertino, CA"
        user.latitude = BASE_LAT
        user.longitude = BASE_LON
        user.terms_accepted_at = user.terms_accepted_at or now
        user.privacy_accepted_at = user.privacy_accepted_at or now
        preferences = dict(user.preferences or {})
        preferences.update({"onboarding_completed": True, "interests": interests})
        if avatar:
            preferences["photo_album"] = [avatar]
        if app_review_account:
            preferences["app_review_account"] = True
        user.preferences = preferences
        if user.pk is None:
            user.set_unusable_password()
        user.save()
        return user
