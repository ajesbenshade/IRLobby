"""Profile visibility, contact toggles, reports, blocks and friends."""

from datetime import timedelta

from django.test import override_settings
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APITestCase

from activities.models import Activity, ActivityParticipant, Church
from activities.test_foyer import _activity, _safe_birthdate
from moderation.models import AbuseReport, BlockedUser
from users.models import Friendship, User
from users.social import normalize_phone

PHONE = "+12155550123"


def make(name, age=40, **extra):
    return User.objects.create_user(
        username=name,
        email=f"{name}@example.com",
        password="Passw0rd-123",
        first_name=name.capitalize(),
        last_name="Lastname",
        date_of_birth=_safe_birthdate(age),
        **extra,
    )


def card_url(user):
    return reverse("user-profile-card", args=[user.id])


def attend_together(*users):
    """Put users on one gathering that already started."""
    activity = _activity(users[0], time=timezone.now() - timedelta(hours=3))
    for user in users[1:]:
        ActivityParticipant.objects.create(activity=activity, user=user, status="confirmed")
    return activity


class PhoneNormalizationTests(APITestCase):
    def test_normalize(self):
        self.assertEqual(normalize_phone("(215) 555-0123"), PHONE)
        self.assertEqual(normalize_phone("1-215-555-0123"), PHONE)
        self.assertEqual(normalize_phone("+44 20 7946 0958"), "+442079460958")
        self.assertEqual(normalize_phone(""), "")
        for bad in ("abc", "12345", "+0123456789", "+1" + "2" * 20):
            with self.assertRaises(ValueError):
                normalize_phone(bad)

    def test_own_profile_saves_and_returns_phone_and_privacy_fields(self):
        me = make("me")
        self.client.force_authenticate(me)
        resp = self.client.patch(
            reverse("user-profile"),
            {"phone": "215-555-0123", "show_phone": True, "profile_visibility": "public",
             "dm_from_shared_events": True},
            format="json",
        )
        self.assertEqual(resp.status_code, 200, resp.data)
        self.assertEqual(resp.data["phone"], PHONE)
        self.assertEqual(resp.data["profile_visibility"], "public")
        self.assertTrue(resp.data["show_phone"] and resp.data["dm_from_shared_events"])
        self.assertFalse(resp.data["show_email"])
        bad = self.client.patch(reverse("user-profile"), {"phone": "nope"}, format="json")
        self.assertEqual(bad.status_code, 400)
        worse = self.client.patch(reverse("user-profile"), {"profile_visibility": "everyone"}, format="json")
        self.assertEqual(worse.status_code, 400)

    def test_defaults_are_private(self):
        me = make("me")
        self.assertEqual(
            (me.profile_visibility, me.show_email, me.show_phone, me.dm_from_shared_events, me.phone),
            ("only_me", False, False, False, ""),
        )


