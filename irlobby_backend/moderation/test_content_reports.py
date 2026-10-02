"""Reports on content: chat messages, photos, gatherings, requests, 1:1 messages."""

from unittest.mock import patch

from django.core import mail
from django.test import override_settings
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from activities.models import Activity, ActivityParticipant, EventPhoto
from activities.test_foyer import _activity, _jpeg_upload, _safe_birthdate
from chat.models import Conversation, Message
from matches.models import Match
from moderation.models import AbuseReport, BlockedUser
from users.models import Friendship, User


def _user(name, **extra):
    extra.setdefault("date_of_birth", _safe_birthdate(40))
    return User.objects.create_user(
        username=name,
        email=f"{name}@example.com",
        password="Passw0rd-123",
        first_name=name.capitalize(),
        **extra,
    )


class ReportBase(APITestCase):
    def setUp(self):
        self.host = _user("host")
        self.guest = _user("guest")
        self.talker = _user("talker")
        self.outsider = _user("outsider")
        self.staff = _user("staffer", is_staff=True)
        self.activity = _activity(self.host, title="Game Night", requires_approval=True)
        for user in (self.guest, self.talker):
            ActivityParticipant.objects.create(
                activity=self.activity, user=user, status="confirmed"
            )
        match = Match.get_or_create_normalized(self.activity, self.guest, self.talker)[0]
        self.conversation = Conversation.objects.create(match=match)
        self.message = Message.objects.create(
            conversation=self.conversation, sender=self.talker, text="rude   words\nhere"
        )

    def post(self, user, name, args, body=None):
        self.client.force_authenticate(user)
        return self.client.post(reverse(name, args=args), body or {}, format="json")

    def upload_photo(self):
        self.client.force_authenticate(self.host)
        response = self.client.post(
            reverse("activity-photo-upload", args=[self.activity.id]),
            {"image": _jpeg_upload()},
            format="multipart",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        return EventPhoto.objects.get(pk=response.data["id"])


class ChatMessageReportTests(ReportBase):
    def report(self, user, body=None, message=None):
        return self.post(
            user,
            "activity-chat-report",
            [self.activity.id, (message or self.message).id],
            body,
        )

    def test_participant_reports_a_message(self):
        response = self.report(self.guest, {"reason": "harassment", "description": "<b>mean</b>"})
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(
            response.data,
            {
                "id": response.data["id"],
                "status": "pending",
                "target_type": "chat_message",
                "target_id": self.message.id,
            },
        )
        report = AbuseReport.objects.get(pk=response.data["id"])
        self.assertEqual(report.reporter, self.guest)
        self.assertEqual(report.reported_user, self.talker)
        self.assertEqual(report.reason, "harassment")
        self.assertEqual(report.description, "mean")
        self.assertEqual(report.target_snapshot, "rude words here")

    def test_reason_defaults_to_other_and_unknown_is_rejected(self):
        self.assertEqual(self.report(self.guest).status_code, 201)
        self.assertEqual(AbuseReport.objects.get().reason, "other")
        bad = self.report(self.host, {"reason": "nope"})
        self.assertEqual(bad.status_code, status.HTTP_400_BAD_REQUEST)

    def test_description_is_capped_at_500(self):
        too_long = self.report(self.guest, {"description": "x" * 501})
        self.assertEqual(too_long.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(self.report(self.guest, {"description": "x" * 500}).status_code, 201)

    def test_snapshot_is_capped_at_200(self):
        long = Message.objects.create(
            conversation=self.conversation, sender=self.talker, text="y" * 500
        )
        self.report(self.guest, message=long)
        self.assertEqual(len(AbuseReport.objects.get().target_snapshot), 200)

    def test_duplicate_returns_the_existing_report_with_200(self):
        first = self.report(self.guest)
        again = self.report(self.guest, {"reason": "spam"})
        self.assertEqual(again.status_code, status.HTTP_200_OK)
        self.assertEqual(again.data["id"], first.data["id"])
        self.assertEqual(AbuseReport.objects.count(), 1)
        # A different reporter files their own.
        self.assertEqual(self.report(self.host).status_code, 201)
        self.assertEqual(AbuseReport.objects.count(), 2)

    def test_cannot_report_your_own_message(self):
        self.assertEqual(self.report(self.talker).status_code, status.HTTP_400_BAD_REQUEST)

    def test_reporter_must_be_in_the_chat(self):
        self.assertEqual(self.report(self.outsider).status_code, status.HTTP_403_FORBIDDEN)
        ActivityParticipant.objects.create(
            activity=self.activity, user=self.outsider, status="pending"
        )
        self.assertEqual(self.report(self.outsider).status_code, status.HTTP_403_FORBIDDEN)
        self.assertFalse(AbuseReport.objects.exists())

    def test_host_and_staff_can_report(self):
        self.assertEqual(self.report(self.host).status_code, 201)
        self.assertEqual(self.report(self.staff).status_code, 201)

    def test_message_from_another_gathering_or_unknown_is_404(self):
        other = _activity(self.host, title="Other")
        response = self.post(self.host, "activity-chat-report", [other.id, self.message.id])
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        response = self.post(self.host, "activity-chat-report", [self.activity.id, 999999])
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_blocked_sender_is_not_found(self):
        BlockedUser.objects.create(blocker=self.guest, blocked=self.talker)
        self.assertEqual(self.report(self.guest).status_code, status.HTTP_404_NOT_FOUND)

    def test_hidden_gathering_is_404_and_login_required(self):
        Activity.objects.filter(pk=self.activity.pk).update(is_approved=False)
        self.assertEqual(self.report(self.guest).status_code, status.HTTP_404_NOT_FOUND)
        self.client.force_authenticate(None)
        url = reverse("activity-chat-report", args=[self.activity.id, self.message.id])
        self.assertEqual(self.client.post(url).status_code, status.HTTP_401_UNAUTHORIZED)


class PhotoReportTests(ReportBase):
    def test_visible_user_reports_a_photo_and_host_is_the_reported_user(self):
        photo = self.upload_photo()
        self.assertEqual(photo.uploaded_by, self.host)
        response = self.post(self.outsider, "activity-photo-report", [self.activity.id, photo.id])
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["target_type"], "event_photo")
        self.assertEqual(response.data["target_id"], photo.id)
        report = AbuseReport.objects.get()
        self.assertEqual(report.reported_user, self.host)
        self.assertIn("event_photos/", report.target_snapshot)

    def test_unknown_uploader_falls_back_to_the_host(self):
        photo = self.upload_photo()
        EventPhoto.objects.filter(pk=photo.pk).update(uploaded_by=None)
        self.post(self.guest, "activity-photo-report", [self.activity.id, photo.id])
        self.assertEqual(AbuseReport.objects.get().reported_user, self.host)

    def test_duplicate_self_report_and_hidden(self):
        photo = self.upload_photo()
        args = [self.activity.id, photo.id]
        first = self.post(self.guest, "activity-photo-report", args)
        again = self.post(self.guest, "activity-photo-report", args)
        self.assertEqual((first.status_code, again.status_code), (201, 200))
        self.assertEqual(again.data["id"], first.data["id"])
        self.assertEqual(
            self.post(self.host, "activity-photo-report", args).status_code,
            status.HTTP_400_BAD_REQUEST,
        )
        Activity.objects.filter(pk=self.activity.pk).update(is_approved=False)
        self.assertEqual(
            self.post(self.outsider, "activity-photo-report", args).status_code,
            status.HTTP_404_NOT_FOUND,
        )

    def test_photo_of_another_gathering_is_404(self):
        photo = self.upload_photo()
        other = _activity(self.host, title="Other")
        response = self.post(self.guest, "activity-photo-report", [other.id, photo.id])
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)


