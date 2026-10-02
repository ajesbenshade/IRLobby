"""Full gatherings: the is_full flag, the deck, and who can still join."""

from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from activities.models import Activity, ActivityParticipant, HouseholdDependent
from activities.test_foyer import _activity, _safe_birthdate
from swipes.models import Swipe
from users.models import User

FULL = "This gathering is full."


def _user(name, **extra):
    extra.setdefault("date_of_birth", _safe_birthdate(40))
    return User.objects.create_user(
        username=name,
        email=f"{name}@example.com",
        password="Passw0rd-123",
        first_name=name,
        **extra,
    )


def _ids(response):
    data = response.data
    rows = data["results"] if isinstance(data, dict) and "results" in data else data
    return [row["id"] for row in rows]


class FullBase(APITestCase):
    def setUp(self):
        self.host = _user("host")
        self.confirmed = _user("confirmed")
        self.pending = _user("pending")
        self.declined = _user("declined")
        self.stranger = _user("stranger")
        self.staff = _user("staffer", is_staff=True)
        self.activity = _activity(self.host, title="Small Supper", capacity=2)
        self.row(self.confirmed, "confirmed", include_self=True)

    def row(self, user, status_value, activity=None, **extra):
        activity = activity or self.activity
        return ActivityParticipant.objects.update_or_create(
            activity=activity, user=user, defaults={"status": status_value, **extra}
        )[0]

    def fill(self, activity=None):
        """Confirmed people reach capacity: one account bringing a spouse."""
        activity = activity or self.activity
        row = self.row(self.confirmed, "confirmed", activity=activity, include_self=True)
        spouse = HouseholdDependent.objects.get_or_create(
            parent=self.confirmed, name="Spouse", relationship="spouse"
        )[0]
        row.dependents.set([spouse])

    def deck(self, user):
        self.client.force_authenticate(user)
        return _ids(self.client.get(reverse("activity-list")))

    def payload(self, user, activity=None):
        self.client.force_authenticate(user)
        return self.client.get(
            reverse("activity-detail", args=[(activity or self.activity).id])
        ).data

    def rsvp(self, user, body=None, activity=None):
        self.client.force_authenticate(user)
        url = reverse("activity-rsvp", args=[(activity or self.activity).id])
        return self.client.post(
            url, body if body is not None else {"include_self": True}, format="json"
        )


class IsFullFlagTests(FullBase):
    def test_not_full_until_confirmed_people_reach_capacity(self):
        self.assertFalse(self.payload(self.stranger)["is_full"])  # 1 of 2
        self.fill()
        self.assertTrue(self.payload(self.stranger)["is_full"])  # 2 of 2
        self.assertEqual(self.payload(self.stranger)["going_count"], 2)

    def test_over_capacity_is_still_full(self):
        self.fill()
        Activity.objects.filter(pk=self.activity.pk).update(capacity=1)
        self.assertTrue(self.payload(self.stranger)["is_full"])

    def test_no_capacity_is_never_full(self):
        for capacity in (None, 0):
            Activity.objects.filter(pk=self.activity.pk).update(capacity=capacity)
            self.fill()
            self.assertFalse(self.payload(self.stranger)["is_full"], capacity)

    def test_pending_requests_never_count(self):
        Activity.objects.filter(pk=self.activity.pk).update(requires_approval=True)
        self.row(self.pending, "pending", include_self=True)
        self.row(self.declined, "declined", include_self=True)
        self.assertFalse(self.payload(self.stranger)["is_full"])
        self.assertFalse(self.payload(self.host)["is_full"])

    def test_cancelled_event_is_full_by_the_same_rule(self):
        Activity.objects.filter(pk=self.activity.pk).update(is_cancelled=True)
        self.assertFalse(self.payload(self.stranger)["is_full"])
        self.fill()
        self.assertTrue(self.payload(self.stranger)["is_full"])

    def test_flag_is_in_the_list_payload_too(self):
        self.fill()
        self.client.force_authenticate(self.confirmed)
        rows = self.client.get(reverse("activity-list")).data
        rows = rows["results"] if isinstance(rows, dict) else rows
        self.assertTrue(rows[0]["is_full"])


