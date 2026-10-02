"""Household birth data, PATCH, show_birthday, GET /api/friends/birthdays/ and the daily push.

Rules under test: only adults can share their own birthday (month and day, never the
year); a child's birth date goes to the owning parent only and is used for age checks.
"""

from datetime import date, timedelta
from unittest.mock import patch

from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APITestCase

from activities.eligibility import ny_today
from activities.models import ActivityParticipant, Church, HouseholdDependent
from activities.test_foyer import _activity, _safe_birthdate
from moderation.models import BlockedUser
from users.models import Friendship, User
from users.tasks import send_birthday_notifications

PW = "Passw0rd-123"


def make(name, dob=None, **extra):
    return User.objects.create_user(
        username=name,
        email=f"{name}@example.com",
        password=PW,
        first_name=name.capitalize(),
        last_name="Lastname",
        date_of_birth=dob if dob is not None else _safe_birthdate(40),
        **extra,
    )


def befriend(a, b):
    return Friendship.objects.create(requester=a, recipient=b, status="accepted")


def years_ago(today, years, *, month=None, day=None):
    return date(today.year - years, month or today.month, day or today.day)


class HouseholdBirthPayloadTests(APITestCase):
    def setUp(self):
        self.parent = make("parent")
        self.client.force_authenticate(self.parent)
        self.today = ny_today()

    def test_month_only_child_has_no_fake_date_of_birth(self):
        year = self.today.year - 6
        resp = self.client.post(
            reverse("household"),
            {"name": "Kid", "birth_month": 2, "birth_year": year},
            format="json",
        )
        self.assertEqual(resp.status_code, 201, resp.data)
        for body in (
            resp.data,
            [m for m in resp.data["members"] if m["name"] == "Kid"][0],
            self.client.get(reverse("household")).data["children"][0],
            self.client.get(reverse("household")).data["members"][0],
        ):
            self.assertEqual(body["birth_month"], 2)
            self.assertEqual(body["birth_year"], year)
            self.assertIsNone(body["birth_day"])
            self.assertEqual(body["birth_precision"], "month")
            self.assertIsNone(body.get("date_of_birth"))
        member = self.client.get(reverse("household")).data["members"][0]
        self.assertNotIn("date_of_birth", member)
        # Never the last day of the month in storage either.
        self.assertIsNone(HouseholdDependent.objects.get().date_of_birth)

    def test_month_only_child_age_still_uses_last_day_of_month(self):
        last = date(self.today.year - 9, self.today.month, 1)
        # Born this month, 9 years ago: never looks older than 8 until the month is over.
        resp = self.client.post(
            reverse("household"),
            {"name": "Kid", "birth_month": last.month, "birth_year": last.year},
            format="json",
        )
        self.assertEqual(resp.status_code, 201)
        self.assertEqual(resp.data["age"], 8)

    def test_full_date_child_reports_day_precision(self):
        dob = years_ago(self.today, 7, month=3, day=4)
        resp = self.client.post(
            reverse("household"), {"name": "Kid", "date_of_birth": dob.isoformat()}, format="json"
        )
        self.assertEqual(resp.status_code, 201, resp.data)
        self.assertEqual(resp.data["date_of_birth"], dob.isoformat())
        self.assertEqual(
            (resp.data["birth_month"], resp.data["birth_day"], resp.data["birth_year"]),
            (3, 4, dob.year),
        )
        self.assertEqual(resp.data["birth_precision"], "day")
        member = self.client.get(reverse("household")).data["members"][0]
        self.assertEqual(member["date_of_birth"], dob.isoformat())
        self.assertEqual(member["birth_precision"], "day")

    def test_post_month_year_with_birth_day(self):
        year = self.today.year - 5
        resp = self.client.post(
            reverse("household"),
            {"name": "Kid", "birth_month": 6, "birth_year": year, "birth_day": 15},
            format="json",
        )
        self.assertEqual(resp.status_code, 201, resp.data)
        self.assertEqual(resp.data["date_of_birth"], f"{year}-06-15")
        self.assertEqual(resp.data["birth_precision"], "day")
        self.assertEqual(resp.data["relationship"], "child")

    def test_post_rejects_invalid_future_and_adult_dates(self):
        year = self.today.year - 5
        cases = [
            {"birth_month": 2, "birth_year": year, "birth_day": 30},  # not a real date
            {"birth_month": 2, "birth_year": year, "birth_day": 0},
            {"birth_month": 2, "birth_year": year, "birth_day": "abc"},
            {"date_of_birth": "2020-02-31"},
            {"date_of_birth": (self.today + timedelta(days=1)).isoformat()},
            {"birth_month": self.today.month, "birth_year": self.today.year + 1},
            {"birth_month": 1, "birth_year": self.today.year - 30, "birth_day": 1},
            {"date_of_birth": years_ago(self.today, 30).isoformat()},
        ]
        for case in cases:
            resp = self.client.post(reverse("household"), {"name": "Kid", **case}, format="json")
            self.assertEqual(resp.status_code, 400, (case, resp.data))
        self.assertEqual(HouseholdDependent.objects.count(), 0)

    def test_post_future_month_this_year_rejected(self):
        if self.today.month == 12:
            self.skipTest("no later month this year")
        resp = self.client.post(
            reverse("household"),
            {"name": "Kid", "birth_month": self.today.month + 1, "birth_year": self.today.year},
            format="json",
        )
        self.assertEqual(resp.status_code, 400)

    def test_post_adult_message_is_unchanged(self):
        resp = self.client.post(
            reverse("household"),
            {"name": "Big", "date_of_birth": years_ago(self.today, 30).isoformat()},
            format="json",
        )
        self.assertEqual(resp.status_code, 400)
        self.assertEqual(
            resp.data["date_of_birth"], "Only children under 18 can be added to a household."
        )

    def test_legacy_row_with_only_full_date_reports_month_and_year(self):
        dob = years_ago(self.today, 8, month=7, day=9)
        HouseholdDependent.objects.create(parent=self.parent, name="Old", date_of_birth=dob)
        child = self.client.get(reverse("household")).data["children"][0]
        self.assertEqual(
            (child["birth_month"], child["birth_day"], child["birth_year"]), (7, 9, dob.year)
        )
        self.assertEqual(child["birth_precision"], "day")

    def test_spouse_has_no_birth_data(self):
        resp = self.client.post(
            reverse("household"), {"name": "Pat", "relationship": "spouse"}, format="json"
        )
        spouse = resp.data["members"][0]
        self.assertIsNone(spouse["birth_precision"])
        self.assertIsNone(spouse["birth_day"])
        self.assertNotIn("date_of_birth", spouse)


