"""Require approval: host setting, pending requests, approve/decline, pushes, and privacy."""

from datetime import timedelta
from unittest.mock import patch

from django.db import connection
from django.test import override_settings
from django.test.utils import CaptureQueriesContext
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from activities.models import Activity, ActivityParticipant, Church, HouseholdDependent
from activities.tasks import notify_upcoming_activities
from activities.test_foyer import _activity, _safe_birthdate
from moderation.models import BlockedUser
from users.models import User

PUSH = "users.push_notifications.send_push_to_user"
CHURCH_ADMIN_EMAIL = "admin@example.com"


def _user(name, **extra):
    extra.setdefault("date_of_birth", _safe_birthdate(40))
    return User.objects.create_user(
        username=name,
        email=f"{name}@example.com",
        password="Passw0rd-123",
        first_name=name.capitalize(),
        last_name="Lastname",
        **extra,
    )


def _create_payload(**overrides):
    payload = {
        "title": "Supper Club",
        "description": "Dinner at our place.",
        "location": "12 Maple Lane",
        "latitude": 40.31,
        "longitude": -75.34,
        "time": (timezone.now() + timedelta(days=3)).isoformat(),
        "capacity": 6,
        "tags": [],
        "images": [],
    }
    payload.update(overrides)
    return payload


class ApprovalBase(APITestCase):
    def setUp(self):
        self.host = _user("host")
        self.guest = _user("guest")
        self.other = _user("other")
        self.staff = _user("staffer", is_staff=True)
        self.activity = _activity(self.host, title="Supper Club", requires_approval=True)
        self.rsvp_url = reverse("activity-rsvp", args=[self.activity.id])
        self.cancel_url = reverse("activity-rsvp-cancel", args=[self.activity.id])
        self.requests_url = reverse("activity-requests", args=[self.activity.id])

    def rsvp(self, user, body=None, activity=None):
        self.client.force_authenticate(user)
        url = reverse("activity-rsvp", args=[(activity or self.activity).id])
        return self.client.post(
            url, body if body is not None else {"include_self": True}, format="json"
        )

    def rsvp_and_commit(self, user, body=None, activity=None):
        with self.captureOnCommitCallbacks(execute=True):
            return self.rsvp(user, body, activity)

    def listing(self, user, query="", activity=None):
        self.client.force_authenticate(user)
        url = reverse("activity-requests", args=[(activity or self.activity).id])
        return self.client.get(f"{url}{query}")

    def decide(self, user, verb, participant_id, body=None, activity=None, commit=True):
        self.client.force_authenticate(user)
        url = reverse(
            f"activity-request-{verb}", args=[(activity or self.activity).id, participant_id]
        )
        if commit:
            with self.captureOnCommitCallbacks(execute=True):
                return self.client.post(url, body or {}, format="json")
        return self.client.post(url, body or {}, format="json")

    def participant(self, user, activity=None):
        return ActivityParticipant.objects.get(activity=activity or self.activity, user=user)

    def request_from(self, user, status_value="pending", **extra):
        return ActivityParticipant.objects.create(
            activity=extra.pop("activity", self.activity), user=user, status=status_value, **extra
        )

    def detail(self, user, activity=None):
        self.client.force_authenticate(user)
        return self.client.get(reverse("activity-detail", args=[(activity or self.activity).id]))