class DeckExclusionTests(FullBase):
    def test_not_full_event_is_in_everyones_deck(self):
        for user in (self.stranger, self.host, self.staff):
            self.assertIn(self.activity.id, self.deck(user))

    def test_full_event_is_hidden_from_strangers_only(self):
        self.fill()
        self.assertNotIn(self.activity.id, self.deck(self.stranger))
        self.row(self.pending, "pending")
        self.row(self.declined, "declined")
        for user in (self.confirmed, self.pending, self.declined, self.host, self.staff):
            self.assertIn(self.activity.id, self.deck(user), user.username)

    def test_event_reappears_when_a_spot_frees_up(self):
        self.fill()
        self.assertNotIn(self.activity.id, self.deck(self.stranger))
        self.client.force_authenticate(self.confirmed)
        self.assertEqual(
            self.client.delete(
                reverse("activity-rsvp-cancel", args=[self.activity.id])
            ).status_code,
            status.HTTP_200_OK,
        )
        self.assertIn(self.activity.id, self.deck(self.stranger))

    def test_host_removal_reopens_the_event(self):
        self.fill()
        self.client.force_authenticate(self.host)
        self.client.delete(
            reverse("remove-activity-participant", args=[self.activity.id, self.confirmed.id])
        )
        self.assertIn(self.activity.id, self.deck(self.stranger))

    def test_pending_requests_do_not_hide_an_event(self):
        Activity.objects.filter(pk=self.activity.pk).update(requires_approval=True)
        for user in (self.pending, self.declined):
            self.row(user, "pending", include_self=True)
        self.assertIn(self.activity.id, self.deck(self.stranger))

    def test_members_count_toward_fullness_in_the_deck(self):
        Activity.objects.filter(pk=self.activity.pk).update(capacity=3)
        self.fill()  # 2 of 3
        self.assertIn(self.activity.id, self.deck(self.stranger))
        other = _user("other")
        self.row(other, "confirmed", include_self=True)  # 3 of 3
        self.assertNotIn(self.activity.id, self.deck(self.stranger))

    def test_other_events_are_untouched_and_no_cap_events_stay(self):
        self.fill()
        open_event = _activity(self.host, title="Open", capacity=None)
        roomy = _activity(self.host, title="Roomy", capacity=50)
        deck = self.deck(self.stranger)
        self.assertEqual(sorted(deck), sorted([open_event.id, roomy.id]))

    def test_deck_query_count_does_not_grow_with_events(self):
        from django.db import connection
        from django.test.utils import CaptureQueriesContext

        self.client.force_authenticate(self.stranger)
        with CaptureQueriesContext(connection) as small:
            self.client.get(reverse("activity-list"))
        for index in range(6):
            event = _activity(self.host, title=f"E{index}", capacity=2)
            self.fill(event)
        with CaptureQueriesContext(connection) as large:
            self.client.get(reverse("activity-list"))
        # Serializing six more full events costs a few queries each; the exclusion itself
        # is one subquery, and nothing here is visible to the stranger.
        self.assertLessEqual(len(large), len(small) + 1)

    def test_detail_by_link_still_works_for_everyone(self):
        self.fill()
        self.client.force_authenticate(self.stranger)
        response = self.client.get(reverse("activity-detail", args=[self.activity.id]))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data["is_full"])


