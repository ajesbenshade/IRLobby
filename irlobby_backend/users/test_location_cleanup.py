"""Members' own coordinates: ignored on write, null on read, and a manual clear command."""

from io import StringIO

from django.core.management import call_command
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APITestCase

from activities.models import Activity
from activities.test_foyer import _safe_birthdate
from users.models import User

PROFILE_URL = reverse("user-profile")


def _user(name, **extra):
    return User.objects.create_user(
        username=name,
        email=f"{name}@example.com",
        password="Passw0rd-123",
        first_name=name.capitalize(),
        date_of_birth=_safe_birthdate(40),
        **extra,
    )


class ProfileCoordinatesIgnoredTests(APITestCase):
    def setUp(self):
        self.user = _user("member", location="Souderton, PA")
        self.client.force_authenticate(self.user)

    def test_patch_ignores_coordinates_and_keeps_location_text(self):
        response = self.client.patch(
            PROFILE_URL,
            {"latitude": 40.31, "longitude": -75.32, "location": "Telford, PA"},
            format="json",
        )
        self.assertEqual(response.status_code, 200, response.data)
        body = response.json()
        self.assertIsNone(body["latitude"])
        self.assertIsNone(body["longitude"])
        self.assertEqual(body["location"], "Telford, PA")
        self.assertEqual(body["city"], "Telford, PA")
        self.user.refresh_from_db()
        self.assertIsNone(self.user.latitude)
        self.assertIsNone(self.user.longitude)
        self.assertEqual(self.user.location, "Telford, PA")

    def test_put_ignores_coordinates(self):
        current = self.client.get(PROFILE_URL).json()
        payload = {
            "username": current["username"],
            "email": current["email"],
            "latitude": "40.31",
            "longitude": "-75.32",
        }
        response = self.client.put(PROFILE_URL, payload, format="json")
        self.assertEqual(response.status_code, 200, response.data)
        self.user.refresh_from_db()
        self.assertIsNone(self.user.latitude)
        self.assertIsNone(self.user.longitude)

    def test_invalid_coordinates_do_not_error(self):
        response = self.client.patch(
            PROFILE_URL, {"latitude": "not-a-number", "longitude": None}, format="json"
        )
        self.assertEqual(response.status_code, 200, response.data)

    def test_stored_coordinates_are_not_returned(self):
        User.objects.filter(pk=self.user.pk).update(latitude=40.1, longitude=-75.1)
        body = self.client.get(PROFILE_URL).json()
        self.assertIn("latitude", body)
        self.assertIsNone(body["latitude"])
        self.assertIsNone(body["longitude"])
        export = self.client.get(reverse("export-user-data")).json()
        self.assertIsNone(export["user_profile"]["latitude"])
        self.assertIsNone(export["user_profile"]["longitude"])

    def test_onboarding_keeps_city_and_ignores_coordinates(self):
        response = self.client.patch(
            reverse("user-onboarding"),
            {"city": "Harleysville, PA", "latitude": 40.28, "longitude": -75.39},
            format="json",
        )
        self.assertEqual(response.status_code, 200, response.data)
        self.user.refresh_from_db()
        self.assertEqual(self.user.location, "Harleysville, PA")
        self.assertIsNone(self.user.latitude)
        self.assertIsNone(self.user.longitude)


class ClearUserCoordinatesCommandTests(APITestCase):
    def setUp(self):
        self.a = _user("a", latitude=40.1, longitude=-75.1, location="Souderton, PA")
        self.b = _user("b", latitude=40.2, longitude=None)
        self.c = _user("c")
        self.activity = Activity.objects.create(
            host=self.c,
            title="Potluck",
            description="Bring a dish.",
            location="Fellowship Hall",
            latitude=40.31,
            longitude=-75.34,
            time=timezone.now(),
        )

    def run_command(self, *args):
        out = StringIO()
        call_command("clear_user_coordinates", *args, stdout=out)
        return out.getvalue()

    def test_dry_run_prints_count_and_changes_nothing(self):
        output = self.run_command()
        self.assertIn("2 user(s) have stored coordinates (dry run", output)
        self.a.refresh_from_db()
        self.assertEqual(self.a.latitude, 40.1)

    def test_apply_clears_users_only(self):
        output = self.run_command("--apply")
        self.assertIn("Cleared coordinates for 2 user(s).", output)
        self.assertFalse(
            User.objects.filter(latitude__isnull=False).exists()
            or User.objects.filter(longitude__isnull=False).exists()
        )
        self.a.refresh_from_db()
        self.assertEqual(self.a.location, "Souderton, PA")
        self.activity.refresh_from_db()
        self.assertEqual(self.activity.latitude, 40.31)
        self.assertEqual(self.activity.longitude, -75.34)
        self.assertIn("0 user(s)", self.run_command())
