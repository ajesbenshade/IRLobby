"""DELETE /api/users/profile/delete/: what is removed, what stays, and the Apple revoke."""

import os
import shutil
import tempfile
from datetime import timedelta
from unittest.mock import MagicMock, patch

import jwt
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import ec
from django.test import override_settings
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from activities.models import (
    Activity,
    ActivityParticipant,
    EventPhoto,
    HouseholdDependent,
)
from activities.test_foyer import _activity, _jpeg_upload, _safe_birthdate
from chat.models import Conversation, Message
from matches.models import Match
from moderation.models import AbuseReport, BlockedUser
from swipes.models import Swipe
from users.models import Friendship, Invite, PushDeviceToken, SocialAuthIdentity, User

PUSH = "users.push_notifications.send_push_to_user"
DELETE_URL = "delete-profile"
APPLE_POST = "users.apple_signin.requests.post"

_KEY = ec.generate_private_key(ec.SECP256R1())
APPLE_PRIVATE_PEM = _KEY.private_bytes(
    serialization.Encoding.PEM,
    serialization.PrivateFormat.PKCS8,
    serialization.NoEncryption(),
).decode()
APPLE_PUBLIC_PEM = (
    _KEY.public_key()
    .public_bytes(serialization.Encoding.PEM, serialization.PublicFormat.SubjectPublicKeyInfo)
    .decode()
)
APPLE_SETTINGS = {
    "APPLE_OAUTH_AUDIENCES": ["com.irlobby.app"],
    "APPLE_TEAM_ID": "TEAM123456",
    "APPLE_SIGNIN_KEY_ID": "KEY1234567",
    "APPLE_SIGNIN_PRIVATE_KEY": APPLE_PRIVATE_PEM,
}


def _user(name, **extra):
    extra.setdefault("date_of_birth", _safe_birthdate(40))
    return User.objects.create_user(
        username=name,
        email=f"{name}@example.com",
        password="Passw0rd-123",
        first_name=name.capitalize(),
        **extra,
    )


class DeletionBase(APITestCase):
    def setUp(self):
        self.user = _user("leaver")
        self.friend = _user("pal")
        self.other = _user("bystander")

    def delete_account(self, user=None):
        self.client.force_authenticate(user or self.user)
        with self.captureOnCommitCallbacks(execute=True):
            return self.client.delete(reverse(DELETE_URL))

    def going(self, activity, user, **extra):
        return ActivityParticipant.objects.create(
            activity=activity, user=user, status=extra.pop("status", "confirmed"), **extra
        )


class AccountDataTests(DeletionBase):
    def test_returns_204_and_requires_auth(self):
        self.assertEqual(
            self.client.delete(reverse(DELETE_URL)).status_code, status.HTTP_401_UNAUTHORIZED
        )
        response = self.delete_account()
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(User.objects.filter(pk=self.user.pk).exists())
        self.assertTrue(User.objects.filter(pk=self.friend.pk).exists())

    def test_personal_data_is_removed_and_other_people_are_untouched(self):
        HouseholdDependent.objects.create(parent=self.user, name="Kid")
        Friendship.objects.create(requester=self.user, recipient=self.friend, status="accepted")
        Friendship.objects.create(requester=self.other, recipient=self.user, status="pending")
        Friendship.objects.create(requester=self.friend, recipient=self.other, status="accepted")
        BlockedUser.objects.create(blocker=self.user, blocked=self.other)
        BlockedUser.objects.create(blocker=self.other, blocked=self.user)
        PushDeviceToken.objects.create(user=self.user, token="ExponentPushToken[x]")
        event = _activity(self.friend)
        self.going(event, self.user)
        Swipe.objects.create(user=self.user, activity=event, direction="right")

        self.delete_account()

        self.assertFalse(HouseholdDependent.objects.filter(name="Kid").exists())
        self.assertEqual(Friendship.objects.count(), 1)
        self.assertEqual(BlockedUser.objects.count(), 0)
        self.assertFalse(PushDeviceToken.objects.exists())
        self.assertFalse(ActivityParticipant.objects.exists())
        self.assertFalse(Swipe.objects.exists())
        self.assertTrue(Activity.objects.filter(pk=event.pk).exists())

    def test_direct_chats_go_away_for_both_people(self):
        match = Match.objects.create(user_a=self.user, user_b=self.friend, activity=None)
        convo = Conversation.objects.create(match=match)
        Message.objects.create(conversation=convo, sender=self.user, text="hi")
        Message.objects.create(conversation=convo, sender=self.friend, text="hello")
        other_match = Match.objects.create(user_a=self.friend, user_b=self.other, activity=None)
        other_convo = Conversation.objects.create(match=other_match)
        Message.objects.create(conversation=other_convo, sender=self.friend, text="keep")

        self.delete_account()

        self.assertFalse(Conversation.objects.filter(pk=convo.pk).exists())
        self.assertEqual(list(Message.objects.values_list("text", flat=True)), ["keep"])


