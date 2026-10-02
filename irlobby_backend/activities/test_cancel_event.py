"""Host cancel-event: permissions, fan-out, exclusions, and what still works afterwards."""

from datetime import timedelta
from unittest.mock import patch
from urllib.parse import urlparse

from django.test import override_settings
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from activities.models import (
    Activity,
    ActivityParticipant,
    Church,
    HouseholdDependent,
)
from activities.tasks import notify_upcoming_activities
from activities.test_foyer import _activity, _jpeg_upload, _safe_birthdate
from chat.models import Conversation, Message
from matches.models import Match
from swipes.models import Swipe
from users.models import User

PUSH = "users.push_notifications.send_push_to_user"
CHURCH_ADMIN_EMAIL = "admin@example.com"


def _user(name, **extra):
    return User.objects.create_user(
        username=name,
        email=f"{name}@example.com",
        password="Passw0rd-123",
        first_name=name.capitalize(),
        date_of_birth=_safe_birthdate(40),
        **extra,
    )


def _results(response):
    data = response.data
    return data["results"] if isinstance(data, dict) and "results" in data else data


class CancelEventBase(APITestCase):
    def setUp(self):
        self.host = _user("host")
        self.other = _user("other")
        self.staff = _user("staffer", is_staff=True)
        self.attendee = _user("attendee")
        self.family = _user("family")
        self.pending = _user("pending")
        self.outsider = _user("outsider")
        self.activity = _activity(self.host, title="Game Night")
        self.url = reverse("activity-cancel-event", args=[self.activity.id])

        ActivityParticipant.objects.create(
            activity=self.activity, user=self.attendee, status="confirmed"
        )
        # Going only for a household member (include_self is off).
        rsvp = ActivityParticipant.objects.create(
            activity=self.activity, user=self.family, status="confirmed", include_self=False
        )
        spouse = HouseholdDependent.objects.create(
            parent=self.family, name="Spouse", relationship="spouse"
        )
        rsvp.dependents.add(spouse)
        ActivityParticipant.objects.create(
            activity=self.activity, user=self.pending, status="pending"
        )

    def cancel(self, user, body=None, activity=None):
        self.client.force_authenticate(user)
        url = reverse("activity-cancel-event", args=[(activity or self.activity).id])
        return self.client.post(url, body or {}, format="json")

    def cancel_and_commit(self, user, body=None, activity=None):
        with self.captureOnCommitCallbacks(execute=True):
            return self.cancel(user, body, activity)


