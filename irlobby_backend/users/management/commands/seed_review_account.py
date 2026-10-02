import os
from datetime import date, timedelta

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.db.models import Q
from django.utils import timezone

from activities.models import Activity, ActivityParticipant
from chat.models import Conversation, Message
from matches.models import Match
from users.models import Friendship

User = get_user_model()

REVIEW_EMAIL = "app-review@irlobby.com"
REVIEW_USERNAME = "app_review"
# Second reviewer: lets App Review try friends, 1:1 chat and join requests from both sides.
REVIEW2_EMAIL = "app-review2@irlobby.com"
REVIEW2_USERNAME = "app_review2"

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

# 1:1 chat between the two review accounts: (True = review account 1 speaks).
DIRECT_CHAT_SCRIPT = [
    (True, "Hi! This is the first reviewer account. Try replying to this chat."),
    (False, "Got it. Report and Block live in the menu at the top of the chat."),
    (True, "You can also mute the chat or leave it from there."),
]

# Extra "Require approval" gatherings so both sides of a join request can be reviewed:
# a companion hosts one that review account 2 has asked to join, and review account 1 hosts
# one that a companion has asked to join (and a companion is already going to).
APPROVAL_FROM_COMPANION = (
    "Neighborhood Potluck (host approves guests)",
    "A small dinner. The host approves each request to join.",
    "Social",
    0.002,
    0.003,
    170,
    6,
    ["food", "social"],
)
APPROVAL_FROM_REVIEWER = (
    "Hosting demo: Porch Games (you approve guests)",
    "Review account 1 hosts this. A request from Priya is waiting for your answer.",
    "Social",
    -0.002,
    0.004,
    194,
    6,
    ["board games", "social"],
)


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
        parser.add_argument(
            "--password2",
            help=(
                "Password for the second review account. Defaults to $REVIEW_ACCOUNT_PASSWORD2, "
                "then to the first account's password."
            ),
        )

    @transaction.atomic
    def handle(self, *args, **options):
        password = options.get("password") or os.environ.get("REVIEW_ACCOUNT_PASSWORD")
        if not password:
            raise CommandError("Pass --password or set REVIEW_ACCOUNT_PASSWORD.")

        password2 = (
            options.get("password2") or os.environ.get("REVIEW_ACCOUNT_PASSWORD2") or password
        )

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

        reviewer2 = self._upsert_user(
            username=REVIEW2_USERNAME,
            email=REVIEW2_EMAIL,
            first_name="App",
            last_name="Reviewer Two",
            bio="Second demo account for App Review.",
            interests=["food", "photography", "trivia"],
            now=now,
            app_review_account=True,
        )
        reviewer2.set_password(password2)
        reviewer2.is_active = True
        reviewer2.save()

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
        seeded_hosts = [reviewer, reviewer2, *companions]
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

        # Require-approval gatherings with a request waiting on each side.
        approval_from_companion = self._create_activity(
            companions[3], APPROVAL_FROM_COMPANION, now
        )
        approval_from_reviewer = self._create_activity(reviewer, APPROVAL_FROM_REVIEWER, now)
        for activity in (approval_from_companion, approval_from_reviewer):
            activity.requires_approval = True
            activity.save(update_fields=["requires_approval"])
        ActivityParticipant.objects.create(
            activity=approval_from_companion, user=reviewer2, status="pending", decided_at=None
        )
        ActivityParticipant.objects.create(
            activity=approval_from_reviewer, user=companions[0], status="confirmed"
        )
        ActivityParticipant.objects.create(
            activity=approval_from_reviewer, user=companions[2], status="pending", decided_at=None
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

        # Account 2: accepted friend of account 1, with a 1:1 chat. Cleaned up first so a
        # re-run neither duplicates nor loses it (account 1's cleanup above removed the pair's
        # old direct chat).
        Match.objects.filter(Q(user_a=reviewer2) | Q(user_b=reviewer2)).delete()
        Friendship.objects.filter(
            Q(requester=reviewer, recipient=reviewer2) | Q(requester=reviewer2, recipient=reviewer)
        ).delete()
        Friendship.objects.create(
            requester=reviewer, recipient=reviewer2, status="accepted", responded_at=now
        )
        user_a, user_b = sorted([reviewer, reviewer2], key=lambda u: u.id)
        direct = Match.objects.create(activity=None, user_a=user_a, user_b=user_b)
        direct_conversation = Conversation.objects.create(match=direct)
        for from_first, text in DIRECT_CHAT_SCRIPT:
            Message.objects.create(
                conversation=direct_conversation,
                sender=reviewer if from_first else reviewer2,
                text=text,
            )

        self.stdout.write(
            self.style.SUCCESS(
                f"Review accounts ready: {REVIEW_EMAIL} and {REVIEW2_EMAIL} "
                f"({len(activities) + 2} activities, {len(companions)} other users, "
                "2 chats, 2 pending join requests)."
            )
        )

    def _create_activity(self, host, spec, now):
        title, desc, category, dlat, dlon, hours, capacity, tags = spec
        start = now + timedelta(hours=hours)
        return Activity.objects.create(
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

    def _upsert_user(self, *, username, email, first_name, last_name, bio, interests, now,
                     app_review_account=False):
        user = User.objects.filter(email=email).first() or User(username=username, email=email)
        user.first_name = first_name
        user.last_name = last_name
        user.bio = bio
        user.location = "Cupertino, CA"
        user.latitude = BASE_LAT
        user.longitude = BASE_LON
        if app_review_account and user.date_of_birth is None:
            user.date_of_birth = date(now.year - 35, 6, 15)
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
