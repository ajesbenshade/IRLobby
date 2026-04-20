from datetime import timedelta

from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from activities.models import Activity
from moderation.models import BlockedUser
from users.models import User

from .models import Match


class MatchModelTests(APITestCase):
    def setUp(self):
        self.user_a = User.objects.create_user(
            username="user-a", email="a@example.com", password="password123"
        )
        self.user_b = User.objects.create_user(
            username="user-b", email="b@example.com", password="password123"
        )
        self.activity = Activity.objects.create(
            host=self.user_a,
            is_approved=True,
            title="Test Activity",
            description="Test",
            location="Location",
            latitude=40.0,
            longitude=-74.0,
            time=timezone.now() + timedelta(days=1),
            capacity=10,
            tags=[],
            images=[],
        )

    def test_normalize_users_deterministic(self):
        a, b = Match._normalize_users(self.user_a, self.user_b)
        a2, b2 = Match._normalize_users(self.user_b, self.user_a)

        self.assertEqual(a.id, a2.id)
        self.assertEqual(b.id, b2.id)
        self.assertLessEqual(a.id, b.id)

    def test_get_or_create_normalized_idempotent(self):
        match1, created1 = Match.get_or_create_normalized(
            activity=self.activity, user_one=self.user_a, user_two=self.user_b
        )
        match2, created2 = Match.get_or_create_normalized(
            activity=self.activity, user_one=self.user_b, user_two=self.user_a
        )

        self.assertTrue(created1)
        self.assertFalse(created2)
        self.assertEqual(match1.id, match2.id)


class MatchListViewTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="match-user", email="match@example.com", password="password123"
        )
        self.other = User.objects.create_user(
            username="match-other", email="other@example.com", password="password123"
        )
        self.third = User.objects.create_user(
            username="match-third", email="third@example.com", password="password123"
        )
        self.activity = Activity.objects.create(
            host=self.other,
            is_approved=True,
            title="Match Activity",
            description="Test",
            location="Location",
            latitude=40.0,
            longitude=-74.0,
            time=timezone.now() + timedelta(days=1),
            capacity=10,
            tags=[],
            images=[],
        )

    def test_match_list_returns_own_matches(self):
        Match.objects.create(user_a=self.user, user_b=self.other, activity=self.activity)

        self.client.force_authenticate(self.user)
        response = self.client.get(reverse("match-list"))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = (
            response.data if isinstance(response.data, list) else response.data.get("results", [])
        )
        self.assertEqual(len(results), 1)

    def test_match_list_excludes_other_users_matches(self):
        Match.objects.create(user_a=self.other, user_b=self.third, activity=self.activity)

        self.client.force_authenticate(self.user)
        response = self.client.get(reverse("match-list"))

        results = (
            response.data if isinstance(response.data, list) else response.data.get("results", [])
        )
        self.assertEqual(len(results), 0)

    def test_match_list_excludes_blocked_users(self):
        Match.objects.create(user_a=self.user, user_b=self.other, activity=self.activity)
        BlockedUser.objects.create(blocker=self.user, blocked=self.other)

        self.client.force_authenticate(self.user)
        response = self.client.get(reverse("match-list"))

        results = (
            response.data if isinstance(response.data, list) else response.data.get("results", [])
        )
        self.assertEqual(len(results), 0)

    def test_match_list_excludes_blocked_by_users(self):
        Match.objects.create(user_a=self.user, user_b=self.other, activity=self.activity)
        BlockedUser.objects.create(blocker=self.other, blocked=self.user)

        self.client.force_authenticate(self.user)
        response = self.client.get(reverse("match-list"))

        results = (
            response.data if isinstance(response.data, list) else response.data.get("results", [])
        )
        self.assertEqual(len(results), 0)

    def test_unauthenticated_cannot_list_matches(self):
        response = self.client.get(reverse("match-list"))
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