class ProfileCardTests(APITestCase):
    def setUp(self):
        self.church = Church.objects.create(name="Test Church")
        self.owner = make("owner", phone=PHONE, bio="Hello there", church=self.church,
                          show_email=True, show_phone=True, avatar_url="https://x/y.png")
        self.viewer = make("viewer")
        self.client.force_authenticate(self.viewer)

    def set_level(self, level, **extra):
        User.objects.filter(pk=self.owner.pk).update(profile_visibility=level, **extra)

    def get(self):
        return self.client.get(card_url(self.owner))

    def test_requires_auth(self):
        self.client.force_authenticate(None)
        self.assertEqual(self.get().status_code, 401)

    def test_only_me_hides_from_stranger(self):
        self.assertEqual(self.get().status_code, 404)

    def test_public_shows_card_and_contact_only_when_toggled(self):
        self.set_level("public")
        data = self.get().data
        self.assertEqual(
            set(data), {"id", "first_name", "avatar_url", "bio", "friendship", "visible", "email", "phone"}
        )
        self.assertEqual((data["email"], data["phone"]), ("owner@example.com", PHONE))
        self.set_level("public", show_email=False)
        data = self.get().data
        self.assertNotIn("email", data)
        self.assertEqual(data["phone"], PHONE)
        self.set_level("public", show_phone=False)
        self.assertNotIn("phone", self.get().data)
        self.assertNotIn("Lastname", str(self.get().data))
        self.assertEqual(self.get().data["friendship"], "none")

    def test_never_returns_location_family_username_birth(self):
        self.set_level("public")
        User.objects.filter(pk=self.owner.pk).update(location="Secret City", latitude=1.0, longitude=2.0)
        from activities.models import HouseholdDependent

        HouseholdDependent.objects.create(parent=self.owner, name="KidName", relationship="spouse")
        text = str(self.get().data).lower()
        for leak in ("secret city", "kidname", "username", "date_of_birth", "latitude"):
            self.assertNotIn(leak, text)

    def test_church_level(self):
        self.set_level("church")
        self.assertEqual(self.get().status_code, 404)
        User.objects.filter(pk=self.viewer.pk).update(church=self.church)
        self.viewer.refresh_from_db()
        resp = self.get()
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data["phone"], PHONE)

    def test_church_level_hides_contact_from_outside_church_even_with_toggle(self):
        # Viewer shares an event (so can send a request) but is not in the church.
        self.set_level("church")
        attend_together(self.owner, self.viewer)
        data = self.get().data
        self.assertFalse(data["visible"])
        self.assertEqual(set(data), {"id", "first_name", "friendship", "visible"})

    def test_friends_level_and_contact(self):
        self.set_level("friends")
        self.assertEqual(self.get().status_code, 404)
        Friendship.objects.create(requester=self.viewer, recipient=self.owner, status="accepted")
        data = self.get().data
        self.assertEqual(data["friendship"], "friends")
        self.assertEqual(data["phone"], PHONE)

    def test_only_me_friend_gets_nothing(self):
        Friendship.objects.create(requester=self.viewer, recipient=self.owner, status="accepted")
        self.assertEqual(self.get().status_code, 404)

    def test_blocked_either_way_is_404(self):
        self.set_level("public")
        block = BlockedUser.objects.create(blocker=self.viewer, blocked=self.owner)
        self.assertEqual(self.get().status_code, 404)
        block.delete()
        BlockedUser.objects.create(blocker=self.owner, blocked=self.viewer)
        self.assertEqual(self.get().status_code, 404)

    def test_unknown_user_404(self):
        self.assertEqual(self.client.get(reverse("user-profile-card", args=[99999])).status_code, 404)

    def test_minor_only_visible_to_friends_even_when_public(self):
        teen = make("teen", age=15, phone=PHONE, show_phone=True, profile_visibility="public")
        self.assertEqual(self.client.get(card_url(teen)).status_code, 404)
        attend_together(teen, self.viewer)
        self.assertEqual(self.client.get(card_url(teen)).status_code, 404)
        Friendship.objects.create(requester=self.viewer, recipient=teen, status="accepted")
        self.assertEqual(self.client.get(card_url(teen)).status_code, 200)

    def test_own_card_returns_own_contact(self):
        self.client.force_authenticate(self.owner)
        data = self.client.get(card_url(self.owner)).data
        self.assertEqual((data["phone"], data["email"], data["friendship"]), (PHONE, "owner@example.com", "self"))

    def test_phone_not_in_other_responses(self):
        self.set_level("public")
        activity = _activity(self.owner, time=timezone.now() - timedelta(hours=1))
        ActivityParticipant.objects.create(activity=activity, user=self.viewer, status="confirmed")
        for name, args in (
            ("activity-detail", [activity.id]),
            ("activity-whos-coming", [activity.id]),
            ("activity-attendees", [activity.id]),
            ("activity-list", []),
            ("friend-list", []),
            ("conversation-list", []),
        ):
            resp = self.client.get(reverse(name, args=args))
            self.assertNotIn("215555", resp.content.decode(), name)
            self.assertNotIn("owner@example.com", resp.content.decode(), name)