class HostedGatheringTests(DeletionBase):
    def setUp(self):
        super().setUp()
        self.attendee = _user("attendee")
        self.requester = _user("requester")
        self.declined = _user("declined")
        self.event = _activity(self.user, title="Game Night")
        self.going(self.event, self.attendee)
        self.going(self.event, self.requester, status="pending")
        self.going(self.event, self.declined, status="declined")
        match = Match.get_or_create_normalized(self.event, self.attendee, self.requester)[0]
        self.convo = Conversation.objects.create(match=match)

    def test_upcoming_hosted_gatherings_notify_attendees_then_are_deleted(self):
        seen = {}

        def fake_push(recipient, title, body, payload):
            # The gathering must still exist and be marked cancelled when people are told.
            seen[recipient.id] = (
                title,
                body,
                payload,
                Activity.objects.get(pk=self.event.pk).is_cancelled,
                Message.objects.filter(conversation=self.convo).count(),
            )

        with patch(PUSH, side_effect=fake_push):
            response = self.delete_account()

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertEqual(set(seen), {self.attendee.id, self.requester.id})
        title, body, payload, was_cancelled, notes = seen[self.attendee.id]
        self.assertEqual(title, "Game Night was cancelled")
        self.assertIn("The host deleted their account.", body)
        self.assertEqual(payload["type"], "activity_cancelled")
        self.assertTrue(was_cancelled)
        self.assertEqual(notes, 1)  # the cancel note in the gathering chat
        self.assertFalse(Activity.objects.filter(pk=self.event.pk).exists())
        self.assertFalse(Conversation.objects.filter(pk=self.convo.pk).exists())

    def test_past_and_already_cancelled_gatherings_notify_no_one(self):
        past = _activity(self.user, title="Past", time=timezone.now() - timedelta(days=2))
        self.going(past, self.attendee)
        done = _activity(self.user, title="Done", is_cancelled=True, cancelled_at=timezone.now())
        self.going(done, self.attendee)
        self.event.delete()
        with patch(PUSH) as push:
            self.delete_account()
        push.assert_not_called()
        self.assertFalse(Activity.objects.filter(host_id=self.user.id).exists())

    def test_a_push_failure_does_not_block_deletion(self):
        with patch(PUSH, side_effect=RuntimeError("apns down")):
            response = self.delete_account()
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(User.objects.filter(pk=self.user.pk).exists())