class CancelEventPermissionTests(CancelEventBase):
    def test_host_can_cancel_and_gets_the_serialized_activity(self):
        response = self.cancel_and_commit(self.host, {"reason": "  Snow storm  "})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["id"], self.activity.id)
        self.assertTrue(response.data["is_cancelled"])
        self.assertEqual(response.data["status"], "cancelled")
        self.assertEqual(response.data["cancel_reason"], "Snow storm")
        self.assertIsNotNone(response.data["cancelled_at"])
        self.activity.refresh_from_db()
        self.assertTrue(self.activity.is_cancelled)
        self.assertEqual(self.activity.cancel_reason, "Snow storm")

    def test_reason_is_optional(self):
        response = self.cancel_and_commit(self.host)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["cancel_reason"], "")

    def test_reason_over_280_characters_is_rejected(self):
        response = self.cancel(self.host, {"reason": "x" * 281})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("reason", response.data)
        self.assertEqual(
            self.cancel(self.host, {"reason": "x" * 280}).status_code, status.HTTP_200_OK
        )

    def test_reason_must_be_text(self):
        response = self.cancel(self.host, {"reason": ["a"]})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.activity.refresh_from_db()
        self.assertFalse(self.activity.is_cancelled)

    def test_other_user_is_forbidden(self):
        response = self.cancel(self.other)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        # Even a going attendee is not the host.
        self.assertEqual(self.cancel(self.attendee).status_code, status.HTTP_403_FORBIDDEN)
        self.activity.refresh_from_db()
        self.assertFalse(self.activity.is_cancelled)

    def test_anonymous_gets_401(self):
        self.client.force_authenticate(None)
        response = self.client.post(self.url, {}, format="json")
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_staff_can_cancel(self):
        response = self.cancel_and_commit(self.staff, {"reason": "Venue closed"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data["is_cancelled"])

    @override_settings(FOYER_CHURCH_ADMIN_EMAILS=[CHURCH_ADMIN_EMAIL])
    def test_church_admin_can_cancel_church_event_but_not_a_member_event(self):
        admin = _user("admin")
        church = Church.objects.create(name="Some Church")
        church_event = _activity(self.host, title="Potluck", host_kind="church", host_church=church)
        self.assertEqual(self.cancel(admin, activity=church_event).status_code, status.HTTP_200_OK)
        # The admin is not the host of a member event.
        self.assertEqual(self.cancel(admin).status_code, status.HTTP_403_FORBIDDEN)

    def test_missing_activity_is_404(self):
        self.client.force_authenticate(self.host)
        response = self.client.post(
            reverse("activity-cancel-event", args=[999999]), {}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_unapproved_activity_is_404_for_non_host(self):
        hidden = _activity(self.host, title="Draft", is_approved=False)
        self.assertEqual(
            self.cancel(self.other, activity=hidden).status_code, status.HTTP_404_NOT_FOUND
        )
        self.assertEqual(self.cancel(self.host, activity=hidden).status_code, status.HTTP_200_OK)

    def test_started_event_cannot_be_cancelled(self):
        started = _activity(self.host, time=timezone.now() - timedelta(hours=1))
        response = self.cancel(self.host, activity=started)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("already started", response.data["detail"])
        started.refresh_from_db()
        self.assertFalse(started.is_cancelled)

    def test_ended_event_cannot_be_cancelled(self):
        ended = _activity(
            self.host,
            time=timezone.now() - timedelta(days=2),
            end_time=timezone.now() - timedelta(days=2) + timedelta(hours=2),
        )
        self.assertEqual(
            self.cancel(self.host, activity=ended).status_code, status.HTTP_400_BAD_REQUEST
        )


class CancelEventSideEffectTests(CancelEventBase):
    def test_idempotent_second_call_returns_state_and_does_not_renotify(self):
        with patch(PUSH) as push:
            first = self.cancel_and_commit(self.host, {"reason": "Rain"})
            self.assertEqual(push.call_count, 2)
            second = self.cancel_and_commit(self.host, {"reason": "A different reason"})
        self.assertEqual(second.status_code, status.HTTP_200_OK)
        self.assertEqual(push.call_count, 2)
        self.assertEqual(second.data["cancel_reason"], "Rain")
        self.assertEqual(second.data["cancelled_at"], first.data["cancelled_at"])

    def test_second_call_after_event_started_still_returns_200(self):
        self.cancel_and_commit(self.host)
        Activity.objects.filter(pk=self.activity.pk).update(
            time=timezone.now() - timedelta(hours=1)
        )
        self.assertEqual(self.cancel(self.host).status_code, status.HTTP_200_OK)

    def test_confirmed_attendees_are_notified_but_not_host_pending_or_outsiders(self):
        with patch(PUSH) as push:
            self.cancel_and_commit(self.host, {"reason": "Rain"})
        recipients = {call.args[0].id for call in push.call_args_list}
        self.assertEqual(recipients, {self.attendee.id, self.family.id})
        self.assertEqual(push.call_count, 2)
        title, body, data = push.call_args_list[0].args[1:]
        self.assertEqual(title, "Game Night was cancelled")
        self.assertIn("Game Night was cancelled.", body)
        self.assertIn("Reason: Rain", body)
        self.assertEqual(data["type"], "activity_cancelled")
        self.assertEqual(data["activityId"], self.activity.id)

    def test_message_without_reason_has_no_reason_text(self):
        with patch(PUSH) as push:
            self.cancel_and_commit(self.host)
        self.assertNotIn("Reason", push.call_args_list[0].args[2])

    def test_cancelling_staff_or_admin_who_is_attending_is_not_notified(self):
        ActivityParticipant.objects.create(
            activity=self.activity, user=self.staff, status="confirmed"
        )
        with patch(PUSH) as push:
            self.cancel_and_commit(self.staff)
        recipients = {call.args[0].id for call in push.call_args_list}
        self.assertEqual(recipients, {self.attendee.id, self.family.id})

    def test_nothing_is_sent_until_the_transaction_commits(self):
        with patch(PUSH) as push:
            self.cancel(self.host)
            self.assertEqual(push.call_count, 0)

    def test_rsvps_are_kept(self):
        before = ActivityParticipant.objects.filter(activity=self.activity).count()
        self.cancel_and_commit(self.host)
        self.assertEqual(ActivityParticipant.objects.filter(activity=self.activity).count(), before)
        self.assertEqual(before, 3)

    def test_push_delivery_uses_expo_helper_for_each_device(self):
        # Exercise the real helper end-to-end with the HTTP call mocked.
        from users.models import PushDeviceToken

        PushDeviceToken.objects.create(user=self.attendee, token="ExponentPushToken[abc]")
        with patch("users.push_notifications.requests.post") as post:
            post.return_value.ok = True
            post.return_value.json.return_value = {"data": [{"status": "ok"}]}
            self.cancel_and_commit(self.host, {"reason": "Rain"})
        self.assertEqual(post.call_count, 1)
        sent = post.call_args.kwargs["json"][0]
        self.assertEqual(sent["to"], "ExponentPushToken[abc]")
        self.assertEqual(sent["title"], "Game Night was cancelled")

    def test_upcoming_reminders_skip_cancelled_events(self):
        Activity.objects.filter(pk=self.activity.pk).update(
            time=timezone.now() + timedelta(minutes=30)
        )
        self.assertEqual(notify_upcoming_activities()["activities"], 1)
        Activity.objects.filter(pk=self.activity.pk).update(is_cancelled=True)
        self.assertEqual(notify_upcoming_activities()["activities"], 0)


class CancelEventChatTests(CancelEventBase):
    def setUp(self):
        super().setUp()
        match, _ = Match.get_or_create_normalized(
            activity=self.activity, user_one=self.attendee, user_two=self.family
        )
        self.conversation = Conversation.objects.create(match=match)
        Message.objects.create(conversation=self.conversation, sender=self.attendee, text="Hi!")

    def test_system_message_is_posted_in_the_existing_gathering_chat(self):
        self.cancel_and_commit(self.host, {"reason": "Rain"})
        last = self.conversation.messages.order_by("created_at", "id").last()
        self.assertEqual(last.sender_id, self.host.id)
        self.assertIn("Game Night was cancelled", last.text)
        self.assertIn("Reason: Rain", last.text)
        self.assertEqual(self.conversation.messages.count(), 2)

    def test_no_duplicate_system_message_on_second_call(self):
        self.cancel_and_commit(self.host)
        self.cancel_and_commit(self.host)
        self.assertEqual(self.conversation.messages.count(), 2)

    def test_no_chat_means_no_message_and_no_error(self):
        other_event = _activity(self.host, title="Other")
        response = self.cancel_and_commit(self.host, activity=other_event)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(Conversation.objects.count(), 1)

    def test_chat_stays_open_for_reads_and_sends_after_cancel(self):
        self.cancel_and_commit(self.host)
        self.client.force_authenticate(self.attendee)

        read = self.client.get(reverse("activity-chat", args=[self.activity.id]))
        self.assertEqual(read.status_code, status.HTTP_200_OK)
        self.assertEqual(len(read.data), 2)

        send = self.client.post(
            reverse("activity-chat", args=[self.activity.id]), {"message": "still on?"}
        )
        self.assertEqual(send.status_code, status.HTTP_201_CREATED)

        url = reverse("message-list", args=[self.conversation.id])
        sent = self.client.post(url, {"message": "any new date?"}, format="json")
        self.assertEqual(sent.status_code, status.HTTP_201_CREATED)
        listed = self.client.get(url)
        self.assertEqual(listed.status_code, status.HTTP_200_OK)
        self.assertEqual(len(_results(listed)), 4)

    def test_host_can_announce_a_new_date_after_cancel(self):
        self.cancel_and_commit(self.host)
        self.client.force_authenticate(self.host)
        url = reverse("activity-chat", args=[self.activity.id])
        response = self.client.post(url, {"message": "New date: Oct 20!"})
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["message"], "New date: Oct 20!")

    def test_sending_works_before_cancel(self):
        self.client.force_authenticate(self.attendee)
        url = reverse("message-list", args=[self.conversation.id])
        self.assertEqual(
            self.client.post(url, {"message": "hello"}, format="json").status_code,
            status.HTTP_201_CREATED,
        )


class CancelledEventVisibilityTests(CancelEventBase):
    def setUp(self):
        super().setUp()
        Activity.objects.filter(pk=self.activity.pk).update(
            list_on_church_calendar=True, calendar_approved=True
        )

    def titles_in_deck(self, user):
        self.client.force_authenticate(user)
        return [item["title"] for item in _results(self.client.get(reverse("activity-list")))]

    def test_cancelled_event_leaves_the_deck_for_everyone_including_staff(self):
        for user in (self.outsider, self.host, self.staff):
            self.assertIn("Game Night", self.titles_in_deck(user))
        self.cancel_and_commit(self.host)
        for user in (self.outsider, self.attendee, self.host, self.staff):
            self.assertNotIn("Game Night", self.titles_in_deck(user))

    def test_cancelled_event_leaves_the_public_calendar_json_and_ics(self):
        self.client.force_authenticate(None)
        feed = reverse("public-calendar")
        ics = reverse("public-calendar-ics")
        single = reverse("public-event-ics", args=[self.activity.id])
        self.assertEqual(len(self.client.get(feed).data["events"]), 1)
        self.assertIn("Game Night", self.client.get(ics).content.decode())
        self.assertEqual(self.client.get(single).status_code, status.HTTP_200_OK)

        self.cancel_and_commit(self.host)
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get(feed).data["events"], [])
        self.assertNotIn("Game Night", self.client.get(ics).content.decode())
        self.assertEqual(self.client.get(single).status_code, status.HTTP_404_NOT_FOUND)

    def test_private_event_ics_marks_cancelled(self):
        from activities.public_calendar import event_ics

        self.assertNotIn("STATUS:CANCELLED", event_ics(self.activity))
        self.cancel_and_commit(self.host)
        self.activity.refresh_from_db()
        self.assertIn("STATUS:CANCELLED", event_ics(self.activity))

    def test_detail_shows_cancelled_state_to_attendee_host_and_stranger(self):
        self.cancel_and_commit(self.host, {"reason": "Rain"})
        for user in (self.attendee, self.family, self.host, self.outsider):
            self.client.force_authenticate(user)
            response = self.client.get(reverse("activity-detail", args=[self.activity.id]))
            self.assertEqual(response.status_code, status.HTTP_200_OK)
            self.assertTrue(response.data["is_cancelled"])
            self.assertEqual(response.data["status"], "cancelled")
            self.assertEqual(response.data["cancel_reason"], "Rain")
            self.assertIsNotNone(response.data["cancelled_at"])

    def test_active_event_reports_active_status(self):
        self.client.force_authenticate(self.attendee)
        data = self.client.get(reverse("activity-detail", args=[self.activity.id])).data
        self.assertFalse(data["is_cancelled"])
        self.assertIsNone(data["cancelled_at"])
        self.assertEqual(data["cancel_reason"], "")
        self.assertEqual(data["status"], "active")

    def test_clients_cannot_set_cancel_fields_through_patch(self):
        self.client.force_authenticate(self.host)
        response = self.client.patch(
            reverse("activity-detail", args=[self.activity.id]),
            {"is_cancelled": True, "cancel_reason": "sneaky"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.activity.refresh_from_db()
        self.assertFalse(self.activity.is_cancelled)
        self.assertEqual(self.activity.cancel_reason, "")

    def test_going_and_hosted_lists_keep_the_cancelled_event_flagged(self):
        self.cancel_and_commit(self.host)
        self.client.force_authenticate(self.attendee)
        going = _results(self.client.get(reverse("going-activities")))
        self.assertEqual([(a["id"], a["is_cancelled"]) for a in going], [(self.activity.id, True)])
        self.assertEqual(going[0]["status"], "cancelled")
        self.client.force_authenticate(self.host)
        hosted = _results(self.client.get(reverse("hosted-activities")))
        self.assertEqual([(a["id"], a["is_cancelled"]) for a in hosted], [(self.activity.id, True)])

    def test_photos_still_work_after_cancel(self):
        self.cancel_and_commit(self.host)
        self.client.force_authenticate(self.host)
        upload = self.client.post(
            reverse("activity-photo-upload", args=[self.activity.id]),
            {"image": _jpeg_upload()},
            format="multipart",
        )
        self.assertEqual(upload.status_code, status.HTTP_201_CREATED)
        fetched = self.client.get(urlparse(upload.data["url"]).path)
        self.assertEqual(fetched.status_code, status.HTTP_200_OK)
        self.client.force_authenticate(self.attendee)
        detail = self.client.get(reverse("activity-detail", args=[self.activity.id]))
        self.assertEqual(len(detail.data["photos"]), 1)


class CancelledEventBlocksNewActivityTests(CancelEventBase):
    def setUp(self):
        super().setUp()
        self.cancel_and_commit(self.host)

    def test_new_rsvp_is_rejected(self):
        self.client.force_authenticate(self.outsider)
        response = self.client.post(
            reverse("activity-rsvp", args=[self.activity.id]), {"include_self": True}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("cancelled", response.data["detail"])
        self.assertFalse(
            ActivityParticipant.objects.filter(activity=self.activity, user=self.outsider).exists()
        )

    def test_existing_attendee_cannot_re_rsvp(self):
        self.client.force_authenticate(self.attendee)
        response = self.client.post(
            reverse("activity-rsvp", args=[self.activity.id]), {"include_self": True}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_legacy_join_is_rejected(self):
        self.client.force_authenticate(self.outsider)
        response = self.client.post(reverse("join-activity", args=[self.activity.id]))
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_swipe_is_rejected(self):
        self.client.force_authenticate(self.outsider)
        for direction in ("right", "left"):
            response = self.client.post(
                reverse("swipe-activity", args=[self.activity.id]),
                {"direction": direction},
                format="json",
            )
            self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        listed = self.client.post(
            reverse("swipe-list"),
            {"activity": self.activity.id, "direction": "right"},
            format="json",
        )
        self.assertEqual(listed.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(Swipe.objects.filter(activity=self.activity).exists())


class HostRsvpCancelMessageTests(CancelEventBase):
    def test_host_rsvp_cancel_points_to_cancel_event(self):
        self.client.force_authenticate(self.host)
        response = self.client.delete(reverse("activity-rsvp-cancel", args=[self.activity.id]))
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(
            response.data["detail"],
            "Hosts can't cancel an RSVP; use Cancel this gathering instead.",
        )