class ReportTests(APITestCase):
    def setUp(self):
        self.me, self.target = make("me"), make("target")
        self.client.force_authenticate(self.me)

    def test_report_creates_abuse_report(self):
        resp = self.client.post(
            reverse("user-report", args=[self.target.id]),
            {"reason": "spam", "description": "<b>bad</b>"},
            format="json",
        )
        self.assertEqual(resp.status_code, 201)
        report = AbuseReport.objects.get()
        self.assertEqual((report.reporter, report.reported_user, report.description), (self.me, self.target, "bad"))

    def test_report_validation_and_auth(self):
        url = reverse("user-report", args=[self.target.id])
        self.assertEqual(self.client.post(url, {"reason": "zzz"}, format="json").status_code, 400)
        self.assertEqual(self.client.post(reverse("user-report", args=[self.me.id]), {}, format="json").status_code, 400)
        self.assertEqual(self.client.post(reverse("user-report", args=[9999]), {}, format="json").status_code, 404)
        self.client.force_authenticate(None)
        self.assertEqual(self.client.post(url, {}, format="json").status_code, 401)

    def test_existing_block_endpoint_removes_friendship(self):
        Friendship.objects.create(requester=self.me, recipient=self.target, status="accepted")
        resp = self.client.post(reverse("block-user", args=[self.target.id]))
        self.assertEqual(resp.status_code, 201)
        self.assertFalse(Friendship.objects.exists())


