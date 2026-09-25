"""Seed complete, swipe-ready example activities for beta testers.

Creates host profiles and upcoming approved activities with photos,
descriptions, coordinates, categories, tags, and skill metadata so
Discover has cards to swipe immediately after deploy.
"""

from datetime import timedelta

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from activities.models import Activity, ActivityParticipant

User = get_user_model()

# Stable Unsplash HTTPS images (allowed by validate_image_reference).
IMG = {
    "hike": "https://images.unsplash.com/photo-1551632811-561732d1e306?auto=format&fit=crop&w=1200&q=80",
    "hike2": "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1200&q=80",
    "basketball": "https://images.unsplash.com/photo-1546519638-68e109498ffc?auto=format&fit=crop&w=1200&q=80",
    "board_games": "https://images.unsplash.com/photo-1606167668584-78701c57f13d?auto=format&fit=crop&w=1200&q=80",
    "photo": "https://images.unsplash.com/photo-1452587925148-ce544e77e70d?auto=format&fit=crop&w=1200&q=80",
    "bar": "https://images.unsplash.com/photo-1572116469696-31de0f17cc34?auto=format&fit=crop&w=1200&q=80",
    "market": "https://images.unsplash.com/photo-1488459716781-31db52582fe9?auto=format&fit=crop&w=1200&q=80",
    "yoga": "https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?auto=format&fit=crop&w=1200&q=80",
    "cooking": "https://images.unsplash.com/photo-1556910103-1c02745aae4d?auto=format&fit=crop&w=1200&q=80",
    "music": "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?auto=format&fit=crop&w=1200&q=80",
    "coffee": "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=1200&q=80",
    "art": "https://images.unsplash.com/photo-1460661419201-fd4cecdf8a8b?auto=format&fit=crop&w=1200&q=80",
    "volleyball": "https://images.unsplash.com/photo-1612872087720-bb876e2e67d1?auto=format&fit=crop&w=1200&q=80",
    "books": "https://images.unsplash.com/photo-1481627834876-b7833e8f5570?auto=format&fit=crop&w=1200&q=80",
    "run": "https://images.unsplash.com/photo-1476480862126-209bfaa8edc8?auto=format&fit=crop&w=1200&q=80",
    "picnic": "https://images.unsplash.com/photo-1506784365847-bbad939e9335?auto=format&fit=crop&w=1200&q=80",
    "brewery": "https://images.unsplash.com/photo-1436076863939-06870fe779c2?auto=format&fit=crop&w=1200&q=80",
    "theater": "https://images.unsplash.com/photo-1503095396549-807759245b35?auto=format&fit=crop&w=1200&q=80",
    "avatar_maya": "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=400&q=80",
    "avatar_jordan": "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80",
    "avatar_priya": "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=400&q=80",
    "avatar_sam": "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&q=80",
    "avatar_alex": "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=400&q=80",
    "avatar_chris": "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=400&q=80",
}

HUBS = {
    "youngstown": {
        "label": "Youngstown, OH",
        "lat": 41.0998,
        "lon": -80.6495,
    },
    "cupertino": {
        "label": "Cupertino, CA",
        "lat": 37.3349,
        "lon": -122.0090,
    },
    "san_francisco": {
        "label": "San Francisco, CA",
        "lat": 37.7749,
        "lon": -122.4194,
    },
}

HOSTS = [
    {
        "username": "beta_maya",
        "email": "beta-maya@irlobby.com",
        "first_name": "Maya",
        "last_name": "Chen",
        "bio": "Weekend hiker, pour-over snob, always down for trivia night.",
        "interests": ["hiking", "coffee", "trivia", "outdoors"],
        "avatar": IMG["avatar_maya"],
    },
    {
        "username": "beta_jordan",
        "email": "beta-jordan@irlobby.com",
        "first_name": "Jordan",
        "last_name": "Reyes",
        "bio": "Pickup basketball, taco crawls, and anything outdoors after work.",
        "interests": ["basketball", "food", "sports", "outdoors"],
        "avatar": IMG["avatar_jordan"],
    },
    {
        "username": "beta_priya",
        "email": "beta-priya@irlobby.com",
        "first_name": "Priya",
        "last_name": "Patel",
        "bio": "Board games, bookstores, and golden-hour walks.",
        "interests": ["board games", "books", "walking", "art"],
        "avatar": IMG["avatar_priya"],
    },
    {
        "username": "beta_sam",
        "email": "beta-sam@irlobby.com",
        "first_name": "Sam",
        "last_name": "Okafor",
        "bio": "Amateur photographer hunting for new corners of the city.",
        "interests": ["photography", "art", "outdoors", "coffee"],
        "avatar": IMG["avatar_sam"],
    },
    {
        "username": "beta_alex",
        "email": "beta-alex@irlobby.com",
        "first_name": "Alex",
        "last_name": "Nguyen",
        "bio": "Home cook, farmers-market regular, soft-launch dinner parties.",
        "interests": ["cooking", "food", "market", "social"],
        "avatar": IMG["avatar_alex"],
    },
    {
        "username": "beta_chris",
        "email": "beta-chris@irlobby.com",
        "first_name": "Chris",
        "last_name": "Walker",
        "bio": "Yoga at sunrise, live music at night, somewhere in between.",
        "interests": ["yoga", "wellness", "music", "nightlife"],
        "avatar": IMG["avatar_chris"],
    },
]

