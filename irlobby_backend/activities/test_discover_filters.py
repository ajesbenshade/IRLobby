"""Discover gathering filters on GET /api/activities/.

Age overlap rule (also documented in activities.discover_filters):

* kids_family is ages 0–12, youth is 13–17, adults is 18+ with no upper bound.
* A gathering matches a bucket when its [age_min, age_max] window shares at
  least one age with that bucket. A null bound is open on that side.
* Open-age gatherings (both age_min and age_max null) match ages=all and a
  request that omits ages only. They are not included in kids, youth, or adults.
"""

from datetime import datetime, timedelta, timezone as datetime_timezone

from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from activities.models import Activity
from users.models import User

# Expected names per ages bucket. Open-age is intentionally absent.
KIDS_FAMILY = {
    "kids_only",
    "kids_youth_bridge",
    "wide",
    "five_and_up",
    "up_to_eight",
    "up_to_seventeen",
    "up_to_eighteen",
    "exactly_twelve",
    "twelve_thirteen",
}
YOUTH = {
    "youth_only",
    "kids_youth_bridge",
    "youth_adults_bridge",
    "wide",
    "five_and_up",
    "up_to_seventeen",
    "up_to_eighteen",
    "exactly_thirteen",
    "twelve_thirteen",
}
ADULTS = {
    "adults_only",
    "adults_and_up",
    "youth_adults_bridge",
    "wide",
    "five_and_up",
    "up_to_eighteen",
}


