"""1:1 chat: who may start, send, read; mute/leave/report/block; websocket enforcement."""

from datetime import timedelta
from unittest.mock import AsyncMock, patch

from asgiref.sync import async_to_sync
from channels.testing import WebsocketCommunicator
from django.core.cache import cache
from django.test import TransactionTestCase, override_settings
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import AccessToken

from activities.models import ActivityParticipant
from activities.test_foyer import _activity, _safe_birthdate
from irlobby_backend.asgi import application
from moderation.models import AbuseReport, BlockedUser
from users.models import Friendship, User

from .models import Conversation, ConversationUserState, Message
from .tests import FakeRedis


def make(name, age=40, **extra):
    return User.objects.create_user(
        username=name,
        email=f"{name}@example.com",
        password="Passw0rd-123",
        first_name=name.capitalize(),
        date_of_birth=_safe_birthdate(age),
        **extra,
    )


def befriend(a, b):
    Friendship.objects.create(requester=a, recipient=b, status="accepted")


def shared_event(a, b):
    event = _activity(a, time=timezone.now() - timedelta(hours=3))
    ActivityParticipant.objects.create(activity=event, user=b, status="confirmed")
    return event


@patch("chat.views.send_new_message_notification")
class DirectChatRestTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.a, self.b = make("anna"), make("ben")
        self.client.force_authenticate(self.a)

    def start(self, target=None, user=None):
        if user:
            self.client.force_authenticate(user)
        return self.client.post(
            reverse("direct-conversations"), {"user_id": (target or self.b).id}, format="json"
        )

    def say(self, convo_id, text="hello"):
        return self.client.post(
            reverse("message-list", args=[convo_id]), {"message": text}, format="json"
        )

    def test_requires_auth(self, _push):
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get(reverse("direct-conversations")).status_code, 401)
        self.assertEqual(self.client.post(reverse("direct-conversations"), {}).status_code, 401)
        self.assertEqual(self.client.post(reverse("direct-mute", args=[1])).status_code, 401)

    def test_strangers_cannot_dm(self, _push):
        self.assertEqual(self.start().status_code, 403)
        self.assertFalse(Conversation.objects.exists())

    def test_friends_can_dm_and_conversation_is_reused(self, _push):
        befriend(self.a, self.b)
        first = self.start()
        self.assertEqual(first.status_code, 201)
        self.assertEqual(
            set(first.data), {"id", "other_user", "last_message", "muted", "can_send", "created_at"}
        )
        self.assertEqual(set(first.data["other_user"]), {"id", "first_name", "avatar_url"})
        self.assertTrue(first.data["can_send"])
        again = self.start(user=self.b, target=self.a)
        self.assertEqual(again.status_code, 200)
        self.assertEqual(again.data["id"], first.data["id"])
        self.assertEqual(Conversation.objects.count(), 1)
        self.assertEqual(self.say(first.data["id"], "<b>hi</b>").status_code, 201)
        self.assertEqual(Message.objects.get().text, "hi")
        listing = self.client.get(reverse("direct-conversations")).data["conversations"]
        self.assertEqual(listing[0]["last_message"]["message"], "hi")
        self.assertNotIn("example.com", str(listing))

    def test_cannot_message_self_or_unknown(self, _push):
        self.assertEqual(self.start(self.a).status_code, 400)
        self.assertEqual(
            self.client.post(
                reverse("direct-conversations"), {"user_id": 9999}, format="json"
            ).status_code,
            404,
        )
        self.assertEqual(
            self.client.post(
                reverse("direct-conversations"), {"user_id": "x"}, format="json"
            ).status_code,
            400,
        )

    def test_shared_event_dm_requires_recipient_opt_in(self, _push):
        shared_event(self.a, self.b)
        self.assertEqual(self.start().status_code, 403)
        User.objects.filter(pk=self.b.pk).update(dm_from_shared_events=True)
        self.assertEqual(self.start().status_code, 201)

    def test_opt_in_without_shared_event_still_403(self, _push):
        User.objects.filter(pk=self.b.pk).update(dm_from_shared_events=True)
        self.assertEqual(self.start().status_code, 403)

    def test_future_event_is_not_shared(self, _push):
        event = _activity(self.a)
        ActivityParticipant.objects.create(activity=event, user=self.b, status="confirmed")
        User.objects.filter(pk=self.b.pk).update(dm_from_shared_events=True)
        self.assertEqual(self.start().status_code, 403)

    def test_opted_in_person_can_reply_but_not_start(self, _push):
        shared_event(self.a, self.b)
        User.objects.filter(pk=self.b.pk).update(dm_from_shared_events=True)
        self.b.refresh_from_db()
        convo = self.start().data["id"]
        self.assertEqual(self.say(convo).status_code, 201)
        # b opted in so b can reply; a (not opted in) could not have been messaged by b first
        self.client.force_authenticate(self.b)
        self.assertEqual(self.say(convo, "reply").status_code, 201)
        # if b turns the setting off, a loses the ability to keep writing
        User.objects.filter(pk=self.b.pk).update(dm_from_shared_events=False)
        self.b.refresh_from_db()
        self.client.force_authenticate(self.a)
        self.assertEqual(self.say(convo, "again").status_code, 400)

    def test_sender_opt_in_lets_them_answer_someone_who_wrote_first(self, _push):
        # b writes to a as a friend; the friendship ends; a (opted in) may still answer.
        shared_event(self.a, self.b)
        User.objects.filter(pk=self.a.pk).update(dm_from_shared_events=True)
        self.a.refresh_from_db()
        befriend(self.a, self.b)
        convo = self.start(self.a, user=self.b).data["id"]
        self.say(convo, "hey")
        Friendship.objects.all().delete()
        self.client.force_authenticate(self.a)
        self.assertEqual(self.say(convo, "hi back").status_code, 201)
        self.client.force_authenticate(self.b)
        # a opted in to shared-event messages, so b may keep writing to a as well
        self.assertEqual(self.say(convo, "and again").status_code, 201)
        User.objects.filter(pk=self.a.pk).update(dm_from_shared_events=False)
        self.assertEqual(self.say(convo, "now closed").status_code, 400)

    def test_minors_are_friends_only_even_with_opt_in(self, _push):
        teen = make("teen", age=15, dm_from_shared_events=True)
        adult_opt = make("opt", dm_from_shared_events=True)
        shared_event(self.a, teen)
        self.assertEqual(self.start(teen).status_code, 403)
        # minor -> adult who opted in is also friends-only
        shared_event(adult_opt, teen)
        self.assertEqual(self.start(adult_opt, user=teen).status_code, 403)
        befriend(self.a, teen)
        self.assertEqual(self.start(teen, user=self.a).status_code, 201)

    def test_blocks_cut_both_ways(self, _push):
        befriend(self.a, self.b)
        convo = self.start().data["id"]
        self.say(convo)
        block = BlockedUser.objects.create(blocker=self.b, blocked=self.a)
        self.assertEqual(self.start().status_code, 404)
        self.assertEqual(self.say(convo, "x").status_code, 400)
        self.assertEqual(self.client.get(reverse("message-list", args=[convo])).data["results"], [])
        self.assertEqual(self.client.get(reverse("direct-conversations")).data["conversations"], [])
        block.delete()
        BlockedUser.objects.create(blocker=self.a, blocked=self.b)
        self.assertEqual(self.say(convo, "x").status_code, 400)
        self.client.force_authenticate(self.b)
        self.assertEqual(self.say(convo, "x").status_code, 400)
        self.assertEqual(self.client.get(reverse("direct-conversations")).data["conversations"], [])

    def test_outsider_cannot_read_write_or_manage(self, _push):
        befriend(self.a, self.b)
        convo = self.start().data["id"]
        self.say(convo, "secret")
        outsider = make("eve")
        self.client.force_authenticate(outsider)
        self.assertEqual(self.client.get(reverse("message-list", args=[convo])).data["results"], [])
        self.assertEqual(self.say(convo).status_code, 400)
        for name in ("direct-mute", "direct-leave", "direct-report", "direct-block"):
            self.assertEqual(self.client.post(reverse(name, args=[convo])).status_code, 404, name)

    def test_unfriending_stops_new_messages_but_history_stays(self, _push):
        befriend(self.a, self.b)
        convo = self.start().data["id"]
        self.say(convo, "one")
        Friendship.objects.all().delete()
        self.assertEqual(self.say(convo, "two").status_code, 400)
        self.assertEqual(self.client.get(reverse("message-list", args=[convo])).data["count"], 1)
        self.assertFalse(
            self.client.get(reverse("direct-conversations")).data["conversations"][0]["can_send"]
        )

    def test_mute_and_leave(self, _push):
        befriend(self.a, self.b)
        convo = self.start().data["id"]
        resp = self.client.post(
            reverse("direct-mute", args=[convo]), {"muted": True}, format="json"
        )
        self.assertTrue(resp.data["muted"])
        self.assertTrue(
            self.client.get(reverse("direct-conversations")).data["conversations"][0]["muted"]
        )
        self.assertFalse(
            self.client.post(
                reverse("direct-mute", args=[convo]), {"muted": "false"}, format="json"
            ).data["muted"]
        )
        self.assertEqual(self.client.post(reverse("direct-leave", args=[convo])).status_code, 200)
        self.assertEqual(self.client.get(reverse("direct-conversations")).data["conversations"], [])
        self.assertEqual(self.client.get(reverse("message-list", args=[convo])).data["results"], [])
        self.assertEqual(self.say(convo).status_code, 400)
        # the other person is unaffected, and starting again brings it back for me
        self.assertEqual(
            len(self.client.get(reverse("direct-conversations")).data["conversations"]), 0
        )
        again = self.start()
        self.assertEqual(again.status_code, 200)
        self.assertFalse(ConversationUserState.objects.get(user=self.a).left)
        self.client.force_authenticate(self.b)
        self.assertEqual(
            len(self.client.get(reverse("direct-conversations")).data["conversations"]), 1
        )

    def test_muted_or_left_recipient_gets_no_push(self, _push):
        from users.push_notifications import send_new_message_notification

        befriend(self.a, self.b)
        convo_id = self.start().data["id"]
        message = Message.objects.create(conversation_id=convo_id, sender=self.a, text="yo")
        with patch("users.push_notifications.send_push_to_user") as push:
            send_new_message_notification(message)
            self.assertEqual(push.call_count, 1)
            ConversationUserState.objects.create(conversation_id=convo_id, user=self.b, muted=True)
            send_new_message_notification(message)
            self.assertEqual(push.call_count, 1)

    def test_report_in_thread(self, _push):
        befriend(self.a, self.b)
        convo = self.start().data["id"]
        self.client.force_authenticate(self.b)
        msg_id = self.say(convo, "rude words").data["id"]
        self.client.force_authenticate(self.a)
        resp = self.client.post(
            reverse("direct-report", args=[convo]),
            {"reason": "harassment", "message_id": msg_id, "description": "<i>bad</i>"},
            format="json",
        )
        self.assertEqual(resp.status_code, 201)
        report = AbuseReport.objects.get()
        self.assertEqual(
            (report.reporter, report.reported_user, report.reason), (self.a, self.b, "harassment")
        )
        self.assertIn("rude words", report.description)
        self.assertNotIn("<i>", report.description)
        bad = self.client.post(
            reverse("direct-report", args=[convo]), {"reason": "nope"}, format="json"
        )
        self.assertEqual(bad.status_code, 400)
        bad = self.client.post(
            reverse("direct-report", args=[convo]), {"message_id": 99999}, format="json"
        )
        self.assertEqual(bad.status_code, 400)

    def test_block_from_thread_removes_friendship(self, _push):
        befriend(self.a, self.b)
        convo = self.start().data["id"]
        self.assertEqual(self.client.post(reverse("direct-block", args=[convo])).status_code, 201)
        self.assertTrue(BlockedUser.objects.filter(blocker=self.a, blocked=self.b).exists())
        self.assertFalse(Friendship.objects.exists())

    def test_legacy_conversation_list_excludes_direct_chats(self, _push):
        befriend(self.a, self.b)
        self.start()
        resp = self.client.get(reverse("conversation-list"))
        rows = resp.data["results"] if isinstance(resp.data, dict) else resp.data
        self.assertEqual(rows, [])

    @override_settings(REST_FRAMEWORK={"DEFAULT_THROTTLE_RATES": {"direct_messages": "2/min"}})
    def test_direct_sending_is_rate_limited_but_reading_is_not(self, _push):
        befriend(self.a, self.b)
        convo = self.start().data["id"]
        self.assertEqual(self.say(convo).status_code, 201)
        self.assertEqual(self.say(convo).status_code, 429)
        for _ in range(3):
            self.assertEqual(
                self.client.get(reverse("message-list", args=[convo])).status_code, 200
            )
        cache.clear()

    def test_gathering_chat_unaffected_by_direct_rules(self, _push):
        from matches.models import Match

        event = _activity(self.b)
        ActivityParticipant.objects.create(activity=event, user=self.a, status="confirmed")
        convo = Conversation.objects.create(
            match=Match.objects.create(user_a=self.a, user_b=self.b, activity=event)
        )
        self.assertEqual(self.say(convo.id).status_code, 201)  # strangers, but same gathering
        rows = self.client.get(reverse("conversation-list")).data
        rows = rows["results"] if isinstance(rows, dict) else rows
        self.assertEqual(len(rows), 1)

    def test_db_allows_one_direct_match_per_pair(self, _push):
        from django.db import IntegrityError, transaction

        from matches.models import Match

        Match.objects.create(user_a=self.a, user_b=self.b, activity=None)
        with self.assertRaises(IntegrityError), transaction.atomic():
            Match.objects.create(user_a=self.a, user_b=self.b, activity=None)