class ActivityReportTests(ReportBase):
    def test_report_a_gathering(self):
        response = self.post(
            self.outsider, "activity-report", [self.activity.id], {"reason": "spam"}
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["target_type"], "activity")
        self.assertEqual(response.data["target_id"], self.activity.id)
        report = AbuseReport.objects.get()
        self.assertEqual(report.reported_user, self.host)
        self.assertTrue(report.target_snapshot.startswith("Game Night"))

    def test_host_cannot_report_own_gathering_duplicate_and_hidden(self):
        self.assertEqual(
            self.post(self.host, "activity-report", [self.activity.id]).status_code, 400
        )
        first = self.post(self.guest, "activity-report", [self.activity.id])
        again = self.post(self.guest, "activity-report", [self.activity.id])
        self.assertEqual((first.status_code, again.status_code), (201, 200))
        BlockedUser.objects.create(blocker=self.host, blocked=self.outsider)
        self.assertEqual(
            self.post(self.outsider, "activity-report", [self.activity.id]).status_code, 404
        )
        Activity.objects.filter(pk=self.activity.pk).update(is_approved=False)
        self.assertEqual(
            self.post(self.staff, "activity-report", [self.activity.id]).status_code, 201
        )
        self.assertEqual(
            self.post(self.talker, "activity-report", [self.activity.id]).status_code, 404
        )