class HostSettingTests(ApprovalBase):
    def test_host_can_create_with_require_approval(self):
        self.client.force_authenticate(self.host)
        response = self.client.post(
            reverse("activity-list"),
            _create_payload(requires_approval=True, allow_rerequest=True),
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(response.data["requires_approval"])
        self.assertTrue(response.data["allow_rerequest"])
        created = Activity.objects.get(pk=response.data["id"])
        self.assertTrue(created.requires_approval)
        self.assertTrue(created.allow_rerequest)

    def test_defaults_are_off(self):
        self.client.force_authenticate(self.host)
        response = self.client.post(reverse("activity-list"), _create_payload(), format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertFalse(response.data["requires_approval"])
        self.assertFalse(response.data["allow_rerequest"])

    def test_host_can_patch_both_settings_including_camel_case(self):
        self.client.force_authenticate(self.host)
        url = reverse("activity-detail", args=[self.activity.id])
        response = self.client.patch(
            url, {"requiresApproval": False, "allowRerequest": True}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.activity.refresh_from_db()
        self.assertFalse(self.activity.requires_approval)
        self.assertTrue(self.activity.allow_rerequest)
        response = self.client.patch(url, {"requires_approval": True}, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data["requires_approval"])

    def test_guest_and_staff_cannot_change_the_setting(self):
        url = reverse("activity-detail", args=[self.activity.id])
        for user in (self.guest, self.staff):
            self.client.force_authenticate(user)
            response = self.client.patch(
                url, {"requires_approval": False, "allow_rerequest": True}, format="json"
            )
            self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.activity.refresh_from_db()
        self.assertTrue(self.activity.requires_approval)
        self.assertFalse(self.activity.allow_rerequest)

    @override_settings(FOYER_CHURCH_ADMIN_EMAILS=[CHURCH_ADMIN_EMAIL])
    def test_church_hosted_event_rejects_require_approval(self):
        admin = _user("admin")
        self.client.force_authenticate(admin)
        response = self.client.post(
            reverse("activity-list"),
            _create_payload(host_kind="church", requires_approval=True),
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("requires_approval", response.data)
        ok = self.client.post(
            reverse("activity-list"), _create_payload(host_kind="church"), format="json"
        )
        self.assertEqual(ok.status_code, status.HTTP_201_CREATED)
        url = reverse("activity-detail", args=[ok.data["id"]])
        again = self.client.patch(url, {"requires_approval": True}, format="json")
        self.assertEqual(again.status_code, status.HTTP_400_BAD_REQUEST)

    @override_settings(FOYER_CHURCH_ADMIN_EMAILS=[CHURCH_ADMIN_EMAIL])
    def test_public_calendar_event_rejects_require_approval(self):
        admin = _user("admin")
        # A church admin listing their own event makes it public straight away.
        self.client.force_authenticate(admin)
        response = self.client.post(
            reverse("activity-list"),
            _create_payload(list_on_church_calendar=True, requires_approval=True),
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        public = _activity(self.host, list_on_church_calendar=True, calendar_approved=True)
        self.client.force_authenticate(self.host)
        patched = self.client.patch(
            reverse("activity-detail", args=[public.id]),
            {"requires_approval": True},
            format="json",
        )
        self.assertEqual(patched.status_code, status.HTTP_400_BAD_REQUEST)
        public.refresh_from_db()
        self.assertFalse(public.requires_approval)

    def test_listing_a_require_approval_event_publicly_is_blocked_at_approval(self):
        self.client.force_authenticate(self.host)
        patched = self.client.patch(
            reverse("activity-detail", args=[self.activity.id]),
            {"list_on_church_calendar": True},
            format="json",
        )
        # Not public yet (the church has not approved it), so the host may keep the setting.
        self.assertEqual(patched.status_code, status.HTTP_200_OK)
        admin = _user("admin")
        with override_settings(FOYER_CHURCH_ADMIN_EMAILS=[admin.email]):
            self.client.force_authenticate(admin)
            response = self.client.post(
                reverse("activity-calendar-approve", args=[self.activity.id])
            )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.activity.refresh_from_db()
        self.assertFalse(self.activity.calendar_approved)

    def test_turning_off_with_pending_requests_is_rejected(self):
        self.request_from(self.guest)
        self.client.force_authenticate(self.host)
        url = reverse("activity-detail", args=[self.activity.id])
        response = self.client.patch(url, {"requires_approval": False}, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("pending requests", response.data["requires_approval"][0])
        self.activity.refresh_from_db()
        self.assertTrue(self.activity.requires_approval)
        # Once the request is decided the host can switch it off.
        self.decide(self.host, "decline", self.participant(self.guest).id)
        self.client.force_authenticate(self.host)
        response = self.client.patch(url, {"requires_approval": False}, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_turning_off_with_only_confirmed_or_declined_people_is_fine(self):
        self.request_from(self.guest, "confirmed")
        self.request_from(self.other, "declined")
        self.client.force_authenticate(self.host)
        response = self.client.patch(
            reverse("activity-detail", args=[self.activity.id]),
            {"requires_approval": False},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_turning_on_leaves_existing_confirmed_guests_alone(self):
        plain = _activity(self.host, title="Open house")
        self.request_from(self.guest, "confirmed", activity=plain)
        self.client.force_authenticate(self.host)
        response = self.client.patch(
            reverse("activity-detail", args=[plain.id]), {"requires_approval": True}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(self.participant(self.guest, plain).status, "confirmed")
        self.assertEqual(response.data["going_count"], 1)
        self.assertEqual(response.data["pending_count"], 0)


class RsvpRequestTests(ApprovalBase):
    def test_rsvp_creates_a_pending_request(self):
        response = self.rsvp(self.guest)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["status"], "pending")
        self.assertEqual(response.data["my_request_status"], "pending")
        self.assertEqual(response.data["going_count"], 0)
        self.assertEqual(response.data["people_count"], 1)
        self.assertTrue(response.data["include_self"])
        self.assertEqual(self.participant(self.guest).status, "pending")

    def test_party_is_stored_and_still_not_counted(self):
        child = HouseholdDependent.objects.create(
            parent=self.guest, name="Kid", relationship="child", birth_month=3, birth_year=2018
        )
        spouse = HouseholdDependent.objects.create(
            parent=self.guest, name="Spouse", relationship="spouse"
        )
        response = self.rsvp(
            self.guest,
            {"include_self": False, "dependent_ids": [child.id], "member_ids": [spouse.id]},
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["status"], "pending")
        self.assertEqual(sorted(response.data["member_ids"]), sorted([child.id, spouse.id]))
        self.assertEqual(response.data["people_count"], 2)
        self.assertEqual(response.data["going_count"], 0)
        participant = self.participant(self.guest)
        self.assertFalse(participant.include_self)
        self.assertEqual(participant.dependents.count(), 2)

    def test_no_capacity_check_at_request_time(self):
        Activity.objects.filter(pk=self.activity.pk).update(capacity=1)
        self.request_from(self.other, "confirmed")
        response = self.rsvp(self.guest)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["status"], "pending")

    def test_ineligible_people_are_still_rejected(self):
        Activity.objects.filter(pk=self.activity.pk).update(audience_gender="women")
        response = self.rsvp(self.guest)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(ActivityParticipant.objects.filter(user=self.guest).exists())

    def test_pending_people_do_not_count_anywhere(self):
        self.request_from(self.other, "confirmed")
        self.rsvp(self.guest, {"include_self": True})
        self.client.force_authenticate(self.host)
        data = self.client.get(reverse("activity-detail", args=[self.activity.id])).data
        self.assertEqual(data["going_count"], 1)
        self.assertEqual(data["participant_count"], 1)
        spots = self.listing(self.host).data["spots_left"]
        self.assertEqual(spots, self.activity.capacity - 1)
        attendees = self.client.get(reverse("activity-attendees", args=[self.activity.id]))
        self.assertEqual(attendees.data["going_count"], 1)
        self.assertEqual(len(attendees.data["households"]), 1)
        self.assertNotIn("Guest", str(attendees.data))
        Activity.objects.filter(pk=self.activity.pk).update(
            time=timezone.now() + timedelta(minutes=30)
        )
        self.assertEqual(notify_upcoming_activities()["participants"], 1)

    def test_pending_user_gets_no_going_privileges(self):
        self.rsvp(self.guest)
        # Address stays hidden.
        data = self.detail(self.guest).data
        self.assertIsNone(data["location"])
        self.assertIsNone(data["latitude"])
        self.assertEqual(data["my_request_status"], "pending")
        # No chat.
        chat = reverse("activity-chat", args=[self.activity.id])
        self.assertEqual(self.client.get(chat).status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(
            self.client.post(chat, {"message": "hi"}, format="json").status_code,
            status.HTTP_403_FORBIDDEN,
        )
        # No attendee list, even once the event has started.
        Activity.objects.filter(pk=self.activity.pk).update(
            time=timezone.now() - timedelta(hours=1)
        )
        attendees = self.client.get(reverse("activity-attendees", args=[self.activity.id]))
        self.assertEqual(attendees.status_code, status.HTTP_403_FORBIDDEN)
        # Not in "going", but listed on request.
        going = reverse("going-activities")
        self.assertEqual(self._ids(self.client.get(going)), [])
        self.assertEqual(
            self._ids(self.client.get(going, {"include_pending": "true"})), [self.activity.id]
        )

    @staticmethod
    def _ids(response):
        data = response.data
        rows = data["results"] if isinstance(data, dict) and "results" in data else data
        return [row["id"] for row in rows]

    def test_re_rsvp_is_idempotent_and_updates_the_party(self):
        child = HouseholdDependent.objects.create(
            parent=self.guest, name="Kid", relationship="child", birth_month=3, birth_year=2018
        )
        first = self.rsvp_and_commit(self.guest)
        joined_at = self.participant(self.guest).joined_at
        with patch(PUSH) as push:
            second = self.rsvp_and_commit(
                self.guest, {"include_self": True, "dependent_ids": [child.id]}
            )
        self.assertEqual(first.status_code, status.HTTP_200_OK)
        self.assertEqual(second.status_code, status.HTTP_200_OK)
        self.assertEqual(second.data["status"], "pending")
        self.assertEqual(second.data["people_count"], 2)
        self.assertEqual(ActivityParticipant.objects.filter(user=self.guest).count(), 1)
        self.assertEqual(self.participant(self.guest).joined_at, joined_at)
        push.assert_not_called()

    def test_declined_cannot_re_request_by_default(self):
        self.request_from(self.guest, "declined")
        response = self.rsvp(self.guest)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["detail"], "The host declined your request.")
        self.assertEqual(self.participant(self.guest).status, "declined")

    def test_declined_cannot_dodge_the_block_by_withdrawing(self):
        self.request_from(self.guest, "declined")
        self.client.force_authenticate(self.guest)
        for method in (self.client.delete, self.client.post):
            response = method(self.cancel_url)
            self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        leave = self.client.post(reverse("leave-activity", args=[self.activity.id]))
        self.assertEqual(leave.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(self.participant(self.guest).status, "declined")

    def test_declined_can_re_request_when_allowed(self):
        Activity.objects.filter(pk=self.activity.pk).update(allow_rerequest=True)
        declined = self.request_from(self.guest, "declined", decided_at=timezone.now())
        with patch(PUSH) as push:
            response = self.rsvp_and_commit(self.guest)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["status"], "pending")
        declined.refresh_from_db()
        self.assertEqual(declined.status, "pending")
        self.assertIsNone(declined.decided_at)
        # A fresh request tells the host again.
        self.assertEqual(push.call_count, 1)
        self.assertEqual(push.call_args.args[0], self.host)

    def test_withdraw_pending_request_via_delete_and_post(self):
        from swipes.models import Swipe

        for method_name in ("delete", "post"):
            Swipe.objects.create(user=self.guest, activity=self.activity, direction="right")
            self.rsvp(self.guest)
            response = getattr(self.client, method_name)(self.cancel_url)
            self.assertEqual(response.status_code, status.HTTP_200_OK)
            self.assertEqual(response.data["going_count"], 0)
            self.assertFalse(ActivityParticipant.objects.filter(user=self.guest).exists())
            self.assertFalse(Swipe.objects.filter(user=self.guest, activity=self.activity).exists())
        self.assertEqual(self.listing(self.host).data["pending_count"], 0)

    def test_withdraw_works_even_after_the_host_cancelled(self):
        self.rsvp(self.guest)
        self.client.force_authenticate(self.host)
        self.client.post(
            reverse("activity-cancel-event", args=[self.activity.id]), {}, format="json"
        )
        self.client.force_authenticate(self.guest)
        self.assertEqual(self.client.delete(self.cancel_url).status_code, status.HTTP_200_OK)

    def test_new_request_on_a_cancelled_event_is_rejected(self):
        Activity.objects.filter(pk=self.activity.pk).update(is_cancelled=True)
        self.assertEqual(self.rsvp(self.guest).status_code, status.HTTP_400_BAD_REQUEST)

    def test_host_rsvp_to_own_event_is_still_instant(self):
        response = self.rsvp(self.host)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["status"], "confirmed")
        self.assertEqual(response.data["going_count"], 1)

    def test_already_confirmed_guest_keeps_existing_behaviour(self):
        self.request_from(self.guest, "confirmed")
        child = HouseholdDependent.objects.create(
            parent=self.guest, name="Kid", relationship="child", birth_month=3, birth_year=2018
        )
        response = self.rsvp(self.guest, {"include_self": True, "dependent_ids": [child.id]})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["status"], "confirmed")
        self.assertEqual(response.data["going_count"], 2)

    def test_blocked_either_way_with_host_cannot_request(self):
        BlockedUser.objects.create(blocker=self.host, blocked=self.guest)
        BlockedUser.objects.create(blocker=self.other, blocked=self.host)
        for user in (self.guest, self.other):
            response = self.rsvp(user)
            self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertFalse(ActivityParticipant.objects.filter(activity=self.activity).exists())

    def test_regular_event_still_confirms_instantly(self):
        plain = _activity(self.host, title="Open house")
        response = self.rsvp(self.guest, activity=plain)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["status"], "confirmed")
        self.assertEqual(response.data["going_count"], 1)
        self.assertEqual(response.data["my_request_status"], "approved")

    def test_regular_event_still_enforces_capacity_and_ignores_decline_rules(self):
        plain = _activity(self.host, capacity=1)
        self.request_from(self.other, "confirmed", activity=plain)
        self.assertEqual(
            self.rsvp(self.guest, activity=plain).status_code, status.HTTP_400_BAD_REQUEST
        )
        self.request_from(self.guest, "declined", activity=_activity(self.host))
        # allow_rerequest is irrelevant when approval is off: the old flip-to-confirmed stays.
        other_plain = _activity(self.host)
        declined = self.request_from(self.guest, "declined", activity=other_plain)
        self.assertEqual(self.rsvp(self.guest, activity=other_plain).data["status"], "confirmed")
        declined.refresh_from_db()
        self.assertEqual(declined.status, "confirmed")

    def test_open_listing_ignores_a_leftover_flag(self):
        church = _activity(self.host, host_kind="church", requires_approval=True)
        response = self.rsvp(self.guest, activity=church)
        self.assertEqual(response.data["status"], "confirmed")

    def test_requires_login(self):
        self.client.force_authenticate(None)
        self.assertEqual(self.client.post(self.rsvp_url, {}, format="json").status_code, 401)


class PayloadTests(ApprovalBase):
    def test_my_request_status_values(self):
        self.assertEqual(self.detail(self.guest).data["my_request_status"], "none")
        self.request_from(self.guest)
        self.assertEqual(self.detail(self.guest).data["my_request_status"], "pending")
        ActivityParticipant.objects.filter(user=self.guest).update(status="confirmed")
        self.assertEqual(self.detail(self.guest).data["my_request_status"], "approved")
        ActivityParticipant.objects.filter(user=self.guest).update(status="declined")
        self.assertEqual(self.detail(self.guest).data["my_request_status"], "declined")
        self.assertEqual(self.detail(self.other).data["my_request_status"], "none")

    def test_everyone_sees_the_flags_but_only_host_and_staff_see_pending_count(self):
        self.request_from(self.guest)
        self.request_from(self.other)
        for user in (self.host, self.staff):
            data = self.detail(user).data
            self.assertEqual(data["pending_count"], 2)
            self.assertTrue(data["requires_approval"])
            self.assertFalse(data["allow_rerequest"])
        for user in (self.guest, self.other):
            data = self.detail(user).data
            self.assertNotIn("pending_count", data)
            self.assertTrue(data["requires_approval"])
            self.assertFalse(data["allow_rerequest"])

    def test_going_view_default_excludes_pending_and_my_rsvp_shows_status(self):
        self.request_from(self.guest)
        self.client.force_authenticate(self.guest)
        self.assertEqual(RsvpRequestTests._ids(self.client.get(reverse("going-activities"))), [])
        data = self.detail(self.guest).data
        self.assertEqual(data["my_rsvp"]["status"], "pending")


class RequestListTests(ApprovalBase):
    def test_permissions(self):
        self.client.force_authenticate(None)
        self.assertEqual(
            self.client.get(self.requests_url).status_code, status.HTTP_401_UNAUTHORIZED
        )
        for user in (self.guest, self.other):
            self.assertEqual(self.listing(user).status_code, status.HTTP_403_FORBIDDEN)
        for user in (self.host, self.staff):
            self.assertEqual(self.listing(user).status_code, status.HTTP_200_OK)

    def test_hidden_or_missing_activity_is_404(self):
        hidden = _activity(self.host, is_approved=False, requires_approval=True)
        self.assertEqual(
            self.listing(self.guest, activity=hidden).status_code, status.HTTP_404_NOT_FOUND
        )
        self.client.force_authenticate(self.host)
        self.assertEqual(
            self.client.get(reverse("activity-requests", args=[999999])).status_code, 404
        )

    @override_settings(FOYER_CHURCH_ADMIN_EMAILS=[CHURCH_ADMIN_EMAIL])
    def test_church_admin_sees_church_event_requests_only(self):
        admin = _user("admin")
        church = _activity(self.host, host_kind="church")
        self.assertEqual(self.listing(admin, activity=church).status_code, status.HTTP_200_OK)
        self.assertEqual(self.listing(admin).status_code, status.HTTP_403_FORBIDDEN)

    def test_response_shape_and_card(self):
        church = Church.objects.create(name="Plains Church")
        user = _user(
            "guest2",
            bio="Loves board games.",
            avatar_url="https://example.com/a.png",
            profile_visibility="only_me",
            phone="+12155550123",
            show_email=False,
            church=church,
        )
        child = HouseholdDependent.objects.create(
            parent=user,
            name="Little Lastname",
            relationship="child",
            birth_month=1,
            birth_year=2020,
        )
        spouse = HouseholdDependent.objects.create(
            parent=user, name="Spouse Lastname", relationship="spouse"
        )
        participant = self.request_from(user, include_self=True)
        participant.dependents.set([child, spouse])
        response = self.listing(self.host)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(set(response.data), {"pending_count", "spots_left", "requests"})
        self.assertEqual(response.data["pending_count"], 1)
        self.assertEqual(response.data["spots_left"], 10)
        item = response.data["requests"][0]
        self.assertEqual(item["id"], participant.id)
        self.assertEqual(item["user_id"], user.id)
        self.assertEqual(item["status"], "pending")
        self.assertTrue(item["requested_at"])
        self.assertEqual(item["party"]["size"], 3)
        self.assertTrue(item["party"]["include_self"])
        members = {m["name"]: m for m in item["party"]["members"]}
        self.assertEqual(set(members["Little Lastname"]), {"name", "relationship", "age_band"})
        self.assertEqual(members["Little Lastname"]["age_band"], "under 13")
        self.assertEqual(members["Spouse Lastname"]["relationship"], "spouse")
        self.assertEqual(members["Spouse Lastname"]["age_band"], "adult")
        # The card ignores the requester's profile visibility.
        self.assertEqual(item["card"]["first_name"], "Guest2")
        self.assertEqual(item["card"]["avatar_url"], "https://example.com/a.png")
        self.assertEqual(item["card"]["bio"], "Loves board games.")
        self.assertEqual(item["card"]["church_name"], "Plains Church")
        body = str(response.data)
        for secret in ("example.com/guest2", "guest2@", "+12155550123", "12155550123", "Lastname,"):
            self.assertNotIn(secret, body)
        self.assertNotIn("last_name", body)
        self.assertNotIn("email", body)
        self.assertNotIn("phone", body)
        self.assertNotIn("'Lastname'", body)

    def test_minor_card_is_trimmed(self):
        teen = _user(
            "teen",
            date_of_birth=_safe_birthdate(15),
            bio="Teen bio",
            avatar_url="https://example.com/teen.png",
        )
        self.request_from(teen)
        card = self.listing(self.host).data["requests"][0]["card"]
        self.assertEqual(card["first_name"], "Teen")
        self.assertEqual(card["age_band"], "13-17")
        self.assertIsNone(card["avatar_url"])
        self.assertIsNone(card["bio"])
        self.assertNotIn("church_name", card)
        self.assertNotIn("Teen bio", str(card))

    def test_status_filters_and_validation(self):
        pending = self.request_from(self.guest)
        approved = self.request_from(self.other, "confirmed")
        declined = self.request_from(_user("third"), "declined")
        self.request_from(self.host, "confirmed")
        for query, expected in (
            ("", [pending.id]),
            ("?status=pending", [pending.id]),
            ("?status=approved", [approved.id]),
            ("?status=declined", [declined.id]),
        ):
            data = self.listing(self.host, query).data
            self.assertEqual([r["id"] for r in data["requests"]], expected, query)
            self.assertEqual(data["pending_count"], 1)
        self.assertEqual(
            self.listing(self.host, "?status=approved").data["requests"][0]["status"], "approved"
        )
        self.assertEqual(
            self.listing(self.host, "?status=bogus").status_code, status.HTTP_400_BAD_REQUEST
        )

    def test_oldest_first(self):
        first = self.request_from(self.guest)
        second = self.request_from(self.other)
        ActivityParticipant.objects.filter(pk=first.pk).update(
            joined_at=timezone.now() - timedelta(hours=2)
        )
        ActivityParticipant.objects.filter(pk=second.pk).update(
            joined_at=timezone.now() - timedelta(hours=3)
        )
        ids = [r["id"] for r in self.listing(self.host).data["requests"]]
        self.assertEqual(ids, [second.id, first.id])

    def test_blocked_requesters_are_excluded_either_way(self):
        blocked_by_host = _user("blockedbyhost")
        blocked_host = _user("blockedhost")
        visible = self.request_from(self.guest)
        self.request_from(blocked_by_host)
        self.request_from(blocked_host)
        BlockedUser.objects.create(blocker=self.host, blocked=blocked_by_host)
        BlockedUser.objects.create(blocker=blocked_host, blocked=self.host)
        data = self.listing(self.host).data
        self.assertEqual([r["id"] for r in data["requests"]], [visible.id])
        self.assertEqual(data["pending_count"], 1)

    def test_spots_left_counts_people_and_is_null_without_capacity(self):
        confirmed = self.request_from(self.other, "confirmed")
        spouse = HouseholdDependent.objects.create(
            parent=self.other, name="Spouse", relationship="spouse"
        )
        confirmed.dependents.add(spouse)
        self.assertEqual(self.listing(self.host).data["spots_left"], 10 - 2)
        Activity.objects.filter(pk=self.activity.pk).update(capacity=None)
        self.assertIsNone(self.listing(self.host).data["spots_left"])

    def test_listing_still_works_for_cancelled_and_started_events(self):
        self.request_from(self.guest)
        Activity.objects.filter(pk=self.activity.pk).update(
            is_cancelled=True, time=timezone.now() - timedelta(hours=1)
        )
        response = self.listing(self.host)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data["requests"]), 1)


class ApproveTests(ApprovalBase):
    def setUp(self):
        super().setUp()
        self.request_from(self.guest)
        self.pid = self.participant(self.guest).id

    def test_approve_confirms_and_returns_shape(self):
        response = self.decide(self.host, "approve", self.pid)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(set(response.data), {"request", "going_count", "spots_left"})
        self.assertEqual(response.data["request"]["status"], "approved")
        self.assertEqual(response.data["request"]["id"], self.pid)
        self.assertEqual(response.data["going_count"], 1)
        self.assertEqual(response.data["spots_left"], 9)
        participant = self.participant(self.guest)
        self.assertEqual(participant.status, "confirmed")
        self.assertIsNotNone(participant.decided_at)
        # The guest now has the going privileges.
        self.assertEqual(self.detail(self.guest).data["location"], self.activity.location)
        self.assertEqual(self.detail(self.guest).data["my_request_status"], "approved")
        self.assertEqual(
            self.client.get(reverse("activity-chat", args=[self.activity.id])).status_code, 200
        )

    def test_permissions(self):
        self.client.force_authenticate(None)
        url = reverse("activity-request-approve", args=[self.activity.id, self.pid])
        self.assertEqual(self.client.post(url).status_code, status.HTTP_401_UNAUTHORIZED)
        for user in (self.guest, self.other):
            response = self.decide(user, "approve", self.pid)
            self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(self.participant(self.guest).status, "pending")
        self.assertEqual(
            self.decide(self.staff, "approve", self.pid).status_code, status.HTTP_200_OK
        )

    def test_unknown_or_foreign_request_is_404(self):
        self.assertEqual(
            self.decide(self.host, "approve", 999999).status_code, status.HTTP_404_NOT_FOUND
        )
        other_event = _activity(self.host, requires_approval=True)
        foreign = self.request_from(self.other, activity=other_event)
        self.assertEqual(
            self.decide(self.host, "approve", foreign.id).status_code, status.HTTP_404_NOT_FOUND
        )
        self.assertEqual(
            self.decide(self.host, "approve", foreign.id, activity=other_event).status_code, 200
        )

    def test_blocked_requester_cannot_be_decided(self):
        BlockedUser.objects.create(blocker=self.guest, blocked=self.host)
        self.assertEqual(
            self.decide(self.host, "approve", self.pid).status_code, status.HTTP_404_NOT_FOUND
        )
        self.assertEqual(self.participant(self.guest).status, "pending")

    def test_party_that_fits_exactly_is_approved(self):
        Activity.objects.filter(pk=self.activity.pk).update(capacity=3)
        self.request_from(self.other, "confirmed")
        spouse = HouseholdDependent.objects.create(
            parent=self.guest, name="Spouse", relationship="spouse"
        )
        self.participant(self.guest).dependents.add(spouse)
        response = self.decide(self.host, "approve", self.pid)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["going_count"], 3)
        self.assertEqual(response.data["spots_left"], 0)

    def test_overfull_party_with_dependents_and_members_gets_409(self):
        Activity.objects.filter(pk=self.activity.pk).update(capacity=3)
        self.request_from(self.other, "confirmed")
        participant = self.participant(self.guest)
        child = HouseholdDependent.objects.create(
            parent=self.guest, name="Kid", relationship="child", birth_month=3, birth_year=2018
        )
        spouse = HouseholdDependent.objects.create(
            parent=self.guest, name="Spouse", relationship="spouse"
        )
        participant.dependents.set([child, spouse])  # self + 2 = 3 people, only 2 spots left
        response = self.decide(self.host, "approve", self.pid)
        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)
        self.assertEqual(response.data, {"detail": "Not enough spots for this party."})
        participant.refresh_from_db()
        self.assertEqual(participant.status, "pending")
        self.assertIsNone(participant.decided_at)

    def test_unlimited_capacity_always_fits(self):
        Activity.objects.filter(pk=self.activity.pk).update(capacity=None)
        response = self.decide(self.host, "approve", self.pid)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIsNone(response.data["spots_left"])

    def test_two_requests_for_the_last_spot_second_one_loses(self):
        Activity.objects.filter(pk=self.activity.pk).update(capacity=1)
        second = self.request_from(self.other)
        self.assertEqual(self.decide(self.host, "approve", self.pid).status_code, 200)
        self.assertEqual(
            self.decide(self.host, "approve", second.id).status_code, status.HTTP_409_CONFLICT
        )
        self.assertEqual(self.listing(self.host).data["spots_left"], 0)

    def test_approve_locks_the_gathering_row(self):
        self.client.force_authenticate(self.host)
        url = reverse("activity-request-approve", args=[self.activity.id, self.pid])
        with CaptureQueriesContext(connection) as queries:
            self.client.post(url)
        locking = [q["sql"] for q in queries if "FOR UPDATE" in q["sql"]]
        self.assertTrue(any("activities_activity" in sql for sql in locking))

    def test_idempotent_and_no_second_push(self):
        with patch(PUSH) as push:
            self.decide(self.host, "approve", self.pid)
            decided_at = self.participant(self.guest).decided_at
            again = self.decide(self.host, "approve", self.pid)
        self.assertEqual(again.status_code, status.HTTP_200_OK)
        self.assertEqual(again.data["request"]["status"], "approved")
        self.assertEqual(again.data["going_count"], 1)
        self.assertEqual(self.participant(self.guest).decided_at, decided_at)
        self.assertEqual(push.call_count, 1)

    def test_host_can_approve_a_declined_request_they_reconsider(self):
        self.decide(self.host, "decline", self.pid)
        response = self.decide(self.host, "approve", self.pid)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(self.participant(self.guest).status, "confirmed")

    def test_cancelled_or_started_event_rejects_decisions(self):
        Activity.objects.filter(pk=self.activity.pk).update(is_cancelled=True)
        for verb in ("approve", "decline"):
            response = self.decide(self.host, verb, self.pid)
            self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
            self.assertIn("cancelled", response.data["detail"])
        Activity.objects.filter(pk=self.activity.pk).update(
            is_cancelled=False, time=timezone.now() - timedelta(hours=1)
        )
        for verb in ("approve", "decline"):
            response = self.decide(self.host, verb, self.pid)
            self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
            self.assertIn("already started", response.data["detail"])
        Activity.objects.filter(pk=self.activity.pk).update(
            time=timezone.now() - timedelta(hours=3), end_time=timezone.now() - timedelta(hours=1)
        )
        self.assertEqual(
            self.decide(self.host, "approve", self.pid).status_code, status.HTTP_400_BAD_REQUEST
        )
        self.assertEqual(self.participant(self.guest).status, "pending")

    def test_approving_pushes_the_requester(self):
        with patch(PUSH) as push:
            self.decide(self.host, "approve", self.pid)
        self.assertEqual(push.call_count, 1)
        recipient, title, body, data = push.call_args.args
        self.assertEqual(recipient, self.guest)
        self.assertEqual(title, "Your request to join Supper Club was approved")
        self.assertEqual(body, "Your request to join Supper Club was approved.")
        self.assertEqual(data["type"], "join_request_approved")
        self.assertEqual(data["activityId"], self.activity.id)

    def test_no_push_until_commit(self):
        with patch(PUSH) as push:
            self.decide(self.host, "approve", self.pid, commit=False)
        self.assertEqual(push.call_count, 0)