@override_settings(WEBSOCKET_ALLOWED_ORIGINS=["http://localhost:5173"])
class DirectChatWebsocketTests(TransactionTestCase):
    def setUp(self):
        self.a, self.b = make("anna"), make("ben")
        befriend(self.a, self.b)
        from chat.access import direct_conversation_for

        self.convo = direct_conversation_for(self.a, self.b, create=True)

    def _communicator(self, user):
        token = str(AccessToken.for_user(user))
        return WebsocketCommunicator(
            application,
            f"/ws/chat/{self.convo.id}/?token={token}",
            headers=[(b"origin", b"http://localhost:5173")],
        )

    @staticmethod
    async def _next_non_presence(comm):
        for _ in range(5):
            out = await comm.receive_json_from()
            if out["type"] != "chat.presence":
                return out
        raise AssertionError("no message received")

    @patch("chat.consumers.get_redis_client", new_callable=AsyncMock)
    def test_friend_connects_and_sends_without_email(self, redis_mock):
        redis_mock.return_value = FakeRedis()

        async def run():
            comm, connected = await self._open(self.a)
            assert connected
            await comm.send_json_to({"message": "hi"})
            out = await self._next_non_presence(comm)
            await comm.disconnect()
            return out

        out = async_to_sync(run)()
        self.assertEqual(out["message"], "hi")
        self.assertNotIn("email", out["user"])

    async def _open(self, user):
        comm = self._communicator(user)
        connected, _ = await comm.connect()
        if connected:
            await comm.receive_json_from()
        return comm, connected

    @patch("chat.consumers.get_redis_client", new_callable=AsyncMock)
    def test_blocked_user_cannot_connect(self, redis_mock):
        redis_mock.return_value = FakeRedis()
        BlockedUser.objects.create(blocker=self.b, blocked=self.a)

        async def run():
            comm = self._communicator(self.a)
            connected, _ = await comm.connect()
            return connected

        self.assertFalse(async_to_sync(run)())

    @patch("chat.consumers.get_redis_client", new_callable=AsyncMock)
    def test_outsider_and_left_user_cannot_connect(self, redis_mock):
        redis_mock.return_value = FakeRedis()
        outsider = make("eve")
        ConversationUserState.objects.create(conversation=self.convo, user=self.b, left=True)

        async def run(user):
            comm = self._communicator(user)
            connected, _ = await comm.connect()
            return connected

        self.assertFalse(async_to_sync(run)(outsider))
        self.assertFalse(async_to_sync(run)(self.b))

    @patch("chat.consumers.get_redis_client", new_callable=AsyncMock)
    def test_send_rechecked_after_unfriend_while_connected(self, redis_mock):
        redis_mock.return_value = FakeRedis()

        async def run():
            comm, connected = await self._open(self.a)
            assert connected
            from channels.db import database_sync_to_async

            await database_sync_to_async(Friendship.objects.all().delete)()
            await comm.send_json_to({"message": "still here?"})
            out = await self._next_non_presence(comm)
            await comm.disconnect()
            return out

        out = async_to_sync(run)()
        self.assertEqual(out["type"], "error")
        self.assertFalse(Message.objects.exists())
