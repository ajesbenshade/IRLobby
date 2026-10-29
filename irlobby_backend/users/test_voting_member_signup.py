"""Voting-member sign-up: 18+ only, attestation required, household stays under 18.

Legacy 13–17 accounts are not migrated or deleted. New ones cannot be created.
"""

from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from activities.household_rules import ACCOUNT_AGE_ERROR
from activities.test_foyer import _safe_birthdate
from users.models import User
from users.serializers import VOTING_MEMBER_ATTESTATION_ERROR

PW = "password123"
HOUSEHOLD_ADULT_ERROR = "Only children under 18 can be added to a household."


def _signup(**extra):
    body = {
        "username": "member",
        "email": "member@example.com",
        "password": PW,
        "password_confirm": PW,
        "date_of_birth": _safe_birthdate(30).isoformat(),
        "voting_member_attested": True,
    }
    body.update(extra)
    return body


class VotingMemberSignupTests(APITestCase):
    def setUp(self):
        self.url = reverse("user-register")

    def test_under_18_signup_is_rejected(self):
        for years in (10, 13, 17):
            with self.subTest(years=years):
                email = f"age{years}@example.com"
                response = self.client.post(
                    self.url,
                    _signup(
                        username=f"age{years}",
                        email=email,
                        date_of_birth=_safe_birthdate(years).isoformat(),
                    ),
                    format="json",
                )
                self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
                self.assertEqual(response.data["date_of_birth"], [ACCOUNT_AGE_ERROR])
                self.assertFalse(User.objects.filter(email=email).exists())

    def test_missing_attestation_is_rejected(self):
        body = _signup()
        body.pop("voting_member_attested")
        missing = self.client.post(self.url, body, format="json")
        self.assertEqual(missing.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(missing.data["voting_member_attested"], [VOTING_MEMBER_ATTESTATION_ERROR])
        declined = self.client.post(
            self.url, _signup(voting_member_attested=False, email="no@example.com"), format="json"
        )
        self.assertEqual(declined.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(declined.data["voting_member_attested"], [VOTING_MEMBER_ATTESTATION_ERROR])
        self.assertFalse(User.objects.filter(email="member@example.com").exists())
        self.assertFalse(User.objects.filter(email="no@example.com").exists())

    def test_missing_birth_date_is_rejected(self):
        body = _signup()
        body.pop("date_of_birth")
        response = self.client.post(self.url, body, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["date_of_birth"], [ACCOUNT_AGE_ERROR])
        self.assertFalse(User.objects.filter(email="member@example.com").exists())

    def test_adult_with_attestation_is_created(self):
        before = timezone.now()
        response = self.client.post(
            self.url,
            {
                "username": "member",
                "email": "member@example.com",
                "password": PW,
                "password_confirm": PW,
                "birthDate": _safe_birthdate(18).isoformat(),
                "votingMemberAttested": True,
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        user = User.objects.get(email="member@example.com")
        self.assertEqual(user.date_of_birth, _safe_birthdate(18))
        self.assertIsNotNone(user.voting_member_attested_at)
        self.assertGreaterEqual(user.voting_member_attested_at, before)
        self.assertTrue(response.data["user"]["voting_member_attested_at"])
        self.assertNotIn("voting_member_attested", response.data["user"])

    def test_profile_rejects_under_18_birth_date_and_keeps_legacy_teens(self):
        adult = User.objects.create_user(
            username="adult",
            email="adult@example.com",
            password=PW,
            date_of_birth=_safe_birthdate(40),
        )
        teen = User.objects.create_user(
            username="legacy-teen",
            email="teen@example.com",
            password=PW,
            date_of_birth=_safe_birthdate(16),
        )
        self.assertIsNone(teen.voting_member_attested_at)

        self.client.force_authenticate(adult)
        for years in (12, 17):
            with self.subTest(years=years):
                rejected = self.client.patch(
                    reverse("user-profile"),
                    {"date_of_birth": _safe_birthdate(years).isoformat()},
                    format="json",
                )
                self.assertEqual(rejected.status_code, status.HTTP_400_BAD_REQUEST)
                self.assertEqual(rejected.data["date_of_birth"], [ACCOUNT_AGE_ERROR])
        adult.refresh_from_db()
        self.assertEqual(adult.date_of_birth, _safe_birthdate(40))

        updated = self.client.patch(
            reverse("user-profile"),
            {"birth_date": _safe_birthdate(19).isoformat()},
            format="json",
        )
        self.assertEqual(updated.status_code, status.HTTP_200_OK, updated.data)
        adult.refresh_from_db()
        self.assertEqual(adult.date_of_birth, _safe_birthdate(19))

        self.client.force_authenticate(teen)
        kept = self.client.patch(reverse("user-profile"), {"bio": "Still here"}, format="json")
        self.assertEqual(kept.status_code, status.HTTP_200_OK, kept.data)
        teen.refresh_from_db()
        self.assertEqual(teen.bio, "Still here")
        self.assertEqual(teen.date_of_birth, _safe_birthdate(16))
        self.assertTrue(User.objects.filter(email="teen@example.com").exists())

        resent = self.client.patch(
            reverse("user-profile"),
            {"date_of_birth": _safe_birthdate(16).isoformat()},
            format="json",
        )
        self.assertEqual(resent.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(resent.data["date_of_birth"], [ACCOUNT_AGE_ERROR])
        teen.refresh_from_db()
        self.assertEqual(teen.date_of_birth, _safe_birthdate(16))


class HouseholdAdultRefusalTests(APITestCase):
    def setUp(self):
        self.parent = User.objects.create_user(
            username="parent",
            email="parent@example.com",
            password=PW,
            date_of_birth=_safe_birthdate(35),
        )
        self.client.force_authenticate(self.parent)

    def test_eighteen_and_older_cannot_be_added_as_children(self):
        for years in (18, 30):
            with self.subTest(years=years):
                response = self.client.post(
                    reverse("household"),
                    {
                        "name": f"Grown {years}",
                        "date_of_birth": _safe_birthdate(years).isoformat(),
                        "sex": "female",
                    },
                    format="json",
                )
                self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
                self.assertEqual(response.data["date_of_birth"], HOUSEHOLD_ADULT_ERROR)

        month_only = self.client.post(
            reverse("household"),
            {"name": "Older", "birth_month": 1, "birth_year": _safe_birthdate(25).year},
            format="json",
        )
        self.assertEqual(month_only.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(month_only.data["date_of_birth"], HOUSEHOLD_ADULT_ERROR)
        self.assertEqual(self.parent.household_dependents.count(), 0)

        child = self.client.post(
            reverse("household"),
            {"name": "Teen Kid", "date_of_birth": _safe_birthdate(17).isoformat(), "sex": "male"},
            format="json",
        )
        self.assertEqual(child.status_code, status.HTTP_201_CREATED, child.data)
        aged_up = self.client.patch(
            reverse("household-delete", args=[child.data["id"]]),
            {"date_of_birth": _safe_birthdate(18).isoformat()},
            format="json",
        )
        self.assertEqual(aged_up.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(aged_up.data["date_of_birth"], HOUSEHOLD_ADULT_ERROR)
        self.assertEqual(self.parent.household_dependents.count(), 1)