class HouseholdPatchTests(APITestCase):
    def setUp(self):
        self.today = ny_today()
        self.parent = make("parent")
        self.kid = HouseholdDependent.objects.create(
            parent=self.parent, name="Kid", birth_month=6, birth_year=self.today.year - 6
        )
        self.url = reverse("household-delete", args=[self.kid.id])
        self.client.force_authenticate(self.parent)

    def test_set_birth_day(self):
        resp = self.client.patch(self.url, {"birth_day": 20}, format="json")
        self.assertEqual(resp.status_code, 200, resp.data)
        year = self.today.year - 6
        self.assertEqual(resp.data["date_of_birth"], f"{year}-06-20")
        self.assertEqual(resp.data["birth_precision"], "day")
        self.assertEqual(resp.data["name"], "Kid")
        self.assertEqual(len(resp.data["members"]), 1)
        self.kid.refresh_from_db()
        self.assertEqual(self.kid.date_of_birth, date(year, 6, 20))
        self.assertEqual((self.kid.birth_month, self.kid.birth_year), (6, year))

    def test_name_unchanged_unless_provided(self):
        self.client.patch(self.url, {"birth_day": 2}, format="json")
        self.kid.refresh_from_db()
        self.assertEqual(self.kid.name, "Kid")
        resp = self.client.patch(self.url, {"name": "Kiddo"}, format="json")
        self.assertEqual(resp.status_code, 200)
        self.kid.refresh_from_db()
        self.assertEqual(self.kid.name, "Kiddo")
        self.assertEqual(self.kid.date_of_birth, date(self.today.year - 6, 6, 2))

    def test_clear_birth_day_goes_back_to_month_precision(self):
        self.client.patch(self.url, {"birth_day": 2}, format="json")
        resp = self.client.patch(self.url, {"birth_day": None}, format="json")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data["birth_precision"], "month")
        self.assertIsNone(resp.data["date_of_birth"])
        self.assertEqual(resp.data["birth_month"], 6)

    def test_clear_keeps_month_for_legacy_full_date_row(self):
        legacy = HouseholdDependent.objects.create(
            parent=self.parent, name="Old", date_of_birth=years_ago(self.today, 5, month=4, day=3)
        )
        resp = self.client.patch(
            reverse("household-delete", args=[legacy.id]), {"birth_day": None}, format="json"
        )
        self.assertEqual(resp.status_code, 200)
        self.assertEqual((resp.data["birth_month"], resp.data["birth_precision"]), (4, "month"))

    def test_invalid_day_rejected(self):
        for bad in (31, 0, 32, "x", True):  # June has 30 days
            resp = self.client.patch(self.url, {"birth_day": bad}, format="json")
            self.assertEqual(resp.status_code, 400, bad)
        self.kid.refresh_from_db()
        self.assertIsNone(self.kid.date_of_birth)

    def test_future_date_rejected(self):
        HouseholdDependent.objects.filter(pk=self.kid.pk).update(
            birth_month=self.today.month, birth_year=self.today.year
        )
        day = self.today.day + 1 if self.today.day < 28 else None
        if day is None:
            self.skipTest("no later day this month that always exists")
        resp = self.client.patch(self.url, {"birth_day": day}, format="json")
        self.assertEqual(resp.status_code, 400)
        self.assertIn("future", resp.data["birth_day"])

    def test_cannot_make_child_an_adult(self):
        resp = self.client.patch(
            self.url,
            {"date_of_birth": years_ago(self.today, 19).isoformat()},
            format="json",
        )
        self.assertEqual(resp.status_code, 400)
        self.assertEqual(
            resp.data["date_of_birth"], "Only children under 18 can be added to a household."
        )
        # month 12 years ago + day pushes a child at the edge over 18
        HouseholdDependent.objects.filter(pk=self.kid.pk).update(
            birth_month=self.today.month, birth_year=self.today.year - 18
        )
        resp = self.client.patch(self.url, {"birth_day": 1}, format="json")
        self.assertEqual(resp.status_code, 400)

    def test_only_owner_can_patch(self):
        other = make("other")
        self.client.force_authenticate(other)
        resp = self.client.patch(self.url, {"birth_day": 2}, format="json")
        self.assertEqual(resp.status_code, 404)
        self.kid.refresh_from_db()
        self.assertIsNone(self.kid.date_of_birth)

    def test_requires_auth_and_unknown_id(self):
        self.client.force_authenticate(None)
        self.assertIn(
            self.client.patch(self.url, {"birth_day": 2}, format="json").status_code, (401, 403)
        )
        self.client.force_authenticate(self.parent)
        missing = reverse("household-delete", args=[999999])
        self.assertEqual(
            self.client.patch(missing, {"birth_day": 2}, format="json").status_code, 404
        )

    def test_spouse_has_no_birth_day(self):
        spouse = HouseholdDependent.objects.create(
            parent=self.parent, name="Pat", relationship="spouse"
        )
        resp = self.client.patch(
            reverse("household-delete", args=[spouse.id]), {"birth_day": 2}, format="json"
        )
        self.assertEqual(resp.status_code, 400)

    def test_full_date_of_birth_patch(self):
        dob = years_ago(self.today, 4, month=1, day=31)
        resp = self.client.patch(self.url, {"date_of_birth": dob.isoformat()}, format="json")
        self.assertEqual(resp.status_code, 200, resp.data)
        self.assertEqual(resp.data["date_of_birth"], dob.isoformat())
        self.assertEqual(resp.data["birth_month"], 1)


