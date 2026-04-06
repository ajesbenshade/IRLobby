from datetime import timedelta
from unittest.mock import patch

from activities.models import Activity
from django.urls import reverse
from django.utils import timezone
from matches.models import Match
from moderation.models import BlockedUser
from rest_framework import status
from rest_framework.test import APITestCase
from users.models import User

from .models import Conversation, Message


class ConversationListTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="chat-user", email="chat@example.com", password="password123"
        )
        self.other = User.objects.create_user(
            username="chat-other", email="other@example.com", password="password123"
        )
        self.third = User.objects.create_user(
            username="chat-third", email="third@example.com", password="password123"
        )
        self.activity = Activity.objects.create(
            host=self.other,
            is_approved=True,
            title="Chat Activity",
            description="Test",
            location="Location",
            latitude=40.0,
            longitude=-74.0,
            time=timezone.now() + timedelta(days=1),
            capacity=10,
            tags=[],
            images=[],
        )
        self.match = Match.objects.create(
            user_a=self.user, user_b=self.other, activity=self.activity
        )
        self.conversation = Conversation.objects.create(match=self.match)

    def test_conversation_list_returns_own_conversations(self):
        self.client.force_authenticate(self.user)
        response = self.client.get(reverse("conversation-list"))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = (
            response.data if isinstance(response.data, list) else response.data.get("results", [])
        )
        self.assertEqual(len(results), 1)

    def test_conversation_list_excludes_others(self):
        other_match = Match.objects.create(
            user_a=self.other, user_b=self.third, activity=self.activity
        )
        Conversation.objects.create(match=other_match)

        self.client.force_authenticate(self.user)
        response = self.client.get(reverse("conversation-list"))

        results = (
            response.data if isinstance(response.data, list) else response.data.get("results", [])
        )
        self.assertEqual(len(results), 1)

    def test_conversation_list_excludes_blocked_users(self):
        BlockedUser.objects.create(blocker=self.user, blocked=self.other)

        self.client.force_authenticate(self.user)
        response = self.client.get(reverse("conversation-list"))

        results = (
            response.data if isinstance(response.data, list) else response.data.get("results", [])
        )
        self.assertEqual(len(results), 0)

    def test_unauthenticated_cannot_list_conversations(self):
        response = self.client.get(reverse("conversation-list"))
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)


class MessageListTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="msg-user", email="msg@example.com", password="password123"
        )
        self.other = User.objects.create_user(
            username="msg-other", email="msg-other@example.com", password="password123"
        )
        self.outsider = User.objects.create_user(
            username="msg-outsider", email="outsider@example.com", password="password123"
        )
        activity = Activity.objects.create(
            host=self.other,
            is_approved=True,
            title="Msg Activity",
            description="Test",
            location="Location",
            latitude=40.0,
            longitude=-74.0,
            time=timezone.now() + timedelta(days=1),
            capacity=10,
            tags=[],
            images=[],
        )
        self.match = Match.objects.create(user_a=self.user, user_b=self.other, activity=activity)
        self.conversation = Conversation.objects.create(match=self.match)

    def test_participant_can_list_messages(self):
        Message.objects.create(conversation=self.conversation, sender=self.user, text="Hello!")
        self.client.force_authenticate(self.user)
        url = reverse("message-list", args=[self.conversation.id])
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = (
            response.data if isinstance(response.data, list) else response.data.get("results", [])
        )
        self.assertEqual(len(results), 1)

    def test_non_participant_gets_empty_messages(self):
        Message.objects.create(conversation=self.conversation, sender=self.user, text="Secret")
        self.client.force_authenticate(self.outsider)
        url = reverse("message-list", args=[self.conversation.id])
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = (
            response.data if isinstance(response.data, list) else response.data.get("results", [])
        )
        self.assertEqual(len(results), 0)

    @patch("chat.views.send_new_message_notification")
    def test_participant_can_send_message(self, mock_push):
        self.client.force_authenticate(self.user)
        url = reverse("message-list", args=[self.conversation.id])
        response = self.client.post(url, {"message": "Hi there"}, format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(
            Message.objects.filter(conversation=self.conversation, sender=self.user).exists()
        )
        mock_push.assert_called_once()

    @patch("chat.views.send_new_message_notification")
    def test_non_participant_cannot_send_message(self, mock_push):
        self.client.force_authenticate(self.outsider)
        url = reverse("message-list", args=[self.conversation.id])
        response = self.client.post(url, {"message": "Intruder"}, format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        mock_push.assert_not_called()

    @patch("chat.views.send_new_message_notification")
    def test_message_html_sanitized(self, mock_push):
        self.client.force_authenticate(self.user)
        url = reverse("message-list", args=[self.conversation.id])
        response = self.client.post(
            url, {"message": '<script>alert("xss")</script>Hello'}, format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        msg = Message.objects.filter(conversation=self.conversation).first()
        self.assertNotIn("<script>", msg.text)
        self.assertIn("Hello", msg.text)