class JoinFullTests(FullBase):
    def setUp(self):
        super().setUp()
        self.fill()

    def test_new_rsvp_is_rejected_with_the_full_message(self):
        response = self.rsvp(self.stranger)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["detail"], FULL)
        self.assertEqual(response.data["message"], "Activity is full")
        self.assertFalse(ActivityParticipant.objects.filter(user=self.stranger).exists())

    def test_legacy_join_is_rejected_with_the_full_message(self):
        self.client.force_authenticate(self.stranger)
        response = self.client.post(reverse("join-activity", args=[self.activity.id]))
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["detail"], FULL)
        self.assertEqual(response.data["message"], "Activity is full")

    def test_swipe_right_is_rejected_but_left_is_fine(self):
        self.client.force_authenticate(self.stranger)
        url = reverse("swipe-activity", args=[self.activity.id])
        right = self.client.post(url, {"direction": "right"}, format="json")
        self.assertEqual(right.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(right.data["detail"], FULL)
        self.assertFalse(Swipe.objects.filter(user=self.stranger).exists())
        listed = self.client.post(
            reverse("swipe-list"),
            {"activity": self.activity.id, "direction": "right"},
            format="json",
        )
        self.assertEqual(listed.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(listed.data["detail"], FULL)
        left = self.client.post(url, {"direction": "left"}, format="json")
        self.assertEqual(left.status_code, status.HTTP_201_CREATED)

    def test_participants_and_host_can_still_swipe_right(self):
        for index, user in enumerate((self.pending, self.host, self.staff)):
            if user is self.pending:
                self.row(self.pending, "pending")
            self.client.force_authenticate(user)
            response = self.client.post(
                reverse("swipe-activity", args=[self.activity.id]),
                {"direction": "right"},
                format="json",
            )
            self.assertEqual(response.status_code, status.HTTP_201_CREATED, user.username)

    def test_existing_confirmed_guest_re_rsvp_is_idempotent(self):
        response = self.rsvp(self.confirmed, {"include_self": True})
        # The party is unchanged by asking again: still self + spouse? Sending only self
        # shrinks it, which always fits.
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["status"], "confirmed")

    def test_existing_confirmed_guest_cannot_grow_a_full_party(self):
        child = HouseholdDependent.objects.create(
            parent=self.confirmed, name="Kid", relationship="child", birth_month=3, birth_year=2018
        )
        spouse = HouseholdDependent.objects.get(parent=self.confirmed, name="Spouse")
        response = self.rsvp(
            self.confirmed, {"include_self": True, "dependent_ids": [spouse.id, child.id]}
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_same_party_resubmitted_when_full_stays_200(self):
        spouse = HouseholdDependent.objects.get(parent=self.confirmed, name="Spouse")
        response = self.rsvp(self.confirmed, {"include_self": True, "dependent_ids": [spouse.id]})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["going_count"], 2)

    def test_party_too_big_for_a_not_full_event_keeps_the_party_message(self):
        roomy = _activity(self.host, title="Three seats", capacity=3)
        self.row(self.confirmed, "confirmed", activity=roomy, include_self=True)
        kid_a = HouseholdDependent.objects.create(
            parent=self.stranger, name="A", relationship="child", birth_month=3, birth_year=2018
        )
        kid_b = HouseholdDependent.objects.create(
            parent=self.stranger, name="B", relationship="child", birth_month=4, birth_year=2018
        )
        response = self.rsvp(
            self.stranger,
            {"include_self": True, "dependent_ids": [kid_a.id, kid_b.id]},
            activity=roomy,
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["detail"], "Not enough spots for this party.")
        self.assertEqual(response.data["message"], "Activity is full")
        # A party that fits is still accepted.
        ok = self.rsvp(self.stranger, {"include_self": True}, activity=roomy)
        self.assertEqual(ok.status_code, status.HTTP_200_OK)

    def test_event_reopens_for_new_people_after_a_cancel(self):
        self.client.force_authenticate(self.confirmed)
        self.client.delete(reverse("activity-rsvp-cancel", args=[self.activity.id]))
        self.assertEqual(self.rsvp(self.stranger).status_code, status.HTTP_200_OK)


class RequireApprovalFullTests(FullBase):
    def setUp(self):
        super().setUp()
        Activity.objects.filter(pk=self.activity.pk).update(requires_approval=True, capacity=2)
        self.activity.refresh_from_db()

    def test_full_by_approved_people_only(self):
        # Two pending requests do not make it full: a stranger can still ask.
        self.row(self.pending, "pending", include_self=True)
        self.row(self.declined, "pending", include_self=True)
        self.assertEqual(self.rsvp(self.stranger).data["status"], "pending")
        self.assertFalse(self.payload(self.host)["is_full"])

    def test_new_request_on_a_full_event_gets_the_full_error(self):
        self.fill()
        response = self.rsvp(self.stranger)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["detail"], FULL)
        self.assertFalse(ActivityParticipant.objects.filter(user=self.stranger).exists())
        self.assertNotIn(self.activity.id, self.deck(self.stranger))

    def test_existing_pending_request_can_still_be_edited_and_withdrawn(self):
        self.row(self.pending, "pending", include_self=True)
        self.fill()
        edit = self.rsvp(self.pending, {"include_self": True})
        self.assertEqual(edit.status_code, status.HTTP_200_OK)
        self.assertEqual(edit.data["status"], "pending")
        self.client.force_authenticate(self.pending)
        withdraw = self.client.delete(reverse("activity-rsvp-cancel", args=[self.activity.id]))
        self.assertEqual(withdraw.status_code, status.HTTP_200_OK)
        # Once withdrawn they are a stranger again.
        self.assertEqual(self.rsvp(self.pending).status_code, status.HTTP_400_BAD_REQUEST)

    def test_declined_re_request_on_a_full_event_gets_the_full_error(self):
        Activity.objects.filter(pk=self.activity.pk).update(allow_rerequest=True)
        self.row(self.declined, "declined")
        self.fill()
        response = self.rsvp(self.declined)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["detail"], FULL)
        self.assertEqual(ActivityParticipant.objects.get(user=self.declined).status, "declined")

    def test_declined_without_rerequest_still_gets_the_decline_error(self):
        self.row(self.declined, "declined")
        self.fill()
        response = self.rsvp(self.declined)
        self.assertEqual(response.data["detail"], "The host declined your request.")

    def test_approve_on_a_full_event_stays_409(self):
        request_row = self.row(self.pending, "pending", include_self=True)
        self.fill()
        self.client.force_authenticate(self.host)
        response = self.client.post(
            reverse("activity-request-approve", args=[self.activity.id, request_row.id])
        )
        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)
        self.assertEqual(response.data["detail"], "Not enough spots for this party.")

    def test_host_and_confirmed_guest_are_unaffected(self):
        self.fill()
        self.assertEqual(self.rsvp(self.host).status_code, status.HTTP_400_BAD_REQUEST)  # no spot
        spouse = HouseholdDependent.objects.get(parent=self.confirmed, name="Spouse")
        same = self.rsvp(self.confirmed, {"include_self": True, "dependent_ids": [spouse.id]})
        self.assertEqual(same.status_code, status.HTTP_200_OK)
        self.assertEqual(same.data["status"], "confirmed")


