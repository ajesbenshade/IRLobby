"""Circles and prayer requests: visibility, I'm praying, and the shared prayer chat."""

from datetime import timedelta
from unittest.mock import patch

from django.db import IntegrityError, transaction
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from activities.models import Activity, Church
from chat.models import Conversation, Message
from matches.models import Match
from moderation.models import AbuseReport, BlockedUser
from prayers.models import (
    Circle,
    CircleMembership,
    PrayerParticipant,
    PrayerPass,
    PrayerRequest,
)
from users.models import User


def make_user(name, church=None, first_name=None, last_name="Lee"):
    user = User.objects.create_user(
        username=name,
        email=f"{name}@example.com",
        password="Passw0rd-123",
        first_name=first_name if first_name is not None else name.capitalize(),
        last_name=last_name,
    )
    if church is not None:
        user.church = church
        user.save(update_fields=["church"])
    return user


def results(response):
    data = response.data
    if isinstance(data, list):
        return data
    return data.get("results", [])


class CircleApiTests(APITestCase):
    def setUp(self):
        self.church = Church.objects.create(name="Franconia")
        self.other_church = Church.objects.create(name="Souderton")
        self.member = make_user("sarah", self.church, first_name="Sarah")
        self.stranger = make_user("noah", self.other_church, first_name="Noah")
        self.unchurched = make_user("pat", None, first_name="Pat")

    def test_auth_required(self):
        self.assertEqual(
            self.client.get(reverse("circle-list")).status_code, status.HTTP_401_UNAUTHORIZED
        )
        self.assertEqual(
            self.client.post(reverse("circle-list"), {}, format="json").status_code,
            status.HTTP_401_UNAUTHORIZED,
        )
        circle = Circle.objects.create(
            church=self.church, name="Young Adults", created_by=self.member
        )
        self.assertEqual(
            self.client.post(reverse("circle-join", args=[circle.id])).status_code,
            status.HTTP_401_UNAUTHORIZED,
        )
        self.assertEqual(
            self.client.post(reverse("circle-leave", args=[circle.id])).status_code,
            status.HTTP_401_UNAUTHORIZED,
        )

    def test_create_lists_membership_and_rejects_duplicates(self):
        self.client.force_authenticate(self.member)
        created = self.client.post(
            reverse("circle-list"), {"name": "  Young   Adults  "}, format="json"
        )
        self.assertEqual(created.status_code, status.HTTP_201_CREATED)
        self.assertEqual(created.data["name"], "Young Adults")
        self.assertTrue(created.data["is_member"])
        self.assertEqual(created.data["member_count"], 1)
        self.assertEqual(created.data["church_id"], self.church.id)

        again = self.client.post(reverse("circle-list"), {"name": "young adults"}, format="json")
        self.assertEqual(again.status_code, status.HTTP_400_BAD_REQUEST)

        listing = self.client.get(reverse("circle-list"))
        self.assertEqual(listing.status_code, status.HTTP_200_OK)
        self.assertEqual(listing.data["church_id"], self.church.id)
        self.assertEqual([row["name"] for row in listing.data["circles"]], ["Young Adults"])

    def test_other_church_cannot_see_or_join(self):
        circle = Circle.objects.create(
            church=self.church, name="Young Adults", created_by=self.member
        )
        self.client.force_authenticate(self.stranger)
        listing = self.client.get(reverse("circle-list"))
        self.assertEqual(listing.data["circles"], [])
        self.assertEqual(
            self.client.post(reverse("circle-join", args=[circle.id])).status_code,
            status.HTTP_404_NOT_FOUND,
        )
        self.assertEqual(
            self.client.post(reverse("circle-leave", args=[circle.id])).status_code,
            status.HTTP_404_NOT_FOUND,
        )

    def test_join_leave_and_member_first_order(self):
        young = Circle.objects.create(
            church=self.church, name="Young Adults", created_by=self.member
        )
        parents = Circle.objects.create(church=self.church, name="Parents", created_by=self.member)
        CircleMembership.objects.create(circle=young, user=self.member)
        self.client.force_authenticate(self.member)
        listing = self.client.get(reverse("circle-list"))
        self.assertEqual(
            [row["name"] for row in listing.data["circles"]], ["Young Adults", "Parents"]
        )
        self.assertTrue(listing.data["circles"][0]["is_member"])
        self.assertFalse(listing.data["circles"][1]["is_member"])

        joined = self.client.post(reverse("circle-join", args=[parents.id]))
        self.assertEqual(joined.status_code, status.HTTP_201_CREATED)
        self.assertTrue(joined.data["is_member"])
        self.assertEqual(joined.data["member_count"], 1)
        again = self.client.post(reverse("circle-join", args=[parents.id]))
        self.assertEqual(again.status_code, status.HTTP_200_OK)

        left = self.client.post(reverse("circle-leave", args=[parents.id]))
        self.assertEqual(left.status_code, status.HTTP_200_OK)
        self.assertFalse(left.data["is_member"])
        self.assertEqual(left.data["member_count"], 0)
        # Leaving twice is fine.
        self.assertEqual(
            self.client.post(reverse("circle-leave", args=[parents.id])).status_code,
            status.HTTP_200_OK,
        )

    def test_unchurched_user_cannot_join_a_circle(self):
        circle = Circle.objects.create(church=self.church, name="Youth", created_by=self.member)
        self.client.force_authenticate(self.unchurched)
        self.assertEqual(
            self.client.post(reverse("circle-join", args=[circle.id])).status_code,
            status.HTTP_404_NOT_FOUND,
        )

    def test_no_church_cannot_create(self):
        self.client.force_authenticate(self.unchurched)
        listing = self.client.get(reverse("circle-list"))
        self.assertIsNone(listing.data["church_id"])
        self.assertEqual(listing.data["circles"], [])
        response = self.client.post(reverse("circle-list"), {"name": "Youth"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class PrayerApiTests(APITestCase):
    def setUp(self):
        self.church = Church.objects.create(name="Franconia")
        self.other_church = Church.objects.create(name="Souderton")
        self.author = make_user("sarah", self.church, first_name="Sarah")
        self.member = make_user("anna", self.church, first_name="Anna")
        self.same_church = make_user("daniel", self.church, first_name="Daniel")
        self.outsider = make_user("noah", self.other_church, first_name="Noah")
        self.unchurched = make_user("pat", None, first_name="Pat")
        self.circle = Circle.objects.create(
            church=self.church, name="Young Adults", created_by=self.author
        )
        self.other_circle = Circle.objects.create(
            church=self.church, name="Parents", created_by=self.author
        )
        CircleMembership.objects.create(circle=self.circle, user=self.author)
        CircleMembership.objects.create(circle=self.circle, user=self.member)
        CircleMembership.objects.create(circle=self.other_circle, user=self.author)

    def create_prayer(self, user, **extra):
        self.client.force_authenticate(user)
        body = {"title": "Pray for my dad's surgery Thursday", "details": "Quiet prayers."}
        body.update(extra)
        return self.client.post(reverse("prayer-list"), body, format="json")

    def test_auth_required_on_every_route(self):
        prayer = PrayerRequest.objects.create(
            author=self.author, church=self.church, title="Hidden", whole_church=True
        )
        routes = [
            ("get", reverse("prayer-list"), None),
            ("post", reverse("prayer-list"), {}),
            ("get", reverse("prayer-active"), None),
            ("get", reverse("prayer-mine"), None),
            ("get", reverse("prayer-detail", args=[prayer.id]), None),
            ("post", reverse("prayer-pray", args=[prayer.id]), {}),
            ("post", reverse("prayer-stop", args=[prayer.id]), {}),
            ("post", reverse("prayer-pass", args=[prayer.id]), {}),
            ("get", reverse("prayer-chat", args=[prayer.id]), None),
            ("post", reverse("prayer-chat", args=[prayer.id]), {"message": "hi"}),
            ("post", reverse("prayer-report", args=[prayer.id]), {}),
            ("post", reverse("prayer-chat-report", args=[prayer.id, 1]), {}),
        ]
        for method, url, body in routes:
            self.client.force_authenticate(None)
            response = getattr(self.client, method)(url, body, format="json")
            self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED, url)

    def test_create_requires_a_circle_unless_whole_church(self):
        missing = self.create_prayer(self.author, circle_ids=[])
        self.assertEqual(missing.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("circle_ids", missing.data)

        blank = self.create_prayer(self.author, title="   ", circle_ids=[self.circle.id])
        self.assertEqual(blank.status_code, status.HTTP_400_BAD_REQUEST)

        no_church = self.create_prayer(self.unchurched, circle_ids=[self.circle.id])
        self.assertEqual(no_church.status_code, status.HTTP_400_BAD_REQUEST)

        not_a_member = self.create_prayer(self.same_church, circle_ids=[self.circle.id])
        self.assertEqual(not_a_member.status_code, status.HTTP_400_BAD_REQUEST)

        foreign = Circle.objects.create(church=self.other_church, name="Youth")
        CircleMembership.objects.create(circle=foreign, user=self.outsider)
        # Author is not in the other church's circle, and it is not their church.
        rejected = self.create_prayer(self.author, circle_ids=[foreign.id])
        self.assertEqual(rejected.status_code, status.HTTP_400_BAD_REQUEST)

        created = self.create_prayer(
            self.author,
            title=" <b>Pray for my dad's surgery Thursday</b> ",
            details="<i>He's at Grand View.</i>",
            circle_ids=[self.circle.id, self.circle.id],
            author=self.member.id,
            is_anonymous=True,
            location="Fellowship Hall",
        )
        self.assertEqual(created.status_code, status.HTTP_201_CREATED)
        self.assertEqual(created.data["kind"], "prayer")
        self.assertEqual(created.data["title"], "Pray for my dad's surgery Thursday")
        self.assertEqual(created.data["details"], "He's at Grand View.")
        self.assertFalse(created.data["whole_church"])
        self.assertEqual(created.data["circles"], [{"id": self.circle.id, "name": "Young Adults"}])
        self.assertEqual(created.data["visibility_summary"], "Young Adults")
        self.assertEqual(created.data["author"]["display_name"], "Sarah L.")
        self.assertEqual(created.data["author"]["id"], self.author.id)
        self.assertEqual(created.data["praying_count"], 0)
        self.assertFalse(created.data["is_praying"])
        self.assertIsNone(created.data["conversation_id"])
        for absent in ("is_anonymous", "anonymous", "location", "time", "latitude", "place"):
            self.assertNotIn(absent, created.data)
        self.assertFalse(PrayerRequest.objects.get(pk=created.data["id"]).whole_church)

    def test_whole_church_is_opt_in_and_church_scoped(self):
        created = self.create_prayer(self.author, whole_church=True, circle_ids=[])
        self.assertEqual(created.status_code, status.HTTP_201_CREATED)
        self.assertTrue(created.data["whole_church"])
        self.assertEqual(created.data["visibility_summary"], "Whole church")
        prayer_id = created.data["id"]

        self.client.force_authenticate(self.same_church)
        deck = results(self.client.get(reverse("prayer-list")))
        self.assertEqual([row["id"] for row in deck], [prayer_id])

        self.client.force_authenticate(self.outsider)
        self.assertEqual(results(self.client.get(reverse("prayer-list"))), [])
        self.assertEqual(
            self.client.get(reverse("prayer-detail", args=[prayer_id])).status_code,
            status.HTTP_404_NOT_FOUND,
        )
        self.client.force_authenticate(self.unchurched)
        self.assertEqual(
            self.client.get(reverse("prayer-detail", args=[prayer_id])).status_code,
            status.HTTP_404_NOT_FOUND,
        )

    def test_circle_visibility_hides_the_request_from_other_circles(self):
        created = self.create_prayer(self.author, circle_ids=[self.circle.id, self.other_circle.id])
        self.assertEqual(created.data["visibility_summary"], "Parents, Young Adults")
        prayer_id = created.data["id"]

        self.client.force_authenticate(self.member)
        self.assertEqual(
            [row["id"] for row in results(self.client.get(reverse("prayer-list")))], [prayer_id]
        )

        self.client.force_authenticate(self.same_church)
        self.assertEqual(results(self.client.get(reverse("prayer-list"))), [])
        self.assertEqual(
            self.client.get(reverse("prayer-detail", args=[prayer_id])).status_code,
            status.HTTP_404_NOT_FOUND,
        )

        # The author always sees their own, on Mine, not on the Discover deck.
        self.client.force_authenticate(self.author)
        self.assertEqual(results(self.client.get(reverse("prayer-list"))), [])
        mine = results(self.client.get(reverse("prayer-mine")))
        self.assertEqual([row["id"] for row in mine], [prayer_id])
        self.assertTrue(mine[0]["is_author"])
        detail = self.client.get(reverse("prayer-detail", args=[prayer_id]))
        self.assertEqual(detail.status_code, status.HTTP_200_OK)
        self.assertEqual(detail.data["author"]["display_name"], "Sarah L.")

    def test_blocked_author_is_hidden(self):
        created = self.create_prayer(self.author, whole_church=True)
        prayer_id = created.data["id"]
        BlockedUser.objects.create(blocker=self.same_church, blocked=self.author)
        self.client.force_authenticate(self.same_church)
        self.assertEqual(results(self.client.get(reverse("prayer-list"))), [])
        self.assertEqual(
            self.client.get(reverse("prayer-detail", args=[prayer_id])).status_code,
            status.HTTP_404_NOT_FOUND,
        )

    def test_pass_skips_without_joining(self):
        created = self.create_prayer(self.author, circle_ids=[self.circle.id])
        prayer_id = created.data["id"]
        self.client.force_authenticate(self.member)
        passed = self.client.post(reverse("prayer-pass", args=[prayer_id]))
        self.assertEqual(passed.status_code, status.HTTP_200_OK)
        self.assertEqual(passed.data, {"id": prayer_id, "passed": True})
        self.assertEqual(results(self.client.get(reverse("prayer-list"))), [])
        self.assertFalse(PrayerParticipant.objects.filter(prayer_request_id=prayer_id).exists())
        self.assertFalse(Conversation.objects.filter(prayer_request_id=prayer_id).exists())
        # Pass again is fine, and detail is still there if they open it.
        self.assertEqual(
            self.client.post(reverse("prayer-pass", args=[prayer_id])).status_code, 200
        )
        self.assertEqual(
            self.client.get(reverse("prayer-detail", args=[prayer_id])).status_code, 200
        )

        self.client.force_authenticate(self.author)
        own = self.client.post(reverse("prayer-pass", args=[prayer_id]))
        self.assertEqual(own.status_code, status.HTTP_400_BAD_REQUEST)

    @patch("users.push_notifications.send_push_to_user")
    def test_pray_stop_active_and_chat(self, push):
        created = self.create_prayer(self.author, circle_ids=[self.circle.id])
        prayer_id = created.data["id"]

        self.client.force_authenticate(self.member)
        self.assertEqual(self.client.get(reverse("prayer-chat", args=[prayer_id])).status_code, 403)
        joined = self.client.post(reverse("prayer-pray", args=[prayer_id]))
        self.assertEqual(joined.status_code, status.HTTP_201_CREATED)
        self.assertTrue(joined.data["is_praying"])
        self.assertEqual(joined.data["praying_count"], 1)
        conversation_id = joined.data["conversation_id"]
        self.assertIsNotNone(conversation_id)
        self.assertEqual(results(self.client.get(reverse("prayer-list"))), [])
        active = results(self.client.get(reverse("prayer-active")))
        self.assertEqual([row["id"] for row in active], [prayer_id])
        self.assertTrue(active[0]["is_praying"])

        again = self.client.post(reverse("prayer-pray", args=[prayer_id]))
        self.assertEqual(again.status_code, status.HTTP_200_OK)
        self.assertEqual(again.data["praying_count"], 1)
        self.assertEqual(again.data["conversation_id"], conversation_id)
        self.assertEqual(PrayerParticipant.objects.filter(prayer_request_id=prayer_id).count(), 1)

        # Passing while praying is rejected; stop is how you leave.
        self.assertEqual(
            self.client.post(reverse("prayer-pass", args=[prayer_id])).status_code, 400
        )

        chat = self.client.get(reverse("prayer-chat", args=[prayer_id]))
        self.assertEqual(chat.status_code, status.HTTP_200_OK)
        self.assertEqual(chat.data["kind"], "prayer_chat")
        self.assertEqual(chat.data["label"], "Prayer chat")
        self.assertEqual(chat.data["praying_for"], "Pray for my dad's surgery Thursday")
        self.assertEqual(chat.data["conversation_id"], conversation_id)
        self.assertEqual(chat.data["messages"], [])

        posted = self.client.post(
            reverse("prayer-chat", args=[prayer_id]),
            {"message": " <b>Praying</b> "},
            format="json",
        )
        self.assertEqual(posted.status_code, status.HTTP_201_CREATED)
        self.assertEqual(posted.data["message"], "Praying")
        self.assertEqual(set(posted.data), {"id", "userId", "user", "message", "createdAt"})
        self.assertEqual(posted.data["userId"], self.member.id)
        push.assert_not_called()

        self.client.force_authenticate(self.author)
        author_join = self.client.post(reverse("prayer-pray", args=[prayer_id]))
        self.assertEqual(author_join.status_code, status.HTTP_201_CREATED)
        self.assertEqual(author_join.data["praying_count"], 2)
        push.reset_mock()
        self.client.force_authenticate(self.member)
        self.client.post(
            reverse("prayer-chat", args=[prayer_id]), {"message": "Still here"}, format="json"
        )
        self.assertEqual(push.call_count, 1)
        recipient, title, body, payload = push.call_args.args
        self.assertEqual(recipient, self.author)
        self.assertIn("Prayer chat", title)
        self.assertNotIn("activityId", payload)
        self.assertEqual(payload["type"], "prayer_message")
        self.assertEqual(payload["prayerRequestId"], prayer_id)
        self.assertEqual(payload["screen"], "PrayerChat")
        self.assertEqual(body, "Still here")

        # The shared message endpoint and the prayer endpoint read the same room.
        self.client.force_authenticate(self.author)
        shared = self.client.get(reverse("message-list", args=[conversation_id]))
        self.assertEqual(shared.status_code, status.HTTP_200_OK)
        texts = [row["message"] for row in results(shared)]
        self.assertEqual(texts, ["Praying", "Still here"])

        self.client.force_authenticate(self.same_church)
        hidden = self.client.get(reverse("message-list", args=[conversation_id]))
        self.assertEqual(results(hidden), [])
        denied = self.client.post(
            reverse("message-list", args=[conversation_id]),
            {"message": "nope"},
            format="json",
        )
        self.assertEqual(denied.status_code, status.HTTP_400_BAD_REQUEST)

        # Direct-message routes must not treat this room as a 1:1.
        self.client.force_authenticate(self.member)
        listing = self.client.get(reverse("direct-conversations"))
        self.assertEqual(listing.status_code, status.HTTP_200_OK)
        self.assertEqual(listing.data["conversations"], [])
        mute = self.client.post(
            reverse("direct-mute", args=[conversation_id]), {"muted": True}, format="json"
        )
        self.assertEqual(mute.status_code, status.HTTP_404_NOT_FOUND)
        gathering = self.client.get(reverse("conversation-list"))
        gathering_ids = [row["id"] for row in results(gathering)]
        self.assertNotIn(conversation_id, gathering_ids)

        stopped = self.client.post(reverse("prayer-stop", args=[prayer_id]))
        self.assertEqual(stopped.status_code, status.HTTP_200_OK)
        self.assertFalse(stopped.data["is_praying"])
        self.assertEqual(stopped.data["praying_count"], 1)
        self.assertIsNone(stopped.data["conversation_id"])
        self.assertEqual(results(self.client.get(reverse("prayer-active"))), [])
        self.assertEqual(self.client.get(reverse("prayer-chat", args=[prayer_id])).status_code, 403)
        # The room stays for the people still praying.
        self.assertTrue(Conversation.objects.filter(pk=conversation_id).exists())
        self.client.force_authenticate(self.author)
        still = self.client.get(reverse("prayer-chat", args=[prayer_id]))
        self.assertEqual(still.status_code, status.HTTP_200_OK)
        self.assertEqual(len(still.data["messages"]), 2)

        # Stopping again is fine. Never having joined is not.
        self.client.force_authenticate(self.member)
        self.assertEqual(
            self.client.post(reverse("prayer-stop", args=[prayer_id])).status_code, 200
        )
        self.client.force_authenticate(self.same_church)
        self.assertEqual(
            self.client.post(reverse("prayer-stop", args=[prayer_id])).status_code, 404
        )

    def test_blocked_sender_messages_are_hidden_and_not_notified(self):
        created = self.create_prayer(self.author, whole_church=True)
        prayer_id = created.data["id"]
        self.client.force_authenticate(self.member)
        self.client.post(reverse("prayer-pray", args=[prayer_id]))
        self.client.post(
            reverse("prayer-chat", args=[prayer_id]), {"message": "from anna"}, format="json"
        )
        self.client.force_authenticate(self.same_church)
        self.client.post(reverse("prayer-pray", args=[prayer_id]))
        BlockedUser.objects.create(blocker=self.same_church, blocked=self.member)
        chat = self.client.get(reverse("prayer-chat", args=[prayer_id]))
        self.assertEqual(chat.data["messages"], [])
        self.assertEqual(chat.data["praying_count"], 2)
        with patch("users.push_notifications.send_push_to_user") as push:
            self.client.force_authenticate(self.member)
            self.client.post(
                reverse("prayer-chat", args=[prayer_id]), {"message": "again"}, format="json"
            )
            notified = [call.args[0] for call in push.call_args_list]
        # Author has not joined. The other person praying is blocked, so nobody is notified.
        self.assertEqual(notified, [])

    def test_report_request_and_message(self):
        created = self.create_prayer(self.author, circle_ids=[self.circle.id])
        prayer_id = created.data["id"]
        self.client.force_authenticate(self.member)
        self.assertEqual(
            self.client.post(
                reverse("prayer-report", args=[prayer_id]), {"reason": "spam"}
            ).status_code,
            status.HTTP_201_CREATED,
        )
        report = AbuseReport.objects.get()
        self.assertEqual(report.target_type, "prayer_request")
        self.assertEqual(report.reported_user, self.author)

        joined = self.client.post(reverse("prayer-pray", args=[prayer_id]))
        self.client.force_authenticate(self.author)
        self.client.post(reverse("prayer-pray", args=[prayer_id]))
        posted = self.client.post(
            reverse("prayer-chat", args=[prayer_id]), {"message": "please pray"}, format="json"
        )
        self.client.force_authenticate(self.member)
        reported = self.client.post(
            reverse("prayer-chat-report", args=[prayer_id, posted.data["id"]]),
            {"reason": "harassment"},
            format="json",
        )
        self.assertEqual(reported.status_code, status.HTTP_201_CREATED)
        self.assertEqual(reported.data["target_type"], "prayer_message")
        self.client.force_authenticate(self.author)
        own = self.client.post(reverse("prayer-report", args=[prayer_id]), format="json")
        self.assertEqual(own.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(joined.status_code, status.HTTP_201_CREATED)

    def test_outsider_cannot_pray_or_report(self):
        created = self.create_prayer(self.author, circle_ids=[self.circle.id])
        prayer_id = created.data["id"]
        self.client.force_authenticate(self.outsider)
        self.assertEqual(
            self.client.post(reverse("prayer-pray", args=[prayer_id])).status_code, 404
        )
        self.assertEqual(
            self.client.post(reverse("prayer-pass", args=[prayer_id])).status_code, 404
        )
        self.assertEqual(
            self.client.post(reverse("prayer-report", args=[prayer_id])).status_code, 404
        )
        self.assertEqual(self.client.get(reverse("prayer-chat", args=[prayer_id])).status_code, 404)

    def test_leaving_a_circle_keeps_an_open_prayer(self):
        created = self.create_prayer(self.author, circle_ids=[self.circle.id])
        prayer_id = created.data["id"]
        self.client.force_authenticate(self.member)
        self.client.post(reverse("prayer-pray", args=[prayer_id]))
        CircleMembership.objects.filter(circle=self.circle, user=self.member).delete()
        self.assertEqual(results(self.client.get(reverse("prayer-list"))), [])
        active = results(self.client.get(reverse("prayer-active")))
        self.assertEqual([row["id"] for row in active], [prayer_id])
        self.assertEqual(
            self.client.get(reverse("prayer-detail", args=[prayer_id])).status_code, 200
        )
        self.assertEqual(self.client.get(reverse("prayer-chat", args=[prayer_id])).status_code, 200)

    def test_conversation_is_match_or_prayer_not_both_or_neither(self):
        prayer = PrayerRequest.objects.create(
            author=self.author, church=self.church, title="One", whole_church=True
        )
        activity = Activity.objects.create(
            host=self.author,
            is_approved=True,
            title="Hike",
            description="Walk",
            location="Hall",
            latitude=40.0,
            longitude=-75.0,
            time=timezone.now() + timedelta(days=1),
            capacity=4,
        )
        match = Match.objects.create(activity=activity, user_a=self.author, user_b=self.member)
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                Conversation.objects.create()
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                Conversation.objects.create(match=match, prayer_request=prayer)
        Conversation.objects.create(match=match)
        Conversation.objects.create(prayer_request=prayer)
        self.assertEqual(Conversation.objects.count(), 2)

    def test_deleting_the_author_removes_the_chat_but_a_participant_does_not(self):
        prayer = PrayerRequest.objects.create(
            author=self.author, church=self.church, title="Keep", whole_church=True
        )
        conversation = Conversation.objects.create(prayer_request=prayer)
        PrayerParticipant.objects.create(
            prayer_request=prayer, user=self.member, status=PrayerParticipant.STATUS_PRAYING
        )
        Message.objects.create(conversation=conversation, sender=self.member, text="with you")
        member_id = self.member.id
        self.member.delete()
        self.assertTrue(Conversation.objects.filter(pk=conversation.id).exists())
        self.assertFalse(Message.objects.filter(sender_id=member_id).exists())
        self.assertTrue(PrayerRequest.objects.filter(pk=prayer.id).exists())

        author_id = self.author.id
        self.author.delete()
        self.assertFalse(PrayerRequest.objects.filter(author_id=author_id).exists())
        self.assertFalse(Conversation.objects.filter(pk=conversation.id).exists())

    def test_empty_message_is_rejected(self):
        created = self.create_prayer(self.author, whole_church=True)
        self.client.force_authenticate(self.same_church)
        self.client.post(reverse("prayer-pray", args=[created.data["id"]]))
        response = self.client.post(
            reverse("prayer-chat", args=[created.data["id"]]), {"message": "  "}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(Message.objects.exists())
        self.assertFalse(PrayerPass.objects.exists())
        too_long = self.client.post(
            reverse("prayer-chat", args=[created.data["id"]]),
            {"message": "x" * 2001},
            format="json",
        )
        self.assertEqual(too_long.status_code, status.HTTP_400_BAD_REQUEST)

    def test_stop_and_chat_when_blocked_or_missing(self):
        created = self.create_prayer(self.author, whole_church=True)
        prayer_id = created.data["id"]
        self.client.force_authenticate(self.author)
        self.assertEqual(
            self.client.post(reverse("prayer-stop", args=[prayer_id])).status_code, 400
        )
        self.assertEqual(self.client.post(reverse("prayer-stop", args=[999999])).status_code, 404)

        self.client.force_authenticate(self.member)
        self.client.post(reverse("prayer-pray", args=[prayer_id]))
        posted = self.client.post(
            reverse("prayer-chat", args=[prayer_id]), {"message": "hello"}, format="json"
        )
        BlockedUser.objects.create(blocker=self.author, blocked=self.member)
        self.assertEqual(self.client.get(reverse("prayer-chat", args=[prayer_id])).status_code, 403)
        stopped = self.client.post(reverse("prayer-stop", args=[prayer_id]))
        self.assertEqual(stopped.status_code, status.HTTP_200_OK)
        self.assertEqual(stopped.data, {"id": prayer_id, "is_praying": False})

        self.client.force_authenticate(self.same_church)
        self.client.post(reverse("prayer-pray", args=[prayer_id]))
        BlockedUser.objects.create(blocker=self.same_church, blocked=self.member)
        hidden = self.client.post(
            reverse("prayer-chat-report", args=[prayer_id, posted.data["id"]]),
            format="json",
        )
        self.assertEqual(hidden.status_code, status.HTTP_404_NOT_FOUND)