class ChildBirthDateNeverLeaksTests(APITestCase):
    """Only the owning parent sees a child's birth data; hosts and others get age bands."""

    def setUp(self):
        self.today = ny_today()
        self.host = make("host")
        self.parent = make("parent", profile_visibility="public", show_birthday=True)
        self.dob = years_ago(self.today, 7, month=3, day=14)
        self.kid = HouseholdDependent.objects.create(
            parent=self.parent,
            name="Kidname",
            date_of_birth=self.dob,
            birth_month=3,
            birth_year=self.dob.year,
        )
        self.activity = _activity(
            self.host, time=timezone.now() - timedelta(hours=2), requires_approval=False
        )
        part = ActivityParticipant.objects.create(
            activity=self.activity, user=self.parent, status="confirmed", include_self=True
        )
        part.dependents.set([self.kid])
        self.watcher = make("watcher")
        ActivityParticipant.objects.create(
            activity=self.activity, user=self.watcher, status="confirmed"
        )
        befriend(self.watcher, self.parent)

    def assert_clean(self, response):
        self.assertEqual(response.status_code, 200, response.data)
        text = str(response.data)
        for leak in (self.dob.isoformat(), str(self.dob.year), "birth_", "date_of_birth"):
            self.assertNotIn(leak, text)

    def test_host_attendees_have_age_band_only(self):
        self.client.force_authenticate(self.host)
        resp = self.client.get(reverse("activity-attendees", args=[self.activity.id]))
        self.assert_clean(resp)
        kid = [p for p in resp.data["households"][0]["people"] if p["name"] == "Kidname"][0]
        self.assertEqual(kid, {"name": "Kidname", "relationship": "child", "age_band": "under 13"})

    def test_attendee_view_lists_no_children(self):
        self.client.force_authenticate(self.watcher)
        resp = self.client.get(reverse("activity-attendees", args=[self.activity.id]))
        self.assert_clean(resp)
        self.assertNotIn("Kidname", str(resp.data))

    def test_profile_card_and_friend_endpoints_do_not_expose_it(self):
        self.client.force_authenticate(self.watcher)
        for url in (
            reverse("user-profile-card", args=[self.parent.id]),
            reverse("friend-list"),
            reverse("friend-birthdays"),
        ):
            resp = self.client.get(url)
            self.assertEqual(resp.status_code, 200)
            text = str(resp.data)
            self.assertNotIn(self.dob.isoformat(), text)
            self.assertNotIn("Kidname", text)
            self.assertNotIn("date_of_birth", text)

    def test_host_request_list_has_age_band_only(self):
        self.activity.requires_approval = True
        self.activity.time = timezone.now() + timedelta(days=3)
        self.activity.save()
        ActivityParticipant.objects.filter(user=self.parent).update(status="pending")
        self.client.force_authenticate(self.host)
        resp = self.client.get(reverse("activity-requests", args=[self.activity.id]))
        self.assert_clean(resp)

    def test_only_owner_sees_it_in_household(self):
        self.client.force_authenticate(self.parent)
        resp = self.client.get(reverse("household"))
        self.assertEqual(resp.data["children"][0]["date_of_birth"], self.dob.isoformat())
        self.client.force_authenticate(self.watcher)
        self.assertEqual(self.client.get(reverse("household")).data["children"], [])

    def test_children_have_no_show_birthday_field(self):
        field_names = {f.name for f in HouseholdDependent._meta.get_fields()}
        self.assertNotIn("show_birthday", field_names)
        self.assertNotIn("show_on_profile", field_names)