class PublicCalendarFullTests(FullBase):
    def test_full_church_events_stay_listed_with_the_flag(self):
        church_event = _activity(
            self.host,
            title="Harvest Supper",
            capacity=1,
            list_on_church_calendar=True,
            calendar_approved=True,
        )
        self.row(self.confirmed, "confirmed", activity=church_event, include_self=True)
        open_event = _activity(
            self.host,
            title="Open Supper",
            capacity=None,
            list_on_church_calendar=True,
            calendar_approved=True,
        )
        self.client.force_authenticate(None)
        response = self.client.get(reverse("public-calendar"))
        by_title = {event["title"]: event for event in response.data["events"]}
        self.assertTrue(by_title["Harvest Supper"]["is_full"])
        self.assertFalse(by_title["Open Supper"]["is_full"])
        ics = self.client.get(reverse("public-calendar-ics"))
        self.assertEqual(ics.status_code, status.HTTP_200_OK)
        self.assertIn("Harvest Supper", ics.content.decode())
        self.assertEqual(open_event.capacity, None)

    def test_full_church_event_is_still_in_the_deck_for_strangers_when_not_full_only(self):
        # Full church events leave the deck like any other full event; the calendar keeps them.
        church_event = _activity(
            self.host, capacity=1, list_on_church_calendar=True, calendar_approved=True
        )
        self.row(self.confirmed, "confirmed", activity=church_event, include_self=True)
        self.assertNotIn(church_event.id, self.deck(self.stranger))
        self.client.force_authenticate(None)
        titles = [e["title"] for e in self.client.get(reverse("public-calendar")).data["events"]]
        self.assertIn(church_event.title, titles)