# (host_idx, title, description, category, location_suffix, dlat, dlon,
#  hours_from_now, duration_hours, capacity, tags, images, skill_level,
#  weather_dependent, equipment_required, equipment_provided, age_restriction)
ACTIVITIES = [
    (
        0,
        "Sunrise Trail Loop",
        "Easy 3-mile loop with a coffee stop after. Pace is conversational — "
        "perfect if you want movement without a race vibe. We'll stick together "
        "and point out the overlooks along the way.",
        "Outdoor Adventures",
        "Mill Creek Park",
        0.012,
        -0.008,
        3,
        2,
        8,
        ["hiking", "outdoors", "nature"],
        [IMG["hike"], IMG["hike2"]],
        "beginner",
        True,
        "Comfortable shoes and water",
        False,
        "",
    ),
    (
        1,
        "Pickup Basketball at the Park",
        "Casual 3v3 runs until we hit 21. All skill levels welcome — we'll mix "
        "teams so nobody sits for long. Bring a water bottle; courtside snacks "
        "appreciated but not required.",
        "Sports & Fitness",
        "Memorial Park courts",
        -0.006,
        0.010,
        5,
        2,
        8,
        ["basketball", "sports", "fitness"],
        [IMG["basketball"]],
        "all levels",
        False,
        "Athletic shoes",
        True,
        "",
    ),
    (
        2,
        "Board Game Night + Snacks",
        "Catan, Codenames, and a couple of lighter party games. Newcomers are "
        "welcome — we'll teach as we go. Snacks and sparkling water on the table; "
        "BYO favorite game if you have one.",
        "Gaming",
        "Downtown game lounge",
        0.004,
        0.006,
        7,
        3,
        6,
        ["board games", "social", "gaming"],
        [IMG["board_games"]],
        "all levels",
        False,
        "",
        True,
        "",
    ),
    (
        3,
        "Golden Hour Photo Walk",
        "Wander a few photogenic blocks while the light is soft. Phones count as "
        "cameras. We'll share composition tips and end at a cafe to review shots. "
        "No gear flex required — curiosity is enough.",
        "Arts & Culture",
        "Downtown arts district",
        -0.010,
        -0.012,
        26,
        2,
        8,
        ["photography", "art", "walking"],
        [IMG["photo"], IMG["art"]],
        "beginner",
        True,
        "Phone or camera",
        False,
        "",
    ),
    (
        0,
        "Trivia Night at the Taproom",
        "Team trivia — we need a fourth (or fifth!). Covers music, movies, "
        "geography, and a few local curveballs. First round starts on time; grab a "
        "seat early so we can claim a good table.",
        "Social",
        "Neighborhood taproom",
        0.008,
        0.002,
        28,
        3,
        5,
        ["trivia", "social", "nightlife"],
        [IMG["bar"], IMG["brewery"]],
        "all levels",
        False,
        "",
        False,
        "21+",
    ),
    (
        4,
        "Sunday Farmers Market Stroll",
        "Grab breakfast, sample a few stalls, and wander with no agenda. Great "
        "for meeting people who like slow mornings and seasonal produce. We'll "
        "meet at the main entrance and stick together as a loose group.",
        "Food & Drinks",
        "West Federal Street Market",
        -0.003,
        -0.004,
        50,
        2,
        8,
        ["food", "market", "community"],
        [IMG["market"]],
        "all levels",
        True,
        "",
        False,
        "",
    ),
    (
        5,
        "Sunset Yoga on the Lawn",
        "Gentle flow suitable for first-timers. Mats available if you don't have "
        "one. We'll finish with a short stretch and tea. Come as you are — no "
        "studio wardrobe required.",
        "Sports & Fitness",
        "Park lawn near the lake",
        0.015,
        0.005,
        30,
        1,
        10,
        ["yoga", "wellness", "outdoors"],
        [IMG["yoga"]],
        "beginner",
        True,
        "",
        True,
        "",
    ),
    (
        4,
        "Pasta From Scratch Workshop",
        "We'll make dough, cut tagliatelle, and finish with a simple tomato-basil "
        "sauce. Hands-on and conversational — leave with a plate and a recipe card. "
        "Aprons provided; long sleeves recommended.",
        "Food & Drinks",
        "Community kitchen",
        -0.007,
        0.009,
        74,
        3,
        8,
        ["cooking", "food", "learning"],
        [IMG["cooking"]],
        "beginner",
        False,
        "",
        True,
        "",
    ),
    (
        5,
        "Open Mic & Acoustic Night",
        "Sing, play, or just listen. Sign-ups at the door; 2-song slots. The room "
        "is intimate and supportive — beginners encouraged. Soft drinks and coffee "
        "available; keep phone volume low during sets.",
        "Music",
        "The Cellar",
        0.002,
        -0.006,
        52,
        3,
        10,
        ["music", "live music", "nightlife"],
        [IMG["music"]],
        "all levels",
        False,
        "Instrument optional",
        True,
        "",
    ),
    (
        3,
        "Morning Coffee Crawl",
        "Three cafes, one neighborhood. We'll compare pour-overs, chat about what "
        "we notice in the cup, and find a sunny table for the last stop. Casual "
        "pace — this is social, not a speed run.",
        "Food & Drinks",
        "Downtown cafe row",
        0.006,
        -0.003,
        98,
        2,
        6,
        ["coffee", "social", "food"],
        [IMG["coffee"]],
        "all levels",
        False,
        "",
        False,
        "",
    ),
    (
        2,
        "Gallery Hop & Sketch Hour",
        "Visit two small galleries, then sit for a low-pressure sketch session. "
        "Bring a notebook or use provided paper. Zero art-school energy — just "
        "looking closely and talking about what we like.",
        "Arts & Culture",
        "Butler Institute area",
        0.011,
        -0.001,
        122,
        2,
        8,
        ["art", "museum", "culture"],
        [IMG["art"]],
        "beginner",
        False,
        "Notebook optional",
        True,
        "",
    ),
    (
        1,
        "Casual Beach Volleyball",
        "Co-ed pickup on sand. We'll rotate so everyone plays. Beginners welcome — "
        "we'll keep rallies friendly. Sunscreen recommended; water provided.",
        "Sports & Fitness",
        "Boardman Park sand courts",
        -0.020,
        -0.005,
        146,
        2,
        10,
        ["volleyball", "sports", "outdoors"],
        [IMG["volleyball"]],
        "all levels",
        True,
        "Athletic clothes",
        True,
        "",
    ),
    (
        2,
        "Book Club: Short Stories Night",
        "This month's pick is a short-story collection so catching up is easy. "
        "We'll discuss favorites over tea and cookies. Spoilers welcome once we "
        "sit down — bring a quote you loved.",
        "Learning",
        "Central library meeting room",
        0.001,
        0.008,
        170,
        2,
        8,
        ["books", "literature", "discussion"],
        [IMG["books"]],
        "all levels",
        False,
        "Book or ebook",
        False,
        "",
    ),
    (
        1,
        "Easy 5K Group Run",
        "Conversational pace (~10–11 min/mile). Route is flat and well-lit. "
        "We'll regroup at the halfway mark and cool down together. No Strava "
        "pressure — show up and move.",
        "Sports & Fitness",
        "Riverwalk start",
        -0.004,
        0.012,
        4,
        1,
        10,
        ["running", "fitness", "outdoors"],
        [IMG["run"]],
        "beginner",
        True,
        "Running shoes",
        False,
        "",
    ),
    (
        0,
        "Lakeside Picnic Potluck",
        "Bring one shareable snack or drink and a blanket if you have one. We'll "
        "claim a shady spot, swap stories, and watch the water. Low effort, high "
        "vibe — kids and dogs welcome if well-behaved.",
        "Social",
        "Lake Glacier picnic area",
        0.009,
        -0.011,
        76,
        3,
        10,
        ["picnic", "social", "outdoors", "community"],
        [IMG["picnic"]],
        "all levels",
        True,
        "A snack to share",
        False,
        "",
    ),
    (
        5,
        "Craft Brewery Tour & Tasting",
        "Guided walk through a local brewery with samples and a chat with the "
        "brewer. Designated-driver friendly options available. We'll hang after "
        "for anyone who wants a second round or fries.",
        "Nightlife",
        "PJ McIntyre's",
        0.003,
        0.001,
        100,
        2,
        10,
        ["brewery", "craft beer", "nightlife", "local"],
        [IMG["brewery"]],
        "all levels",
        False,
        "",
        False,
        "21+",
    ),
]


