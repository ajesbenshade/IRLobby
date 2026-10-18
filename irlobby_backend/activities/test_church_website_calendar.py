"""Church.has_website_calendar: exposed on church payloads, gates calendar listing and the feed."""

from datetime import timedelta

from django.core.cache import cache
from django.test import override_settings
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from activities.models import FRANCONIA_CHURCH_NAME, Activity, Church
from activities.test_foyer import _activity, _safe_birthdate
from users.models import User

ADMIN_EMAIL = "pastor@example.com"
UNAVAILABLE = {
    "code": "church_calendar_unavailable",
    "detail": "Your church's website doesn't show The Foyer calendar yet.",
}


def _user(name, church=None, email=None):
    return User.objects.create_user(
        username=name,
        email=email or f"{name}@example.com",
        password="Passw0rd-123",
        first_name=name.capitalize(),
        date_of_birth=_safe_birthdate(40),
        church=church,
    )


def _payload(**overrides):
    payload = {
        "title": "Supper Club",
        "description": "Dinner at our place.",
        "location": "12 Maple Lane",
        "latitude": 40.31,
        "longitude": -75.34,
        "time": (timezone.now() + timedelta(days=3)).isoformat(),
        "capacity": 6,
    }
    payload.update(overrides)
    return payload


@override_settings(FOYER_CHURCH_ADMIN_EMAILS=[ADMIN_EMAIL], FOYER_EVENT_CREATE_LIMIT=100)
class WebsiteCalendarTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.franconia = Church.objects.get(name=FRANCONIA_CHURCH_NAME)
        self.souderton = Church.objects.get(name="Souderton Mennonite Church")
        self.franconia_member = _user("fran", church=self.franconia)
        self.souderton_member = _user("soud", church=self.souderton)
        self.no_church = _user("nochurch")
        self.admin = _user("pastor", email=ADMIN_EMAIL)

    def create(self, user, **overrides):
        self.client.force_authenticate(user)
        return self.client.post(reverse("activity-list"), _payload(**overrides), format="json")

    def test_data_migration_enables_only_franconia(self):
        self.assertTrue(self.franconia.has_website_calendar)
        self.assertEqual(
            list(Church.objects.filter(has_website_calendar=True).values_list("name", flat=True)),
            [FRANCONIA_CHURCH_NAME],
        )

    def test_church_list_and_profile_and_login_expose_the_flag(self):
        self.client.force_authenticate(self.franconia_member)
        listed = self.client.get(reverse("church-list"), {"q": "Mennonite"}).json()
        flags = {church["name"]: church["has_website_calendar"] for church in listed}
        self.assertTrue(flags[FRANCONIA_CHURCH_NAME])
        self.assertFalse(flags["Souderton Mennonite Church"])

        profile = self.client.get(reverse("user-profile")).json()
        self.assertTrue(profile["church"]["has_website_calendar"])
        status_body = self.client.get(reverse("auth-status")).json()
        self.assertTrue(status_body["user"]["church"]["has_website_calendar"])

        self.client.force_authenticate(None)
        login = self.client.post(
            reverse("user-login"),
            {"email": self.souderton_member.email, "password": "Passw0rd-123"},
            format="json",
        )
        self.assertEqual(login.status_code, status.HTTP_200_OK, login.data)
        self.assertFalse(login.json()["user"]["church"]["has_website_calendar"])

    def test_member_of_website_calendar_church_can_list(self):
        response = self.create(self.franconia_member, list_on_church_calendar=True)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertFalse(response.data["calendar_approved"])

    def test_member_of_other_church_or_no_church_is_rejected_with_flat_body(self):
        for user in (self.souderton_member, self.no_church):
            response = self.create(user, list_on_church_calendar=True)
            self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
            self.assertEqual(response.json(), UNAVAILABLE)
        self.assertFalse(Activity.objects.exists())

    def test_unlisted_events_are_unaffected(self):
        response = self.create(self.souderton_member, list_on_church_calendar=False)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_update_to_list_is_rejected_but_other_edits_work(self):
        activity = _activity(self.souderton_member)
        url = reverse("activity-detail", args=[activity.id])
        self.client.force_authenticate(self.souderton_member)
        listed = self.client.patch(url, {"list_on_church_calendar": True}, format="json")
        self.assertEqual(listed.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(listed.json()["code"], "church_calendar_unavailable")
        renamed = self.client.patch(url, {"title": "Renamed"}, format="json")
        self.assertEqual(renamed.status_code, status.HTTP_200_OK)

    def test_host_church_takes_priority_over_profile_church(self):
        response = self.create(
            self.franconia_member, list_on_church_calendar=True, host_church_id=self.souderton.id
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        response = self.create(
            self.souderton_member, list_on_church_calendar=True, host_church_id=self.franconia.id
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)

    def test_church_hosted_defaults_to_franconia(self):
        response = self.create(self.admin, host_kind="church", list_on_church_calendar=True)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertTrue(response.data["calendar_approved"])

    def test_feed_only_shows_website_calendar_churches(self):
        listed = dict(list_on_church_calendar=True, calendar_approved=True)
        _activity(self.franconia_member, title="Franconia member event", **listed)
        _activity(self.souderton_member, title="Souderton member event", **listed)
        _activity(self.no_church, title="No church event", **listed)
        _activity(self.no_church, title="Hosted at Franconia", host_church=self.franconia, **listed)
        _activity(
            self.franconia_member, title="Hosted at Souderton", host_church=self.souderton, **listed
        )
        self.client.force_authenticate(None)
        response = self.client.get(reverse("public-calendar"))
        titles = {event["title"] for event in response.data["events"]}
        self.assertEqual(titles, {"Franconia member event", "Hosted at Franconia"})
        ics = self.client.get(reverse("public-calendar-ics")).content.decode()
        self.assertIn("Franconia member event", ics)
        self.assertNotIn("Souderton member event", ics)