class DeclineTests(ApprovalBase):
    def setUp(self):
        super().setUp()
        self.request_from(self.guest)
        self.pid = self.participant(self.guest).id

    def test_decline_without_reason(self):
        with patch(PUSH) as push:
            response = self.decide(self.host, "decline", self.pid)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["request"]["status"], "declined")
        self.assertEqual(response.data["going_count"], 0)
        self.assertIsNotNone(self.participant(self.guest).decided_at)
        recipient, title, body, data = push.call_args.args
        self.assertEqual(recipient, self.guest)
        self.assertEqual(title, "Your request to join Supper Club was declined")
        self.assertNotIn("Reason", body)
        self.assertEqual(data["type"], "join_request_declined")

    def test_decline_with_reason_includes_it_in_the_push(self):
        with patch(PUSH) as push:
            response = self.decide(self.host, "decline", self.pid, {"reason": "  Table is full "})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("Reason: Table is full", push.call_args.args[2])

    def test_reason_validation(self):
        too_long = self.decide(self.host, "decline", self.pid, {"reason": "x" * 281})
        self.assertEqual(too_long.status_code, status.HTTP_400_BAD_REQUEST)
        not_text = self.decide(self.host, "decline", self.pid, {"reason": 5})
        self.assertEqual(not_text.status_code, status.HTTP_400_BAD_REQUEST)
        exact = self.decide(self.host, "decline", self.pid, {"reason": "x" * 280})
        self.assertEqual(exact.status_code, status.HTTP_200_OK)

    def test_idempotent_and_no_second_push(self):
        with patch(PUSH) as push:
            self.decide(self.host, "decline", self.pid, {"reason": "Sorry"})
            again = self.decide(self.host, "decline", self.pid, {"reason": "Different"})
        self.assertEqual(again.status_code, status.HTTP_200_OK)
        self.assertEqual(again.data["request"]["status"], "declined")
        self.assertEqual(push.call_count, 1)

    def test_permissions(self):
        for user in (self.guest, self.other):
            self.assertEqual(
                self.decide(user, "decline", self.pid).status_code, status.HTTP_403_FORBIDDEN
            )
        self.client.force_authenticate(None)
        url = reverse("activity-request-decline", args=[self.activity.id, self.pid])
        self.assertEqual(self.client.post(url).status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(self.participant(self.guest).status, "pending")

    def test_confirmed_guest_cannot_be_declined(self):
        ActivityParticipant.objects.filter(pk=self.pid).update(status="confirmed")
        response = self.decide(self.host, "decline", self.pid)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(self.participant(self.guest).status, "confirmed")

    def test_declined_requester_loses_nothing_but_is_listed_as_declined(self):
        self.decide(self.host, "decline", self.pid)
        data = self.listing(self.host, "?status=declined").data
        self.assertEqual([r["id"] for r in data["requests"]], [self.pid])
        self.assertEqual(data["pending_count"], 0)
        self.assertEqual(self.detail(self.guest).data["my_request_status"], "declined")


class PushFanOutTests(ApprovalBase):
    def test_host_is_told_once_about_a_new_request(self):
        with patch(PUSH) as push:
            self.rsvp_and_commit(self.guest)
            self.rsvp_and_commit(self.guest)
            self.rsvp_and_commit(self.guest, {"include_self": True})
        self.assertEqual(push.call_count, 1)
        recipient, title, body, data = push.call_args.args
        self.assertEqual(recipient, self.host)
        self.assertEqual(title, "New request to join Supper Club")
        self.assertIn("Guest", body)
        self.assertNotIn("Lastname", body)
        self.assertEqual(data["type"], "join_request")
        self.assertEqual(data["activityId"], self.activity.id)
        self.assertEqual(data["userId"], self.guest.id)

    def test_each_new_requester_notifies_the_host(self):
        with patch(PUSH) as push:
            self.rsvp_and_commit(self.guest)
            self.rsvp_and_commit(self.other)
        self.assertEqual([call.args[0] for call in push.call_args_list], [self.host, self.host])

    def test_nothing_is_sent_until_commit(self):
        with patch(PUSH) as push:
            self.rsvp(self.guest)
        self.assertEqual(push.call_count, 0)

    def test_host_rsvp_and_regular_events_send_no_request_push(self):
        plain = _activity(self.host, title="Open house")
        with patch(PUSH) as push:
            self.rsvp_and_commit(self.host)
            self.rsvp_and_commit(self.guest, activity=plain)
        self.assertEqual(push.call_count, 0)

    def test_rejected_requests_send_nothing(self):
        self.request_from(self.guest, "declined")
        with patch(PUSH) as push:
            self.rsvp_and_commit(self.guest)
        self.assertEqual(push.call_count, 0)

    def test_real_push_helper_delivers_to_the_host_device(self):
        from users.models import PushDeviceToken

        PushDeviceToken.objects.create(user=self.host, token="ExponentPushToken[host]")
        with patch("users.push_notifications.requests.post") as post:
            post.return_value.ok = True
            post.return_value.json.return_value = {"data": [{"status": "ok"}]}
            self.rsvp_and_commit(self.guest)
        self.assertEqual(post.call_count, 1)
        self.assertEqual(
            post.call_args.kwargs["json"][0]["title"], "New request to join Supper Club"
        )

    def test_cancel_event_notifies_pending_but_not_declined_or_host(self):
        pending = self.request_from(self.guest).user
        self.request_from(self.other, "declined")
        approved = _user("approved")
        self.request_from(approved, "confirmed")
        self.client.force_authenticate(self.host)
        with patch(PUSH) as push, self.captureOnCommitCallbacks(execute=True):
            response = self.client.post(
                reverse("activity-cancel-event", args=[self.activity.id]),
                {"reason": "Rain"},
                format="json",
            )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        recipients = {call.args[0].id for call in push.call_args_list}
        self.assertEqual(recipients, {pending.id, approved.id})
        self.assertEqual(push.call_count, 2)
        for call in push.call_args_list:
            self.assertEqual(call.args[1], "Supper Club was cancelled")
            self.assertIn("Reason: Rain", call.args[2])
            self.assertEqual(call.args[3]["type"], "activity_cancelled")


class DeclineReasonTests(ApprovalBase):
    def setUp(self):
        super().setUp()
        self.request_from(self.guest)
        self.pid = self.participant(self.guest).id

    def decline(self, body=None):
        return self.decide(self.host, "decline", self.pid, body)

    def test_reason_is_stored_trimmed_and_blank_when_missing(self):
        self.decline({"reason": "   Table is full  "})
        self.assertEqual(self.participant(self.guest).decline_reason, "Table is full")
        other = self.request_from(self.other)
        self.decide(self.host, "decline", other.id)
        other.refresh_from_db()
        self.assertEqual(other.decline_reason, "")
        self.decide(self.host, "decline", self.request_from(_user("third")).id, {"reason": "   "})
        self.assertEqual(ActivityParticipant.objects.get(user__username="third").decline_reason, "")

    def test_cap_of_280_is_still_enforced_and_nothing_is_stored(self):
        self.assertEqual(self.decline({"reason": "x" * 281}).status_code, 400)
        self.assertEqual(self.participant(self.guest).decline_reason, "")
        self.assertEqual(self.participant(self.guest).status, "pending")
        self.assertEqual(self.decline({"reason": "x" * 280}).status_code, 200)
        self.assertEqual(len(self.participant(self.guest).decline_reason), 280)

    def test_only_the_declined_requester_sees_my_request_reason(self):
        self.decline({"reason": "Sorry, family only"})
        data = self.detail(self.guest).data
        self.assertEqual(data["my_request_status"], "declined")
        self.assertEqual(data["my_request_reason"], "Sorry, family only")
        for user in (self.other, self.host, self.staff):
            data = self.detail(user).data
            self.assertIsNone(data["my_request_reason"])
            self.assertNotIn("family only", str(data))
        self.client.force_authenticate(None)
        anon = self.client.get(reverse("activity-detail", args=[self.activity.id]))
        self.assertNotEqual(anon.status_code, status.HTTP_200_OK)

    def test_reason_is_null_without_one_and_for_pending_and_approved(self):
        self.assertIsNone(self.detail(self.guest).data["my_request_reason"])  # pending
        self.assertIsNone(self.detail(self.other).data["my_request_reason"])  # none
        self.decline()
        data = self.detail(self.guest).data
        self.assertEqual(data["my_request_status"], "declined")
        self.assertIsNone(data["my_request_reason"])  # declined, no note
        # A stale note never leaks once the request is no longer declined.
        ActivityParticipant.objects.filter(pk=self.pid).update(
            status="confirmed", decline_reason="stale"
        )
        self.assertIsNone(self.detail(self.guest).data["my_request_reason"])

    def test_host_list_includes_decline_reason_for_their_own_view(self):
        self.decline({"reason": "Not this time"})
        item = self.listing(self.host, "?status=declined").data["requests"][0]
        self.assertEqual(item["decline_reason"], "Not this time")
        pending = self.request_from(self.other)
        items = {r["id"]: r for r in self.listing(self.host).data["requests"]}
        self.assertIsNone(items[pending.id]["decline_reason"])
        response = self.decide(self.host, "decline", pending.id)
        self.assertIsNone(response.data["request"]["decline_reason"])
        again = self.decline({"reason": "Different"})
        self.assertEqual(again.data["request"]["decline_reason"], "Not this time")

    def test_reason_cleared_on_re_request(self):
        Activity.objects.filter(pk=self.activity.pk).update(allow_rerequest=True)
        self.decline({"reason": "Full"})
        response = self.rsvp(self.guest)
        self.assertEqual(response.data["status"], "pending")
        self.assertIsNone(response.data["my_request_reason"])
        self.assertEqual(self.participant(self.guest).decline_reason, "")
        self.assertIsNone(self.detail(self.guest).data["my_request_reason"])

    def test_reason_cleared_when_host_later_approves(self):
        self.decline({"reason": "Full"})
        self.decide(self.host, "approve", self.pid)
        self.assertEqual(self.participant(self.guest).decline_reason, "")
        self.assertIsNone(self.detail(self.guest).data["my_request_reason"])

    def test_rsvp_response_carries_my_request_reason(self):
        response = self.rsvp(self.other)
        self.assertIn("my_request_reason", response.data)
        self.assertIsNone(response.data["my_request_reason"])