class DiscoverGatheringFilterTests(APITestCase):
    def setUp(self):
        self.viewer = User.objects.create_user(
            username="discover-viewer",
            email="discover-viewer@example.com",
            password="password123",
        )
        self.host = User.objects.create_user(
            username="discover-host",
            email="discover-host@example.com",
            password="password123",
        )
        self.client.force_authenticate(self.viewer)

    def _activity(self, title, **overrides):
        fields = {
            "host": self.host,
            "is_approved": True,
            "title": title,
            "description": title,
            "location": "Fellowship Hall",
            "latitude": 40.31,
            "longitude": -75.32,
            "time": timezone.now() + timedelta(days=3),
            "capacity": 20,
            "category": "",
            "audience_gender": "everyone",
            "tags": [],
            "images": [],
        }
        fields.update(overrides)
        return Activity.objects.create(**fields)

    def _ids(self, params):
        response = self.client.get(reverse("activity-list"), params)
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        results = response.data if isinstance(response.data, list) else response.data["results"]
        return {item["id"] for item in results}

    def _names(self, params, by_name):
        matched = self._ids(params)
        return {name for name, activity in by_name.items() if activity.id in matched}

    def test_audience_is_an_exact_match(self):
        everyone = self._activity("Potluck", audience_gender="everyone")
        men = self._activity("Men's breakfast", audience_gender="men")
        women = self._activity("Women's study", audience_gender="women")

        self.assertEqual(self._ids({"audience": "everyone"}), {everyone.id})
        self.assertEqual(self._ids({"audience": "men"}), {men.id})
        self.assertEqual(self._ids({"audience": "women"}), {women.id})
        # Omit applies no audience filter. An unknown value is ignored.
        self.assertEqual(self._ids({}), {everyone.id, men.id, women.id})
        self.assertEqual(self._ids({"audience": "Men"}), {everyone.id, men.id, women.id})

    def test_ages_buckets_use_range_overlap_and_open_age_matches_all_only(self):
        windows = {
            "kids_only": (0, 12),
            "youth_only": (13, 17),
            "adults_only": (18, 65),
            "adults_and_up": (18, None),
            "kids_youth_bridge": (10, 14),
            "youth_adults_bridge": (16, 20),
            "wide": (0, 99),
            "five_and_up": (5, None),
            "up_to_eight": (None, 8),
            "up_to_seventeen": (None, 17),
            "up_to_eighteen": (None, 18),
            "open_age": (None, None),
            "exactly_twelve": (12, 12),
            "exactly_thirteen": (13, 13),
            "twelve_thirteen": (12, 13),
        }
        by_name = {
            name: self._activity(name, age_min=age_min, age_max=age_max)
            for name, (age_min, age_max) in windows.items()
        }
        every_name = set(windows)

        self.assertEqual(self._names({"ages": "kids_family"}, by_name), KIDS_FAMILY)
        self.assertEqual(self._names({"ages": "youth"}, by_name), YOUTH)
        self.assertEqual(self._names({"ages": "adults"}, by_name), ADULTS)
        # Open-age is in none of the buckets above.
        for bucket in (KIDS_FAMILY, YOUTH, ADULTS):
            self.assertNotIn("open_age", bucket)

        # ages=all and an omitted ages param do not filter, so open-age is included.
        self.assertEqual(self._names({"ages": "all"}, by_name), every_name)
        self.assertEqual(self._names({}, by_name), every_name)
        self.assertIn(by_name["open_age"].id, self._ids({"ages": "all"}))
        self.assertNotIn(by_name["open_age"].id, self._ids({"ages": "kids_family"}))
        self.assertNotIn(by_name["open_age"].id, self._ids({"ages": "youth"}))
        self.assertNotIn(by_name["open_age"].id, self._ids({"ages": "adults"}))

    def test_type_and_category_match_design_labels_exactly(self):
        worship = self._activity("Sunday worship", category="Worship & service")
        near_miss = self._activity("Extra", category="Worship & service extra")
        legacy = self._activity("Pickup game", category="Sports & Fitness")
        music = self._activity("Choir", category="Music")
        live_music = self._activity("Concert", category="Live Music")

        worship_only = {worship.id}
        self.assertEqual(self._ids({"type": "worship_service"}), worship_only)
        self.assertEqual(self._ids({"category": "Worship & service"}), worship_only)
        self.assertEqual(self._ids({"category": "worship_service"}), worship_only)
        self.assertNotIn(near_miss.id, self._ids({"type": "worship_service"}))
        self.assertNotIn(legacy.id, self._ids({"type": "worship_service"}))

        self.assertEqual(self._ids({"type": "music"}), {music.id})
        self.assertEqual(self._ids({"category": "Music"}), {music.id})
        self.assertNotIn(live_music.id, self._ids({"type": "music"}))

        # A non-design category keeps substring search for older rows.
        self.assertEqual(self._ids({"category": "Sports"}), {legacy.id})
        # Unknown type is ignored, so every gathering remains.
        self.assertEqual(
            self._ids({"type": "not_a_type"}),
            {worship.id, near_miss.id, legacy.id, music.id, live_music.id},
        )

    def test_combined_audience_ages_type_and_dates(self):
        inside = datetime(2026, 11, 15, 15, 0, tzinfo=datetime_timezone.utc)
        before = datetime(2026, 10, 1, 15, 0, tzinfo=datetime_timezone.utc)
        after = datetime(2026, 12, 15, 15, 0, tzinfo=datetime_timezone.utc)
        match = self._activity(
            "Men's small group",
            audience_gender="men",
            age_min=21,
            age_max=40,
            category="Small groups",
            time=inside,
        )
        too_early = self._activity(
            "Earlier group",
            audience_gender="men",
            age_min=21,
            age_max=40,
            category="Small groups",
            time=before,
        )
        too_late = self._activity(
            "Later group",
            audience_gender="men",
            age_min=21,
            age_max=40,
            category="Small groups",
            time=after,
        )
        women = self._activity(
            "Women's group",
            audience_gender="women",
            age_min=21,
            age_max=40,
            category="Small groups",
            time=inside,
        )
        kids = self._activity(
            "Kids' group",
            audience_gender="men",
            age_min=0,
            age_max=10,
            category="Small groups",
            time=inside,
        )
        worship = self._activity(
            "Men's worship",
            audience_gender="men",
            age_min=21,
            age_max=40,
            category="Worship & service",
            time=inside,
        )
        open_age = self._activity(
            "Open men's group",
            audience_gender="men",
            age_min=None,
            age_max=None,
            category="Small groups",
            time=inside,
        )

        params = {
            "audience": "men",
            "ages": "adults",
            "type": "small_groups",
            "date_from": "2026-11-01T00:00:00Z",
            "date_to": "2026-11-30T23:59:59Z",
            # Accepted and unused by this gathering: clients may still send them.
            "price_min": "0",
            "skill_level": "",
            "tags": "",
        }
        self.assertEqual(self._ids(params), {match.id})
        self.assertNotIn(too_early.id, self._ids(params))
        self.assertNotIn(too_late.id, self._ids(params))
        self.assertNotIn(women.id, self._ids(params))
        self.assertNotIn(kids.id, self._ids(params))
        self.assertNotIn(worship.id, self._ids(params))
        # Open-age does not overlap the adults bucket.
        self.assertNotIn(open_age.id, self._ids(params))