class PhotoFileTests(DeletionBase):
    def setUp(self):
        super().setUp()
        self.media = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, self.media, True)
        override = override_settings(MEDIA_ROOT=self.media)
        override.enable()
        self.addCleanup(override.disable)

    def upload(self, activity, user):
        self.client.force_authenticate(user)
        response = self.client.post(
            reverse("activity-photo-upload", args=[activity.id]),
            {"image": _jpeg_upload()},
            format="multipart",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        return EventPhoto.objects.get(pk=response.data["id"])

    def path(self, photo):
        return os.path.join(self.media, photo.image.name)

    def test_photo_files_of_hosted_and_uploaded_photos_are_removed_from_disk(self):
        mine = _activity(self.user, title="Mine")
        theirs = _activity(self.friend, title="Theirs")
        own_photo = self.upload(mine, self.user)
        self.assertEqual(own_photo.uploaded_by, self.user)
        # A photo the user uploaded to someone else's gathering, and one by the other host.
        uploaded_elsewhere = EventPhoto.objects.create(
            activity=theirs, image=own_photo.image.name, uploaded_by=self.user
        )
        keep = self.upload(theirs, self.friend)
        self.assertTrue(os.path.exists(self.path(keep)))
        # Give the elsewhere photo its own file.
        uploaded_elsewhere.image.save("elsewhere.jpg", _jpeg_upload(), save=True)
        elsewhere_path = self.path(uploaded_elsewhere)
        own_path = self.path(own_photo)
        self.assertTrue(os.path.exists(own_path))
        self.assertTrue(os.path.exists(elsewhere_path))

        self.delete_account()

        self.assertFalse(os.path.exists(own_path))
        self.assertFalse(os.path.exists(elsewhere_path))
        self.assertTrue(os.path.exists(self.path(keep)))
        self.assertEqual(list(EventPhoto.objects.values_list("pk", flat=True)), [keep.pk])

    def test_deleting_any_photo_row_removes_its_file(self):
        event = _activity(self.friend)
        photo = self.upload(event, self.friend)
        path = self.path(photo)
        self.assertTrue(os.path.exists(path))
        with self.captureOnCommitCallbacks(execute=True):
            photo.delete()
        self.assertFalse(os.path.exists(path))

    def test_file_survives_if_the_transaction_never_commits(self):
        event = _activity(self.friend)
        photo = self.upload(event, self.friend)
        path = self.path(photo)
        photo.delete()  # on_commit callback not executed in this TestCase transaction
        self.assertTrue(os.path.exists(path))


class InviteScrubTests(DeletionBase):
    def test_invites_addressed_to_the_user_are_blanked_and_others_kept(self):
        self.user.phone = "+12155550123"
        self.user.save(update_fields=["phone"])
        by_email = Invite.objects.create(
            inviter=self.friend,
            contact_name="Leaver L",
            contact_value="LEAVER@example.com",
            channel="email",
        )
        by_phone = Invite.objects.create(
            inviter=self.friend,
            contact_name="Leaver",
            contact_value="(215) 555-0123",
            channel="sms",
        )
        accepted = Invite.objects.create(
            inviter=self.other,
            contact_name="Me",
            contact_value="something-else@example.com",
            channel="email",
            status="accepted",
            invitee=self.user,
        )
        unrelated = Invite.objects.create(
            inviter=self.friend,
            contact_name="Someone",
            contact_value="someone@example.com",
            channel="email",
        )
        sent = Invite.objects.create(
            inviter=self.user, contact_name="Out", contact_value="out@example.com", channel="email"
        )

        self.delete_account()

        for invite in (by_email, by_phone, accepted):
            invite.refresh_from_db()
            self.assertEqual((invite.contact_name, invite.contact_value), ("", ""))
            self.assertIsNone(invite.invitee)
        unrelated.refresh_from_db()
        self.assertEqual(unrelated.contact_value, "someone@example.com")
        self.assertFalse(Invite.objects.filter(pk=sent.pk).exists())


class ReportRetentionTests(DeletionBase):
    def test_reports_are_kept_without_the_user_attached(self):
        filed = AbuseReport.objects.create(
            reporter=self.user,
            reported_user=self.friend,
            reason="spam",
            description="spammy",
            target_type="chat_message",
            target_id=7,
            target_snapshot="buy now",
        )
        about = AbuseReport.objects.create(
            reporter=self.friend, reported_user=self.user, reason="harassment"
        )

        self.delete_account()

        filed.refresh_from_db()
        about.refresh_from_db()
        self.assertIsNone(filed.reporter)
        self.assertEqual(filed.reported_user, self.friend)
        self.assertEqual(
            (filed.reason, filed.description, filed.target_type, filed.target_id),
            ("spam", "spammy", "chat_message", 7),
        )
        self.assertEqual(filed.target_snapshot, "buy now")
        self.assertIsNone(about.reported_user)
        self.assertEqual(about.reporter, self.friend)
        self.assertIn("harassment", str(about))


class GatheringChatSurvivalTests(DeletionBase):
    def setUp(self):
        super().setUp()
        self.host = _user("chathost")
        self.second = _user("second")
        self.third = _user("third")
        self.event = _activity(self.host, title="Potluck")
        # The leaver joined first and the third person last: they are the chat's anchors.
        self.going(self.event, self.user)
        self.going(self.event, self.second)
        self.going(self.event, self.third)
        self.match = Match.get_or_create_normalized(self.event, self.user, self.third)[0]
        self.convo = Conversation.objects.create(match=self.match)
        for sender, text in [
            (self.user, "from leaver"),
            (self.second, "from second"),
            (self.third, "from third"),
        ]:
            Message.objects.create(conversation=self.convo, sender=sender, text=text)

    def chat(self, viewer):
        self.client.force_authenticate(viewer)
        return self.client.get(reverse("activity-chat", args=[self.event.id]))

    def test_chat_survives_without_the_leavers_messages(self):
        self.delete_account()

        self.assertTrue(Conversation.objects.filter(pk=self.convo.pk).exists())
        self.assertEqual(
            [m.text for m in Message.objects.filter(conversation=self.convo).order_by("id")],
            ["from second", "from third"],
        )
        match = Match.objects.get(pk=self.match.pk)
        self.assertEqual({match.user_a_id, match.user_b_id}, {self.second.id, self.third.id})
        self.assertLess(match.user_a_id, match.user_b_id)
        response = self.chat(self.second)
        self.assertEqual([m["message"] for m in response.data], ["from second", "from third"])
        self.assertEqual(Conversation.objects.filter(match__activity=self.event).count(), 1)

    def test_leaver_who_is_not_an_anchor_only_loses_their_own_messages(self):
        event = _activity(self.host, title="Brunch")
        self.going(event, self.second)
        self.going(event, self.user)
        self.going(event, self.third)
        match = Match.get_or_create_normalized(event, self.second, self.third)[0]
        convo = Conversation.objects.create(match=match)
        for sender, text in [(self.user, "middle"), (self.second, "first"), (self.third, "last")]:
            Message.objects.create(conversation=convo, sender=sender, text=text)

        self.delete_account()

        match.refresh_from_db()
        self.assertEqual({match.user_a_id, match.user_b_id}, {self.second.id, self.third.id})
        self.assertEqual(
            [m.text for m in Message.objects.filter(conversation=convo).order_by("id")],
            ["first", "last"],
        )

    def test_chat_is_folded_into_an_existing_chat_for_the_new_pair(self):
        existing = Match.get_or_create_normalized(self.event, self.second, self.third)[0]
        other_convo = Conversation.objects.create(match=existing)
        Message.objects.create(conversation=other_convo, sender=self.second, text="already here")

        self.delete_account()

        self.assertFalse(Match.objects.filter(pk=self.match.pk).exists())
        texts = set(Message.objects.filter(conversation=other_convo).values_list("text", flat=True))
        self.assertEqual(texts, {"already here", "from second", "from third"})

    def test_chat_with_fewer_than_two_people_left_is_removed(self):
        ActivityParticipant.objects.filter(user=self.second).delete()
        self.delete_account()
        self.assertFalse(Conversation.objects.filter(pk=self.convo.pk).exists())
        self.assertFalse(Message.objects.filter(text="from third").exists())

    def test_messages_in_chats_the_leaver_did_not_anchor_are_removed(self):
        # A second chat on the same gathering anchored by two other people.
        fourth = _user("fourth")
        other = Match.get_or_create_normalized(self.event, self.second, fourth)[0]
        other_convo = Conversation.objects.create(match=other)
        Message.objects.create(conversation=other_convo, sender=self.user, text="leaver again")
        Message.objects.create(conversation=other_convo, sender=self.second, text="stay")

        self.delete_account()

        self.assertEqual(
            list(Message.objects.filter(conversation=other_convo).values_list("text", flat=True)),
            ["stay"],
        )


@override_settings(**APPLE_SETTINGS)
class AppleSignInTests(DeletionBase):
    def apple_login(self, **extra):
        body = {"identity_token": "tok", "email": "apple@example.com", **extra}
        with patch("users.oauth_views.verify_apple_identity_token") as verify:
            verify.return_value = {"sub": "apple-sub-1", "email": "apple@example.com"}
            return self.client.post(reverse("apple_mobile_login"), body, format="json")

    @staticmethod
    def apple_response(status_code=200, payload=None):
        response = MagicMock()
        response.status_code = status_code
        response.json.return_value = payload or {}
        return response

    def test_authorization_code_is_exchanged_and_the_refresh_token_is_kept_private(self):
        with patch(
            APPLE_POST, return_value=self.apple_response(payload={"refresh_token": "r-1"})
        ) as post:
            response = self.apple_login(authorization_code="auth-code")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertNotIn("r-1", str(response.data))
        identity = SocialAuthIdentity.objects.get(provider="apple")
        self.assertEqual(identity.apple_refresh_token, "r-1")
        args, kwargs = post.call_args
        self.assertEqual(args[0], "https://appleid.apple.com/auth/token")
        self.assertEqual(kwargs["data"]["code"], "auth-code")
        self.assertEqual(kwargs["data"]["grant_type"], "authorization_code")
        self.assertEqual(kwargs["data"]["client_id"], "com.irlobby.app")
        claims = jwt.decode(
            kwargs["data"]["client_secret"],
            APPLE_PUBLIC_PEM,
            algorithms=["ES256"],
            audience="https://appleid.apple.com",
        )
        self.assertEqual(claims["iss"], "TEAM123456")
        self.assertEqual(claims["sub"], "com.irlobby.app")
        header = jwt.get_unverified_header(kwargs["data"]["client_secret"])
        self.assertEqual(header["kid"], "KEY1234567")

    def test_camel_case_code_works_and_failures_never_break_login(self):
        with patch(APPLE_POST, side_effect=RuntimeError("down")):
            response = self.apple_login(authorizationCode="auth-code")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(SocialAuthIdentity.objects.get().apple_refresh_token, "")
        with patch(APPLE_POST, return_value=self.apple_response(400, {"error": "invalid_grant"})):
            self.assertEqual(
                self.apple_login(authorization_code="again").status_code, status.HTTP_200_OK
            )
        self.assertEqual(SocialAuthIdentity.objects.get().apple_refresh_token, "")

    def test_login_without_a_code_does_not_call_apple(self):
        with patch(APPLE_POST) as post:
            self.assertEqual(self.apple_login().status_code, status.HTTP_200_OK)
        post.assert_not_called()

    @override_settings(APPLE_SIGNIN_PRIVATE_KEY="")
    def test_nothing_is_called_when_apple_signing_is_not_configured(self):
        with patch(APPLE_POST) as post:
            self.assertEqual(
                self.apple_login(authorization_code="code").status_code, status.HTTP_200_OK
            )
        post.assert_not_called()

    def test_deleting_the_account_revokes_the_apple_token(self):
        with patch(APPLE_POST, return_value=self.apple_response(payload={"refresh_token": "r-9"})):
            self.apple_login(authorization_code="c")
        apple_user = SocialAuthIdentity.objects.get().user

        with patch(APPLE_POST, return_value=self.apple_response()) as post:
            response = self.delete_account(apple_user)

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(User.objects.filter(pk=apple_user.pk).exists())
        args, kwargs = post.call_args
        self.assertEqual(args[0], "https://appleid.apple.com/auth/revoke")
        self.assertEqual(kwargs["data"]["token"], "r-9")
        self.assertEqual(kwargs["data"]["token_type_hint"], "refresh_token")
        self.assertEqual(kwargs["data"]["client_id"], "com.irlobby.app")
        jwt.decode(
            kwargs["data"]["client_secret"],
            APPLE_PUBLIC_PEM,
            algorithms=["ES256"],
            audience="https://appleid.apple.com",
        )

    def test_apple_errors_do_not_block_deletion(self):
        SocialAuthIdentity.objects.create(
            user=self.user, provider="apple", provider_user_id="a-1", apple_refresh_token="r-2"
        )
        with patch(APPLE_POST, side_effect=RuntimeError("apple down")):
            self.assertEqual(self.delete_account().status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(User.objects.filter(pk=self.user.pk).exists())

    def test_no_stored_token_means_no_apple_call(self):
        SocialAuthIdentity.objects.create(user=self.user, provider="apple", provider_user_id="a-2")
        with patch(APPLE_POST) as post:
            self.assertEqual(self.delete_account().status_code, status.HTTP_204_NO_CONTENT)
        post.assert_not_called()

    @override_settings(APPLE_SIGNIN_KEY_ID="")
    def test_unconfigured_deletion_never_calls_apple(self):
        SocialAuthIdentity.objects.create(
            user=self.user, provider="apple", provider_user_id="a-3", apple_refresh_token="r-3"
        )
        with patch(APPLE_POST) as post:
            self.assertEqual(self.delete_account().status_code, status.HTTP_204_NO_CONTENT)
        post.assert_not_called()