class ShowBirthdaySettingTests(APITestCase):
    def setUp(self):
        self.user = make("adult")
        self.client.force_authenticate(self.user)
        self.url = reverse("user-profile")

    def test_defaults_false_and_visible_in_own_profile(self):
        resp = self.client.get(self.url)
        self.assertIs(resp.data["show_birthday"], False)

    def test_adult_can_turn_on_and_off(self):
        resp = self.client.patch(self.url, {"show_birthday": True}, format="json")
        self.assertEqual(resp.status_code, 200, resp.data)
        self.assertIs(resp.data["show_birthday"], True)
        self.user.refresh_from_db()
        self.assertTrue(self.user.show_birthday)
        resp = self.client.patch(self.url, {"show_birthday": False}, format="json")
        self.assertIs(resp.data["show_birthday"], False)

    def test_minor_cannot_turn_on(self):
        teen = make("teen", dob=_safe_birthdate(15))
        self.client.force_authenticate(teen)
        resp = self.client.patch(self.url, {"show_birthday": True}, format="json")
        self.assertEqual(resp.status_code, 400)
        self.assertEqual(
            resp.data["show_birthday"][0], "Birthdays can only be shared by accounts 18 and older."
        )
        teen.refresh_from_db()
        self.assertFalse(teen.show_birthday)

    def test_no_date_of_birth_cannot_turn_on(self):
        User.objects.filter(pk=self.user.pk).update(date_of_birth=None)
        self.client.force_authenticate(User.objects.get(pk=self.user.pk))
        resp = self.client.patch(self.url, {"show_birthday": True}, format="json")
        self.assertEqual(resp.status_code, 400)
        self.assertIn("birth date", resp.data["show_birthday"][0])

    def test_cannot_turn_on_while_setting_a_minor_birth_date(self):
        resp = self.client.patch(
            self.url,
            {"show_birthday": True, "date_of_birth": _safe_birthdate(15).isoformat()},
            format="json",
        )
        self.assertEqual(resp.status_code, 400)

    def test_becoming_a_minor_switches_it_off(self):
        self.client.patch(self.url, {"show_birthday": True}, format="json")
        resp = self.client.patch(
            self.url, {"date_of_birth": _safe_birthdate(15).isoformat()}, format="json"
        )
        self.assertEqual(resp.status_code, 200, resp.data)
        self.assertIs(resp.data["show_birthday"], False)

    def test_other_profile_updates_do_not_touch_it(self):
        self.client.patch(self.url, {"show_birthday": True}, format="json")
        self.client.patch(self.url, {"bio": "Hi"}, format="json")
        self.user.refresh_from_db()
        self.assertTrue(self.user.show_birthday)