class FriendFlowTests(APITestCase):
    def setUp(self):
        self.a, self.b = make("alice"), make("bob")
        self.client.force_authenticate(self.a)

    def send(self, target, user=None):
        if user:
            self.client.force_authenticate(user)
        return self.client.post(reverse("friend-requests"), {"user_id": target.id}, format="json")

    def test_requires_auth(self):
        self.client.force_authenticate(None)
        for name in ("friend-requests", "friend-list"):
            self.assertEqual(self.client.get(reverse(name)).status_code, 401)
        self.assertEqual(self.client.post(reverse("friend-requests"), {}).status_code, 401)
        self.assertEqual(self.client.delete(reverse("friend-remove", args=[1])).status_code, 401)

    def test_strangers_cannot_request(self):
        self.assertEqual(self.send(self.b).status_code, 403)

    def test_cannot_friend_yourself_or_garbage(self):
        self.assertEqual(self.send(self.a).status_code, 400)
        resp = self.client.post(reverse("friend-requests"), {"user_id": "x"}, format="json")
        self.assertEqual(resp.status_code, 400)
        self.assertEqual(self.client.post(reverse("friend-requests"), {"user_id": 99999}, format="json").status_code, 404)

    def test_reachable_via_public_church_or_shared_event(self):
        User.objects.filter(pk=self.b.pk).update(profile_visibility="public")
        self.assertEqual(self.send(self.b).status_code, 201)
        c = make("carl")
        church = Church.objects.create(name="C")
        User.objects.filter(pk__in=[self.a.pk, c.pk]).update(church=church)
        self.a.refresh_from_db()
        self.assertEqual(self.send(c).status_code, 201)
        d = make("dina")
        attend_together(d, self.a)
        self.assertEqual(self.send(d).status_code, 201)

    def test_future_event_does_not_count_as_shared(self):
        d = make("dina")
        future = _activity(d)
        ActivityParticipant.objects.create(activity=future, user=self.a, status="confirmed")
        self.assertEqual(self.send(d).status_code, 403)

    def test_public_minor_not_reachable_without_shared_event(self):
        teen = make("teen", age=15, profile_visibility="public")
        self.assertEqual(self.send(teen).status_code, 403)
        attend_together(teen, self.a)
        self.assertEqual(self.send(teen).status_code, 201)

    def test_blocks_prevent_requests_either_way(self):
        User.objects.filter(pk__in=[self.a.pk, self.b.pk]).update(profile_visibility="public")
        BlockedUser.objects.create(blocker=self.b, blocked=self.a)
        self.assertEqual(self.send(self.b).status_code, 404)
        BlockedUser.objects.all().delete()
        BlockedUser.objects.create(blocker=self.a, blocked=self.b)
        self.assertEqual(self.send(self.b).status_code, 404)

    def test_full_flow_accept_list_remove(self):
        User.objects.filter(pk=self.b.pk).update(profile_visibility="public")
        sent = self.send(self.b)
        self.assertEqual(sent.status_code, 201)
        self.assertEqual(sent.data["direction"], "outgoing")
        self.assertEqual(set(sent.data["user"]), {"id", "first_name", "avatar_url"})
        # duplicate send is idempotent
        self.assertEqual(self.send(self.b).status_code, 200)
        self.assertEqual(Friendship.objects.count(), 1)
        box = self.client.get(reverse("friend-requests")).data
        self.assertEqual(len(box["outgoing"]), 1)
        self.assertEqual(box["incoming"], [])

        self.client.force_authenticate(self.b)
        inbox = self.client.get(reverse("friend-requests")).data
        self.assertEqual(inbox["incoming"][0]["user"]["id"], self.a.id)
        rid = inbox["incoming"][0]["id"]
        # only the recipient can accept
        self.client.force_authenticate(self.a)
        self.assertEqual(self.client.post(reverse("friend-request-accept", args=[rid])).status_code, 404)
        self.client.force_authenticate(self.b)
        self.assertEqual(self.client.post(reverse("friend-request-accept", args=[rid])).data["status"], "accepted")
        self.assertEqual(self.client.post(reverse("friend-request-accept", args=[rid])).status_code, 404)
        friends = self.client.get(reverse("friend-list")).data["friends"]
        self.assertEqual([f["user_id"] for f in friends], [self.a.id])
        self.assertEqual(set(friends[0]), {"user_id", "first_name", "avatar_url", "since"})
        self.assertEqual(self.send(self.a).status_code, 409)

        self.assertEqual(self.client.delete(reverse("friend-remove", args=[self.a.id])).status_code, 204)
        self.assertEqual(self.client.delete(reverse("friend-remove", args=[self.a.id])).status_code, 404)
        self.assertEqual(self.client.get(reverse("friend-list")).data["friends"], [])

    def test_decline_hides_from_requester_and_allows_reverse_request(self):
        User.objects.filter(pk__in=[self.a.pk, self.b.pk]).update(profile_visibility="public")
        rid = self.send(self.b).data["id"]
        self.client.force_authenticate(self.b)
        self.assertEqual(self.client.post(reverse("friend-request-decline", args=[rid])).data["status"], "declined")
        self.assertEqual(self.client.get(reverse("friend-requests")).data["incoming"], [])
        self.client.force_authenticate(self.a)
        self.assertEqual(self.send(self.b).status_code, 200)  # still looks pending to a
        self.assertEqual(Friendship.objects.count(), 1)
        # b can now ask a: reopens the same row, no reverse duplicate
        resp = self.send(self.a, user=self.b)
        self.assertEqual(resp.status_code, 201)
        self.assertEqual(Friendship.objects.count(), 1)
        row = Friendship.objects.get()
        self.assertEqual((row.requester, row.recipient, row.status), (self.b, self.a, "pending"))

    def test_mutual_request_auto_accepts(self):
        User.objects.filter(pk__in=[self.a.pk, self.b.pk]).update(profile_visibility="public")
        self.send(self.b)
        resp = self.send(self.a, user=self.b)
        self.assertEqual(resp.data["status"], "accepted")
        self.assertEqual(Friendship.objects.get().status, "accepted")

    def test_db_blocks_reverse_duplicate_and_self(self):
        from django.db import IntegrityError, transaction

        Friendship.objects.create(requester=self.a, recipient=self.b)
        for kwargs in ({"requester": self.b, "recipient": self.a}, {"requester": self.a, "recipient": self.a}):
            with self.assertRaises(IntegrityError), transaction.atomic():
                Friendship.objects.create(**kwargs)

    def test_withdraw_own_pending_request_only(self):
        User.objects.filter(pk=self.b.pk).update(profile_visibility="public")
        self.send(self.b)
        self.client.force_authenticate(self.b)
        self.assertEqual(self.client.delete(reverse("friend-remove", args=[self.a.id])).status_code, 404)
        self.client.force_authenticate(self.a)
        self.assertEqual(self.client.delete(reverse("friend-remove", args=[self.b.id])).status_code, 204)

    def test_blocked_requests_hidden_from_inbox(self):
        User.objects.filter(pk=self.b.pk).update(profile_visibility="public")
        self.send(self.b)
        BlockedUser.objects.create(blocker=self.b, blocked=self.a)
        self.client.force_authenticate(self.b)
        self.assertEqual(self.client.get(reverse("friend-requests")).data["incoming"], [])

    @override_settings(REST_FRAMEWORK={"DEFAULT_THROTTLE_RATES": {"friend_requests": "2/min"}})
    def test_sending_is_rate_limited_reading_is_not(self):
        from django.core.cache import cache

        cache.clear()
        targets = [make(f"t{i}", profile_visibility="public") for i in range(3)]
        codes = [self.send(t).status_code for t in targets]
        self.assertEqual(codes, [201, 201, 429])
        for _ in range(4):
            self.assertEqual(self.client.get(reverse("friend-requests")).status_code, 200)
        cache.clear()