class Command(BaseCommand):
    help = (
        "Seed approved example activities with photos, descriptions, and locations "
        "so beta testers have cards to swipe in Discover."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--hub",
            choices=sorted(HUBS.keys()),
            default="youngstown",
            help="City hub to center seeded activities around (default: youngstown).",
        )
        parser.add_argument(
            "--password",
            default="BetaHost-pass-123!",
            help="Password for seeded beta host accounts.",
        )
        parser.add_argument(
            "--keep-existing",
            action="store_true",
            help="Do not delete previously seeded beta host activities before creating.",
        )

    @transaction.atomic
    def handle(self, *args, **options):
        hub_key = options["hub"]
        hub = HUBS[hub_key]
        password = options["password"]
        now = timezone.now()

        hosts = [
            self._upsert_host(host_data=h, hub=hub, password=password, now=now) for h in HOSTS
        ]

        if not options["keep_existing"]:
            deleted, _ = Activity.objects.filter(host__in=hosts).delete()
            self.stdout.write(f"Cleared {deleted} previously seeded beta activities.")

        created = []
        for spec in ACTIVITIES:
            (
                host_idx,
                title,
                description,
                category,
                location_suffix,
                dlat,
                dlon,
                hours,
                duration,
                capacity,
                tags,
                images,
                skill_level,
                weather_dependent,
                equipment_required,
                equipment_provided,
                age_restriction,
            ) = spec
            host = hosts[host_idx]
            start = now + timedelta(hours=hours)
            activity = Activity.objects.create(
                host=host,
                is_approved=True,
                title=title,
                description=description,
                category=category,
                location=f"{location_suffix}, {hub['label']}",
                latitude=hub["lat"] + dlat,
                longitude=hub["lon"] + dlon,
                time=start,
                end_time=start + timedelta(hours=duration),
                capacity=min(capacity, 10),
                tags=tags,
                images=images,
                skill_level=skill_level,
                weather_dependent=weather_dependent,
                equipment_required=equipment_required,
                equipment_provided=equipment_provided,
                age_restriction=age_restriction,
                visibility=["public"],
            )
            created.append(activity)
            self.stdout.write(f"Created: {activity.title}")

        # Cross-fill a few confirmed participants so cards look lively.
        for activity in created:
            for host in hosts:
                if host == activity.host:
                    continue
                if host.id % 3 == activity.id % 3:
                    ActivityParticipant.objects.get_or_create(
                        activity=activity,
                        user=host,
                        defaults={"status": "confirmed"},
                    )

        self.stdout.write(
            self.style.SUCCESS(
                f"Seeded {len(created)} swipeable activities around {hub['label']} "
                f"({hub_key}) with {len(hosts)} host profiles."
            )
        )
        self.stdout.write(
            "Host logins (password shared): "
            + ", ".join(f"{h.email}" for h in hosts)
        )

    def _upsert_host(self, *, host_data, hub, password, now):
        user = User.objects.filter(email=host_data["email"]).first() or User(
            username=host_data["username"],
            email=host_data["email"],
        )
        user.username = host_data["username"]
        user.first_name = host_data["first_name"]
        user.last_name = host_data["last_name"]
        user.bio = host_data["bio"]
        user.avatar_url = host_data["avatar"]
        user.location = hub["label"]
        user.latitude = hub["lat"]
        user.longitude = hub["lon"]
        user.terms_accepted_at = user.terms_accepted_at or now
        user.privacy_accepted_at = user.privacy_accepted_at or now
        preferences = dict(user.preferences or {})
        preferences.update(
            {
                "onboarding_completed": True,
                "interests": host_data["interests"],
                "photo_album": [host_data["avatar"]],
                "beta_seed_host": True,
            }
        )
        user.preferences = preferences
        user.is_active = True
        user.set_password(password)
        user.save()
        return user