class ProfileCardBirthdayTests(APITestCase):
    def setUp(self):
        self.today = ny_today()
        self.owner = make(
            "owner",
            dob=years_ago(self.today, 30, month=8, day=17),
            show_birthday=True,
            profile_visibility="public",
        )
        self.viewer = make("viewer")
        self.client.force_authenticate(self.viewer)
        self.url = reverse("user-profile-card", args=[self.owner.id])

    def test_month_and_day_only(self):
        resp = self.client.get(self.url)
        self.assertEqual(resp.data["birthday"], {"month": 8, "day": 17})
        self.assertNotIn(str(self.owner.date_of_birth.year), str(resp.data))

    def test_hidden_when_toggle_off(self):
        User.objects.filter(pk=self.owner.pk).update(show_birthday=False)
        self.assertNotIn("birthday", self.client.get(self.url).data)

    def test_hidden_for_minor_even_if_flag_forced_on(self):
        User.objects.filter(pk=self.owner.pk).update(date_of_birth=_safe_birthdate(15))
        befriend(self.viewer, self.owner)
        self.assertNotIn("birthday", self.client.get(self.url).data)

    def test_visibility_levels(self):
        church = Church.objects.create(name="C")
        User.objects.filter(pk__in=[self.owner.pk, self.viewer.pk]).update(church=church)
        outsider = make("outsider")
        friend = make("friend")
        befriend(friend, self.owner)
        expect = {
            "only_me": {"viewer": False, "friend": False, "outsider": False},
            "friends": {"viewer": False, "friend": True, "outsider": False},
            "church": {"viewer": True, "friend": True, "outsider": False},
            "public": {"viewer": True, "friend": True, "outsider": True},
        }
        users = {
            "viewer": User.objects.get(pk=self.viewer.pk),
            "friend": friend,
            "outsider": outsider,
        }
        for level, results in expect.items():
            User.objects.filter(pk=self.owner.pk).update(profile_visibility=level)
            for label, should_see in results.items():
                self.client.force_authenticate(users[label])
                resp = self.client.get(self.url)
                seen = resp.status_code == 200 and "birthday" in resp.data
                self.assertEqual(seen, should_see, (level, label))

    def test_blocked_viewer_gets_404(self):
        BlockedUser.objects.create(blocker=self.owner, blocked=self.viewer)
        self.assertEqual(self.client.get(self.url).status_code, 404)


