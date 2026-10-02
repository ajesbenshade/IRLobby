"""People blocked either way are hidden from a gathering's chat and attendee list."""

from unittest.mock import AsyncMock, patch

from asgiref.sync import async_to_sync
from channels.testing import WebsocketCommunicator
from django.test import TransactionTestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import AccessToken

from activities.models import ActivityParticipant
from activities.test_foyer import _activity, _safe_birthdate
from chat.models import Conversation, Message
from chat.tests import FakeRedis
from irlobby_backend.asgi import application
from matches.models import Match
from moderation.models import BlockedUser
from users.models import User


def _user(name):
    return User.objects.create_user(
        username=name,
        email=f"{name}@example.com",
        password="Pass-12345-xyz",
        first_name=name.title(),
        date_of_birth=_safe_birthdate(30),
        sex="male",
    )


class GatheringChatBlockTests(APITestCase):
    def setUp(self):
        self.host = _user("blkhost")
        self.viewer = _user("blkviewer")
        self.noisy = _user("blknoisy")
        self.friendly = _user("blkfriendly")
        self.activity = _activity(self.host)
        for user in (self.viewer, self.noisy, self.friendly):
            ActivityParticipant.objects.create(
                activity=self.activity, user=user, status="confirmed", include_self=True
            )
        self.match, _ = Match.get_or_create_normalized(self.activity, self.viewer, self.friendly)
        self.conversation = Conversation.objects.create(match=self.match)
        self.noisy_msg = Message.objects.create(
            conversation=self.conversation, sender=self.noisy, text="from noisy"
        )
        self.friendly_msg = Message.objects.create(
            conversation=self.conversation, sender=self.friendly, text="from friendly"
        )

    def texts(self, response):
        data = response.data
        if isinstance(data, dict):
            data = data["results"]
        return [m["message"] for m in data]

    def test_activity_chat_hides_blocked_senders_both_ways(self):
        self.client.force_authenticate(self.viewer)
        url = reverse("activity-chat", args=[self.activity.id])
        self.assertEqual(len(self.client.get(url).data), 2)
        # Viewer blocked noisy.
        BlockedUser.objects.create(blocker=self.viewer, blocked=self.noisy)
        self.assertEqual(self.texts(self.client.get(url)), ["from friendly"])
        # The block works the other way too, and other viewers are unaffected.
        BlockedUser.objects.all().delete()
        BlockedUser.objects.create(blocker=self.noisy, blocked=self.viewer)
        self.assertEqual(self.texts(self.client.get(url)), ["from friendly"])
        self.client.force_authenticate(self.friendly)
        self.assertEqual(len(self.client.get(url).data), 2)

    def test_message_list_hides_blocked_senders(self):
        self.client.force_authenticate(self.viewer)
        url = reverse("message-list", args=[self.conversation.id])
        self.assertEqual(self.client.get(url).status_code, status.HTTP_200_OK)
        self.assertEqual(len(self.texts(self.client.get(url))), 2)
        BlockedUser.objects.create(blocker=self.noisy, blocked=self.viewer)
        self.assertEqual(self.texts(self.client.get(url)), ["from friendly"])

    def test_conversation_list_nested_messages_hide_blocked_senders(self):
        self.client.force_authenticate(self.viewer)
        BlockedUser.objects.create(blocker=self.viewer, blocked=self.noisy)
        response = self.client.get(reverse("conversation-list"))
        results = (
            response.data if isinstance(response.data, list) else response.data.get("results", [])
        )
        self.assertEqual(len(results), 1)
        self.assertEqual([m["message"] for m in results[0]["messages"]], ["from friendly"])

    def test_host_attendee_list_hides_blocked_households(self):
        self.client.force_authenticate(self.host)
        url = reverse("activity-attendees", args=[self.activity.id])
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["going_count"], 3)
        self.assertEqual(len(response.data["households"]), 3)
        BlockedUser.objects.create(blocker=self.noisy, blocked=self.host)
        response = self.client.get(url)
        self.assertEqual(response.data["going_count"], 3)
        names = [h["name"] for h in response.data["households"]]
        self.assertEqual(len(response.data["households"]), 2)
        self.assertFalse(any("Blknoisy" in n for n in names))


class ActivitySocketBlockTests(TransactionTestCase):
    def setUp(self):
        self.host = _user("wshost")
        self.sender = _user("wssender")
        self.blocked = _user("wsblocked")
        self.other = _user("wsother")
        self.activity = _activity(self.host)
        for user in (self.sender, self.blocked, self.other):
            ActivityParticipant.objects.create(
                activity=self.activity, user=user, status="confirmed", include_self=True
            )
        BlockedUser.objects.create(blocker=self.blocked, blocked=self.sender)

    def communicator(self, user):
        token = str(AccessToken.for_user(user))
        return WebsocketCommunicator(
            application,
            f"/ws/?token={token}&activityId={self.activity.id}",
            headers=[(b"origin", b"http://localhost:5173")],
        )

    @staticmethod
    async def drain(communicator):
        seen = []
        while not await communicator.receive_nothing(timeout=0.3):
            seen.append(await communicator.receive_json_from())
        return seen

    def test_blocked_user_never_receives_the_senders_events(self):
        async def run():
            sender = self.communicator(self.sender)
            blocked = self.communicator(self.blocked)
            other = self.communicator(self.other)
            for comm in (blocked, other, sender):
                self.assertTrue((await comm.connect())[0])
                await comm.send_json_to({"type": "join_activity", "activityId": self.activity.id})
            await sender.send_json_to(
                {"type": "send_message", "activityId": self.activity.id, "message": "hello all"}
            )
            await sender.send_json_to(
                {"type": "typing", "activityId": self.activity.id, "isTyping": True}
            )
            await sender.send_json_to(
                {"type": "read_message", "activityId": self.activity.id, "messageId": 1}
            )
            blocked_seen = await self.drain(blocked)
            other_seen = await self.drain(other)
            await self.drain(sender)
            for comm in (sender, blocked, other):
                await comm.disconnect()
            return blocked_seen, other_seen

        with (
            patch("chat.consumers.get_redis_client", new=AsyncMock(return_value=FakeRedis())),
            patch("chat.consumers.set_user_online", new=AsyncMock()),
            patch("chat.consumers.clear_user_online", new=AsyncMock()),
        ):
            blocked_seen, other_seen = async_to_sync(run)()

        def from_sender(events):
            out = []
            for event in events:
                data = event.get("data") or event.get("payload") or event
                if data.get("userId") == self.sender.id:
                    out.append(event)
            return out

        # The unblocked member sees the sender's presence, message, typing and read receipt.
        self.assertTrue(any(e.get("type") == "chat_message" for e in other_seen))
        self.assertGreaterEqual(len(from_sender(other_seen)), 3)
        # The blocked member sees none of it; the rest of the room still works for them.
        self.assertEqual(from_sender(blocked_seen), [])
        self.assertFalse(any(e.get("type") == "chat_message" for e in blocked_seen))
        self.assertTrue(any(e.get("type") == "joined_activity" for e in blocked_seen))
