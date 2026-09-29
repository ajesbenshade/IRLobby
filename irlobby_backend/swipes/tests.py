from datetime import timedelta
from unittest.mock import patch

from django.core.cache import cache
from django.test import override_settings
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from activities.models import Activity, ActivityParticipant
from chat.models import Conversation, Message
from matches.models import Match
from moderation.models import BlockedUser
from users.models import User

from .models import Swipe


class SwipeTests(APITestCase):
    def setUp(self):
        cache.clear()
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
        self.assertIn("matchId", response.data)
        self.assertIn("conversationId", response.data)
        self.assertTrue(Match.objects.filter(activity=self.activity).exists())
        self.assertTrue(Conversation.objects.filter(match_id=response.data["matchId"]).exists())

    @patch("chat.views.send_new_message_notification")
    def test_swipe_match_chat_flow_creates_conversation_and_allows_message(self, mock_push):
        user_activity = Activity.objects.create(
            host=self.user,
            is_approved=True,
            title="User Hosted Plan",
            description="A reciprocal plan.",
            location="Location",
            latitude=40.0,
            longitude=-74.0,
            time=timezone.now() + timedelta(days=1),
            capacity=10,
            tags=[],
            images=[],
        )
        Swipe.objects.create(user=self.host, activity=user_activity, direction="right")

        self.client.force_authenticate(self.user)
        swipe_response = self.client.post(
            reverse("swipe-activity", args=[self.activity.pk]),
            {"direction": "right"},
            format="json",
        )

        self.assertEqual(swipe_response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(swipe_response.data["matched"])
        conversation_id = swipe_response.data["conversationId"]
        ActivityParticipant.objects.create(
            activity=self.activity,
            user=self.user,
            status="confirmed",
            include_self=True,
        )

        conversations_response = self.client.get(reverse("conversation-list"))
        self.assertEqual(conversations_response.status_code, status.HTTP_200_OK)
        conversations = (
            conversations_response.data
            if isinstance(conversations_response.data, list)
            else conversations_response.data.get("results", [])
        )
        self.assertEqual(conversations[0]["id"], conversation_id)

        message_response = self.client.post(
            reverse("message-list", args=[conversation_id]),
            {"message": "Let us make this happen."},
            format="json",
        )

        self.assertEqual(message_response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(
            Message.objects.filter(
                conversation_id=conversation_id,
                sender=self.user,
                text="Let us make this happen.",
            ).exists()
        )
        mock_push.assert_called_once()

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

    @override_settings(REST_FRAMEWORK={"DEFAULT_THROTTLE_RATES": {"swipe_ops": "1/min"}})
    def test_swipe_endpoint_is_rate_limited(self):
        second_activity = Activity.objects.create(
            host=self.host,
            is_approved=True,
            title="Second Activity",
            description="Another test activity",
            location="Test Location",
            latitude=41.0,
            longitude=-73.0,
            time=timezone.now() + timedelta(days=2),
            capacity=10,
            tags=[],
            images=[],
        )

        self.client.force_authenticate(self.user)
        first_response = self.client.post(
            reverse("swipe-activity", args=[self.activity.pk]),
            {"direction": "right"},
            format="json",
        )
        second_response = self.client.post(
            reverse("swipe-activity", args=[second_activity.pk]),
            {"direction": "left"},
            format="json",
        )

        self.assertEqual(first_response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(second_response.status_code, status.HTTP_429_TOO_MANY_REQUESTS)

    @override_settings(SWIPE_DAILY_LIMIT=1)
    def test_swipe_activity_enforces_daily_limit(self):
        second_activity = Activity.objects.create(
            host=self.host,
            is_approved=True,
            title="Daily Limit Activity",
            description="Another test activity",
            location="Test Location",
            latitude=41.0,
            longitude=-73.0,
            time=timezone.now() + timedelta(days=2),
            capacity=10,
            tags=[],
            images=[],
        )

        self.client.force_authenticate(self.user)
        first_response = self.client.post(
            reverse("swipe-activity", args=[self.activity.pk]),
            {"direction": "right"},
            format="json",
        )
        second_response = self.client.post(
            reverse("swipe-activity", args=[second_activity.pk]),
            {"direction": "left"},
            format="json",
        )

        self.assertEqual(first_response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(second_response.status_code, status.HTTP_429_TOO_MANY_REQUESTS)

    @override_settings(SWIPE_DAILY_LIMIT=1)
    def test_invalid_swipe_does_not_consume_daily_limit(self):
        self.client.force_authenticate(self.user)
        invalid_response = self.client.post(
            reverse("swipe-activity", args=[self.activity.pk]),
            {"direction": "up"},
            format="json",
        )
        valid_response = self.client.post(
            reverse("swipe-activity", args=[self.activity.pk]),
            {"direction": "right"},
            format="json",
        )

        self.assertEqual(invalid_response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(valid_response.status_code, status.HTTP_201_CREATED)

    @override_settings(SWIPE_DAILY_LIMIT=1)
    def test_swipe_list_create_enforces_daily_limit(self):
        second_activity = Activity.objects.create(
            host=self.host,
            is_approved=True,
            title="List Daily Limit Activity",
            description="Another test activity",
            location="Test Location",
            latitude=42.0,
            longitude=-72.0,
            time=timezone.now() + timedelta(days=2),
            capacity=10,
            tags=[],
            images=[],
        )

        self.client.force_authenticate(self.user)
        first_response = self.client.post(
            reverse("swipe-list"),
            {"activity": self.activity.pk, "direction": "right"},
            format="json",
        )
        second_response = self.client.post(
            reverse("swipe-list"),
            {"activity": second_activity.pk, "direction": "left"},
            format="json",
        )

        self.assertEqual(first_response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(second_response.status_code, status.HTTP_429_TOO_MANY_REQUESTS)

    @override_settings(SWIPE_DAILY_LIMIT=1)
    def test_duplicate_swipe_list_create_does_not_hit_daily_limit(self):
        self.client.force_authenticate(self.user)
        first_response = self.client.post(
            reverse("swipe-list"),
            {"activity": self.activity.pk, "direction": "right"},
            format="json",
        )
        duplicate_response = self.client.post(
            reverse("swipe-list"),
            {"activity": self.activity.pk, "direction": "left"},
            format="json",
        )

        self.assertEqual(first_response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(duplicate_response.status_code, status.HTTP_400_BAD_REQUEST)