class FriendBirthdaysTests(APITestCase):
    URL = "friend-birthdays"

    def setUp(self):
        self.today = date(2026, 10, 2)
        self.me = make("me")
        self.client.force_authenticate(self.me)
        patcher = patch("users.social_views.ny_today", return_value=self.today)
        patcher.start()
        self.addCleanup(patcher.stop)

    def friend(self, name, month, day, *, year=1990, friends=True, **extra):
        extra.setdefault("show_birthday", True)
        extra.setdefault("profile_visibility", "friends")
        user = make(name, dob=date(year, month, day), **extra)
        if friends:
            befriend(self.me, user)
        return user

    def get(self):
        resp = self.client.get(reverse(self.URL))
        self.assertEqual(resp.status_code, 200)
        return resp.data["birthdays"]

    def test_requires_auth(self):
        self.client.force_authenticate(None)
        self.assertIn(self.client.get(reverse(self.URL)).status_code, (401, 403))

    def test_today_within_week_sorted_and_shape(self):
        later = self.friend("later", 10, 9)
        today = self.friend("today", 10, 2)
        soon = self.friend("soon", 10, 5, year=1985)
        self.friend("toolate", 10, 10)  # 8 days away
        self.friend("passed", 10, 1)  # 364 days away
        rows = self.get()
        self.assertEqual(
            rows,
            [
                {"user_id": today.id, "name": "Today", "month": 10, "day": 2, "days_until": 0},
                {"user_id": soon.id, "name": "Soon", "month": 10, "day": 5, "days_until": 3},
                {"user_id": later.id, "name": "Later", "month": 10, "day": 9, "days_until": 7},
            ],
        )
        self.assertNotIn("1985", str(rows))

    def test_year_wraparound(self):
        self.today = date(2026, 12, 28)
        with patch("users.social_views.ny_today", return_value=self.today):
            new_year = self.friend("newyear", 1, 3, year=2000)
            eve = self.friend("eve", 12, 31)
            far = self.friend("far", 1, 5)
            rows = self.get()
        self.assertEqual([r["user_id"] for r in rows], [eve.id, new_year.id])
        self.assertEqual([r["days_until"] for r in rows], [3, 6])
        self.assertEqual((rows[1]["month"], rows[1]["day"]), (1, 3))
        self.assertNotIn(far.id, [r["user_id"] for r in rows])

    def test_leap_day_uses_feb_28_in_non_leap_year(self):
        leap = self.friend("leapling", 2, 29, year=1996)
        with patch("users.social_views.ny_today", return_value=date(2027, 2, 24)):
            rows = self.get()
        self.assertEqual(
            rows, [{"user_id": leap.id, "name": "Leapling", "month": 2, "day": 28, "days_until": 4}]
        )
        with patch("users.social_views.ny_today", return_value=date(2027, 2, 28)):
            self.assertEqual(self.get()[0]["days_until"], 0)
        with patch("users.social_views.ny_today", return_value=date(2027, 3, 1)):
            self.assertEqual(self.get(), [])

    def test_leap_day_in_leap_year_is_feb_29(self):
        leap = self.friend("leapling", 2, 29, year=1996)
        with patch("users.social_views.ny_today", return_value=date(2028, 2, 25)):
            rows = self.get()
        self.assertEqual((rows[0]["user_id"], rows[0]["month"], rows[0]["day"]), (leap.id, 2, 29))
        self.assertEqual(rows[0]["days_until"], 4)

    def test_same_day_ties_are_stable(self):
        a = self.friend("alice", 10, 4)
        b = self.friend("bob", 10, 4)
        self.assertEqual([r["user_id"] for r in self.get()], [a.id, b.id])

    def test_only_friends(self):
        self.friend("stranger", 10, 3, friends=False, profile_visibility="public")
        pending = make(
            "pending", dob=date(1990, 10, 3), show_birthday=True, profile_visibility="public"
        )
        Friendship.objects.create(requester=self.me, recipient=pending, status="pending")
        self.assertEqual(self.get(), [])

    def test_requires_show_birthday(self):
        self.friend("private", 10, 3, show_birthday=False)
        self.assertEqual(self.get(), [])

    def test_only_me_visibility_hides_even_from_friends(self):
        self.friend("hidden", 10, 3, profile_visibility="only_me")
        self.assertEqual(self.get(), [])

    def test_visibility_levels_for_a_friend(self):
        for level in ("friends", "church", "public"):
            user = self.friend(f"user{level}", 10, 3, profile_visibility=level)
        self.assertEqual(len(self.get()), 3)
        self.assertEqual(user.profile_visibility, "public")

    def test_under_18_never_shown(self):
        teen = self.friend("teen", 10, 3, show_birthday=False)
        # A flag forced on in the database still does not show a minor.
        User.objects.filter(pk=teen.pk).update(
            show_birthday=True, date_of_birth=date(2026 - 15, 10, 3)
        )
        self.assertEqual(self.get(), [])

    def test_turns_18_in_window_not_shown_until_birthday(self):
        soon18 = self.friend("soon18", 10, 5, year=2008)  # 17 until Oct 5
        self.assertEqual(self.get(), [])
        self.assertTrue(User.objects.filter(pk=soon18.pk).exists())
        with patch("users.social_views.ny_today", return_value=date(2026, 10, 5)):
            self.assertEqual([r["user_id"] for r in self.get()], [soon18.id])

    def test_blocked_either_way_excluded(self):
        mine = self.friend("iblocked", 10, 3)
        theirs = self.friend("blockedme", 10, 4)
        BlockedUser.objects.create(blocker=self.me, blocked=mine)
        BlockedUser.objects.create(blocker=theirs, blocked=self.me)
        self.assertEqual(self.get(), [])

    def test_inactive_friend_excluded(self):
        self.friend("gone", 10, 3, is_active=False)
        self.assertEqual(self.get(), [])

    def test_does_not_return_other_people_birthdays(self):
        other = make("other")
        friend = self.friend("pal", 10, 3)
        befriend(other, friend)
        self.assertEqual([r["user_id"] for r in self.get()], [friend.id])

    def test_own_birthday_not_listed(self):
        User.objects.filter(pk=self.me.pk).update(
            date_of_birth=date(1990, 10, 2), show_birthday=True
        )
        self.assertEqual(self.get(), [])


