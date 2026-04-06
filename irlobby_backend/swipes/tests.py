from datetime import timedelta

from activities.models import Activity
from django.urls import reverse
from django.utils import timezone
from matches.models import Match
from moderation.models import BlockedUser
from rest_framework import status
from rest_framework.test import APITestCase
from users.models import User

from .models import Swipe


class SwipeTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="swiper", email="swiper@example.com", password="password123"
        )
        self.host = User.objects.create_user(
            username="host", email="host@example.com", password="password123"
        )
        self.activity = Activity.objects.create(
            host=self.host,
            is_approved=True,
            title="Test Activity",
            description="A test activity",
            location="Test Location",
            latitude=40.0,
            longitude=-74.0,
            time=timezone.now() + timedelta(days=1),
            capacity=10,
            tags=[],
            images=[],
        )

    def test_swipe_right_creates_swipe(self):
        self.client.force_authenticate(self.user)
        url = reverse("swipe-activity", args=[self.activity.pk])
        response = self.client.post(url, {"direction": "right"}, format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertFalse(response.data["matched"])
        self.assertTrue(Swipe.objects.filter(user=self.user, activity=self.activity).exists())

    def test_swipe_left_creates_swipe(self):
        self.client.force_authenticate(self.user)
        url = reverse("swipe-activity", args=[self.activity.pk])
        response = self.client.post(url, {"direction": "left"}, format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertFalse(response.data["matched"])

    def test_invalid_direction_rejected(self):
        self.client.force_authenticate(self.user)
        url = reverse("swipe-activity", args=[self.activity.pk])
        response = self.client.post(url, {"direction": "up"}, format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_duplicate_swipe_rejected(self):
        self.client.force_authenticate(self.user)
        url = reverse("swipe-activity", args=[self.activity.pk])
        self.client.post(url, {"direction": "right"}, format="json")
        response = self.client.post(url, {"direction": "right"}, format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_mutual_right_swipe_creates_match(self):
        # User creates an activity
        user_activity = Activity.objects.create(
            host=self.user,
            is_approved=True,
            title="User Activity",
            description="By user",
            location="Location",
            latitude=40.0,
            longitude=-74.0,
            time=timezone.now() + timedelta(days=1),
            capacity=10,
            tags=[],
            images=[],
        )
        # Host swipes right on user's activity
        Swipe.objects.create(user=self.host, activity=user_activity, direction="right")

        # User swipes right on host's activity
        self.client.force_authenticate(self.user)
        url = reverse("swipe-activity", args=[self.activity.pk])
        response = self.client.post(url, {"direction": "right"}, format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(response.data["matched"])
        self.assertTrue(Match.objects.filter(activity=self.activity).exists())

    def test_swipe_list_returns_only_own_swipes(self):
        Swipe.objects.create(user=self.user, activity=self.activity, direction="right")
        other = User.objects.create_user(
            username="other", email="other@example.com", password="password123"
        )
        other_activity = Activity.objects.create(
            host=self.host,
            is_approved=True,
            title="Other Activity",
            description="Other",
            location="Loc",
            latitude=40.0,
            longitude=-74.0,
            time=timezone.now() + timedelta(days=1),
            capacity=10,
            tags=[],
            images=[],
        )
        Swipe.objects.create(user=other, activity=other_activity, direction="left")

        self.client.force_authenticate(self.user)
        response = self.client.get(reverse("swipe-list"))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = (
            response.data if isinstance(response.data, list) else response.data.get("results", [])
        )
        self.assertEqual(len(results), 1)

    def test_blocked_user_cannot_swipe(self):
        BlockedUser.objects.create(blocker=self.host, blocked=self.user)

        self.client.force_authenticate(self.user)
        url = reverse("swipe-activity", args=[self.activity.pk])
        response = self.client.post(url, {"direction": "right"}, format="json")

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_unauthenticated_cannot_swipe(self):
        url = reverse("swipe-activity", args=[self.activity.pk])
        response = self.client.post(url, {"direction": "right"}, format="json")

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
