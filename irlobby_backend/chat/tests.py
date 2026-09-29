from datetime import timedelta
from unittest.mock import AsyncMock, patch

from asgiref.sync import async_to_sync
from channels.testing import WebsocketCommunicator
from django.test import TransactionTestCase
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import AccessToken, RefreshToken

from activities.models import Activity, ActivityParticipant
from irlobby_backend.asgi import application
from matches.models import Match
from moderation.models import BlockedUser
from users.models import User

from .middleware import JwtAuthMiddleware
from .models import Conversation, Message


class FakeRedis:
    def __init__(self):
        self.values = {}

    async def setex(self, key, ttl, value):
        self.values[key] = value

    async def delete(self, key):
        self.values.pop(key, None)

    async def get(self, key):
        return self.values.get(key)


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
        ActivityParticipant.objects.create(
            activity=self.activity, user=self.user, status="confirmed", include_self=True
        )

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
        self.activity = activity
        ActivityParticipant.objects.create(
            activity=activity, user=self.user, status="confirmed", include_self=True
        )

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


class JwtAuthMiddlewareTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="socket-user", email="socket@example.com", password="password123"
        )
        self.middleware = JwtAuthMiddleware(lambda scope, receive, send: None)

    def test_extract_token_from_authorization_header(self):
        token = str(AccessToken.for_user(self.user))
        scope = {"headers": [(b"authorization", f"Bearer {token}".encode("utf-8"))]}

        self.assertEqual(self.middleware._extract_token(scope), token)

    def test_refresh_token_is_rejected_for_websocket_auth(self):
        refresh_token = str(RefreshToken.for_user(self.user))

        authenticated_user = async_to_sync(self.middleware._get_user_from_token)(refresh_token)

        self.assertTrue(authenticated_user.is_anonymous)


class WebSocketOriginSecurityTests(TransactionTestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="origin-user", email="origin@example.com", password="password123"
        )

    def test_disallowed_origin_is_rejected(self):
        token = str(AccessToken.for_user(self.user))

        async def run_test():
            communicator = WebsocketCommunicator(
                application,
                f"/ws/?token={token}",
                headers=[(b"origin", b"https://evil.example")],
            )
            connected, _ = await communicator.connect()
            self.assertFalse(connected)

        async_to_sync(run_test)()

    @patch("chat.consumers.clear_user_online")
    @patch("chat.consumers.set_user_online")
    def test_allowed_origin_and_access_token_can_connect(
        self, mock_set_user_online, mock_clear_user_online
    ):
        token = str(AccessToken.for_user(self.user))

        async def run_test():
            communicator = WebsocketCommunicator(
                application,
                f"/ws/?token={token}",
                headers=[(b"origin", b"http://localhost:5173")],
            )
            connected, _ = await communicator.connect()
            self.assertTrue(connected)
            await communicator.disconnect()

        async_to_sync(run_test)()
        self.assertGreaterEqual(mock_set_user_online.await_count, 1)
        self.assertGreaterEqual(mock_clear_user_online.await_count, 1)


class ChatPresenceTypingTests(TransactionTestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="presence-user", email="presence@example.com", password="password123"
        )
        self.other = User.objects.create_user(
            username="presence-other", email="presence-other@example.com", password="password123"
        )
        self.activity = Activity.objects.create(
            host=self.other,
            is_approved=True,
            title="Presence Activity",
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
        ActivityParticipant.objects.create(
            activity=self.activity, user=self.user, status="confirmed", include_self=True
        )

    def _communicator(self, user):
        token = str(AccessToken.for_user(user))
        return WebsocketCommunicator(
            application,
            f"/ws/chat/{self.conversation.id}/?token={token}",
            headers=[(b"origin", b"http://localhost:5173")],
        )

    def test_chat_connect_sends_presence_snapshot(self):
        fake_redis = FakeRedis()
        fake_redis.values[f"user_online:{self.other.id}"] = "1"

        async def run_test():
            communicator = self._communicator(self.user)
            connected, _ = await communicator.connect()
            self.assertTrue(connected)

            snapshot = await communicator.receive_json_from()
            self.assertEqual(snapshot["type"], "chat.presence_snapshot")
            users = {item["userId"]: item["isOnline"] for item in snapshot["users"]}
            self.assertTrue(users[self.user.id])
            self.assertTrue(users[self.other.id])

            presence = await communicator.receive_json_from()
            self.assertEqual(presence["type"], "chat.presence")
            self.assertEqual(presence["userId"], self.user.id)
            self.assertTrue(presence["isOnline"])

            await communicator.disconnect()

        with patch("chat.consumers.get_redis_client", new=AsyncMock(return_value=fake_redis)):
            async_to_sync(run_test)()

    def test_chat_typing_event_has_typed_payload(self):
        fake_redis = FakeRedis()

        async def run_test():
            communicator = self._communicator(self.user)
            connected, _ = await communicator.connect()
            self.assertTrue(connected)

            await communicator.receive_json_from()
            await communicator.receive_json_from()

            await communicator.send_json_to({"type": "typing", "isTyping": True})
            payload = await communicator.receive_json_from()

            self.assertEqual(payload["type"], "chat.typing")
            self.assertEqual(payload["conversationId"], self.conversation.id)
            self.assertEqual(payload["userId"], self.user.id)
            self.assertTrue(payload["isTyping"])

            await communicator.disconnect()

        with patch("chat.consumers.get_redis_client", new=AsyncMock(return_value=fake_redis)):
            async_to_sync(run_test)()