class JoinRequestReportTests(ReportBase):
    def setUp(self):
        super().setUp()
        self.requester = _user("requester", bio="Hello there")
        self.row = ActivityParticipant.objects.create(
            activity=self.activity, user=self.requester, status="pending"
        )

    def report(self, user, body=None, row=None):
        return self.post(
            user, "activity-request-report", [self.activity.id, (row or self.row).id], body
        )

    def test_host_reports_a_requester(self):
        response = self.report(self.host, {"reason": "fake_profile"})
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["target_type"], "join_request")
        self.assertEqual(response.data["target_id"], self.row.id)
        report = AbuseReport.objects.get()
        self.assertEqual(report.reported_user, self.requester)
        self.assertEqual(report.reporter, self.host)
        self.assertEqual(report.target_snapshot, "Requester: Hello there")
        self.assertNotIn("example.com", report.target_snapshot)

    def test_only_the_host_or_staff_may_report_a_request(self):
        for user in (self.guest, self.outsider, self.requester):
            self.assertEqual(self.report(user).status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(self.report(self.staff).status_code, status.HTTP_201_CREATED)

    def test_duplicate_blocked_and_wrong_gathering(self):
        first = self.report(self.host)
        again = self.report(self.host)
        self.assertEqual((first.status_code, again.status_code), (201, 200))
        other = _activity(self.host, title="Other")
        wrong = self.post(self.host, "activity-request-report", [other.id, self.row.id])
        self.assertEqual(wrong.status_code, status.HTTP_404_NOT_FOUND)
        BlockedUser.objects.create(blocker=self.requester, blocked=self.host)
        other_row = ActivityParticipant.objects.create(
            activity=self.activity, user=self.outsider, status="pending"
        )
        self.assertEqual(self.report(self.host, row=other_row).status_code, 201)
        AbuseReport.objects.all().delete()
        self.assertEqual(self.report(self.host).status_code, status.HTTP_404_NOT_FOUND)

    def test_anonymous_gets_401(self):
        self.client.force_authenticate(None)
        url = reverse("activity-request-report", args=[self.activity.id, self.row.id])
        self.assertEqual(self.client.post(url).status_code, status.HTTP_401_UNAUTHORIZED)


class ExistingReportEndpointTests(ReportBase):
    def test_user_report_now_records_target_and_returns_it(self):
        self.client.force_authenticate(self.guest)
        response = self.client.post(
            reverse("user-report", args=[self.talker.id]), {"reason": "spam"}, format="json"
        )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["target_type"], "user")
        self.assertEqual(response.data["target_id"], self.talker.id)
        report = AbuseReport.objects.get()
        self.assertEqual((report.target_type, report.target_id), ("user", self.talker.id))

    def test_generic_moderation_report_records_target(self):
        self.client.force_authenticate(self.guest)
        response = self.client.post(
            reverse("abuse-report"),
            {"reported_user": self.talker.id, "reason": "spam"},
            format="json",
        )
        self.assertEqual(response.status_code, 201)
        report = AbuseReport.objects.get()
        self.assertEqual((report.target_type, report.target_id), ("user", self.talker.id))

    def test_direct_report_with_message_is_a_direct_message_report(self):
        Friendship.objects.create(requester=self.guest, recipient=self.talker, status="accepted")
        self.client.force_authenticate(self.guest)
        convo = self.client.post(
            reverse("direct-conversations"), {"user_id": self.talker.id}, format="json"
        ).data["id"]
        self.client.force_authenticate(self.talker)
        msg = self.client.post(
            reverse("message-list", args=[convo]), {"message": "ugly words"}, format="json"
        ).data["id"]
        self.client.force_authenticate(self.guest)
        with_message = self.client.post(
            reverse("direct-report", args=[convo]),
            {"reason": "harassment", "message_id": msg},
            format="json",
        )
        self.assertEqual(with_message.status_code, 201)
        self.assertEqual(with_message.data["target_type"], "direct_message")
        self.assertEqual(with_message.data["target_id"], msg)
        report = AbuseReport.objects.get(pk=with_message.data["id"])
        self.assertEqual(report.target_snapshot, "ugly words")
        without = self.client.post(reverse("direct-report", args=[convo]), {}, format="json")
        self.assertEqual(without.data["target_type"], "user")
        self.assertEqual(without.data["target_id"], self.talker.id)