class BirthdayPushTaskTests(APITestCase):
    def setUp(self):
        self.today = date(2026, 10, 2)
        self.celebrant = make(
            "bday", dob=date(1990, 10, 2), show_birthday=True, profile_visibility="friends"
        )
        self.pal = make("pal")
        befriend(self.pal, self.celebrant)

    def run_task(self, today=None):
        with (
            patch("users.tasks.ny_today", return_value=today or self.today),
            patch("users.tasks.send_push_to_user") as push,
        ):
            result = send_birthday_notifications()
        return result, push

    def test_notifies_allowed_friend(self):
        result, push = self.run_task()
        self.assertEqual(result, {"celebrants": 1, "sent": 1})
        args = push.call_args.args
        self.assertEqual(args[0], self.pal)
        self.assertIn("Bday", args[1])
        self.assertEqual(args[3]["type"], "friend_birthday")
        self.assertEqual(args[3]["userId"], self.celebrant.id)
        self.assertNotIn("1990", str(args))

    def test_nothing_when_not_their_day(self):
        _, push = self.run_task(date(2026, 10, 3))
        push.assert_not_called()

    def test_skips_when_sharing_off_only_me_minor_or_blocked(self):
        User.objects.filter(pk=self.celebrant.pk).update(show_birthday=False)
        _, push = self.run_task()
        push.assert_not_called()
        User.objects.filter(pk=self.celebrant.pk).update(
            show_birthday=True, profile_visibility="only_me"
        )
        _, push = self.run_task()
        push.assert_not_called()
        User.objects.filter(pk=self.celebrant.pk).update(
            profile_visibility="friends", date_of_birth=date(2026 - 15, 10, 2)
        )
        _, push = self.run_task()
        push.assert_not_called()
        User.objects.filter(pk=self.celebrant.pk).update(date_of_birth=date(1990, 10, 2))
        BlockedUser.objects.create(blocker=self.pal, blocked=self.celebrant)
        _, push = self.run_task()
        push.assert_not_called()

    def test_non_friends_are_not_notified(self):
        Friendship.objects.all().delete()
        User.objects.filter(pk=self.celebrant.pk).update(profile_visibility="public")
        _, push = self.run_task()
        push.assert_not_called()

    def test_leap_day_celebrated_feb_28_in_common_year(self):
        User.objects.filter(pk=self.celebrant.pk).update(date_of_birth=date(1996, 2, 29))
        result, _ = self.run_task(date(2027, 2, 28))
        self.assertEqual(result["sent"], 1)
        result, _ = self.run_task(date(2028, 2, 28))
        self.assertEqual(result["sent"], 0)
        result, _ = self.run_task(date(2028, 2, 29))
        self.assertEqual(result["sent"], 1)

    def test_respects_push_preference(self):
        # Real send_push_to_user: opted-out recipients get no request, others do.
        from users.models import PushDeviceToken

        PushDeviceToken.objects.create(user=self.pal, token="ExponentPushToken[abc]")
        User.objects.filter(pk=self.pal.pk).update(
            preferences={"notifications": {"pushNotifications": False}}
        )
        self.pal.refresh_from_db()
        with (
            patch("users.tasks.ny_today", return_value=self.today),
            patch("users.push_notifications.requests.post") as post,
        ):
            send_birthday_notifications()
            post.assert_not_called()
            User.objects.filter(pk=self.pal.pk).update(preferences={})
            send_birthday_notifications()
            post.assert_called_once()

    def test_beat_schedule_registered(self):
        from django.conf import settings

        entry = settings.CELERY_BEAT_SCHEDULE["friend-birthday-notifications"]
        self.assertEqual(entry["task"], "users.tasks.send_birthday_notifications")