@override_settings(FOYER_SUPPORT_EMAIL="support@example.org")
class SupportEmailTests(ReportBase):
    def test_new_report_emails_support_once(self):
        self.post(self.guest, "activity-chat-report", [self.activity.id, self.message.id])
        self.assertEqual(len(mail.outbox), 1)
        message = mail.outbox[0]
        self.assertEqual(message.to, ["support@example.org"])
        self.assertIn("chat_message", message.subject)
        self.assertIn("rude words here", message.body)
        # A duplicate is not a new report.
        self.post(self.guest, "activity-chat-report", [self.activity.id, self.message.id])
        self.assertEqual(len(mail.outbox), 1)

    def test_all_report_types_email(self):
        self.post(self.guest, "activity-report", [self.activity.id])
        self.client.force_authenticate(self.guest)
        self.client.post(reverse("user-report", args=[self.talker.id]), {}, format="json")
        self.assertEqual(len(mail.outbox), 2)

    def test_email_failure_never_fails_the_report(self):
        with patch("moderation.reporting.send_mail", side_effect=RuntimeError("smtp down")):
            response = self.post(self.guest, "activity-report", [self.activity.id])
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(AbuseReport.objects.count(), 1)

    @override_settings(FOYER_SUPPORT_EMAIL="")
    def test_no_support_address_means_no_email(self):
        response = self.post(self.guest, "activity-report", [self.activity.id])
        self.assertEqual(response.status_code, 201)
        self.assertEqual(len(mail.outbox), 0)


class ModelTests(ReportBase):
    def test_new_fields_default_for_old_style_reports(self):
        report = AbuseReport.objects.create(
            reporter=self.guest, reported_user=self.talker, reason="spam"
        )
        self.assertEqual(
            (report.target_type, report.target_id, report.target_snapshot), ("user", None, "")
        )

    def test_reported_user_may_be_null(self):
        report = AbuseReport.objects.create(reporter=self.guest, reason="spam")
        self.assertIsNone(report.reported_user)
        self.assertIn("spam", str(report))
