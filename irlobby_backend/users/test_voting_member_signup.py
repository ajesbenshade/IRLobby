"""Voting-member sign-up: 18+ only, attestation required, household stays under 18.

Legacy 13–17 accounts are not migrated or deleted. New ones cannot be created.
"""

from unittest.mock import patch

from django.test import override_settings
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIRequestFactory, APITestCase

from activities.household_rules import ACCOUNT_AGE_ERROR
from activities.test_foyer import _safe_birthdate
from users.apple_auth import apple_sign_in
from users.google_auth import google_sign_in
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


def _oauth_adult(**extra):
    body = {
        "date_of_birth": _safe_birthdate(28).isoformat(),
        "voting_member_attested": True,
    }
    body.update(extra)
    return body


class OAuthVotingMemberTests(APITestCase):
    def test_google_and_apple_mobile_reject_a_new_account_without_the_gate(self):
        cases = (
            (
                "google_mobile_login",
                "users.oauth_views.verify_google_identity_token",
                "id_token",
                {
                    "sub": "g-new",
                    "email": "g-new@example.com",
                    "email_verified": True,
                },
                {"GOOGLE_OAUTH_CLIENT_IDS": ["gid"]},
            ),
            (
                "apple_mobile_login",
                "users.oauth_views.verify_apple_identity_token",
                "identity_token",
                {
                    "sub": "a-new",
                },
                {"APPLE_OAUTH_AUDIENCES": ["com.irlobby.app"]},
            ),
        )
        for url_name, verify_path, token_key, claims, settings in cases:
            with self.subTest(url_name=url_name):
                with override_settings(**settings), patch(verify_path) as verify:
                    verify.return_value = claims
                    missing = self.client.post(
                        reverse(url_name), {token_key: "a.b.c"}, format="json"
                    )
                    self.assertEqual(missing.status_code, status.HTTP_400_BAD_REQUEST)
                    self.assertEqual(
                        missing.data["voting_member_attested"], [VOTING_MEMBER_ATTESTATION_ERROR]
                    )
                    self.assertEqual(missing.data["date_of_birth"], [ACCOUNT_AGE_ERROR])
                    young = self.client.post(
                        reverse(url_name),
                        _oauth_adult(
                            **{
                                token_key: "a.b.c",
                                "date_of_birth": _safe_birthdate(16).isoformat(),
                            }
                        ),
                        format="json",
                    )
                    self.assertEqual(young.status_code, status.HTTP_400_BAD_REQUEST)
                    self.assertEqual(young.data["date_of_birth"], [ACCOUNT_AGE_ERROR])
                self.assertFalse(User.objects.filter(email="g-new@example.com").exists())
                self.assertFalse(User.objects.filter(email__endswith="@apple.oauth.local").exists())

    @override_settings(GOOGLE_OAUTH_CLIENT_IDS=["gid"])
    @patch("users.oauth_views.verify_google_identity_token")
    def test_google_mobile_create_stores_attestation(self, verify):
        verify.return_value = {
            "sub": "g-ok",
            "email": "g-ok@example.com",
            "email_verified": True,
        }
        before = timezone.now()
        response = self.client.post(
            reverse("google_mobile_login"),
            {
                "id_token": "a.b.c",
                "birthDate": _safe_birthdate(19).isoformat(),
                "votingMemberAttested": True,
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        user = User.objects.get(email="g-ok@example.com")
        self.assertEqual(user.date_of_birth, _safe_birthdate(19))
        self.assertIsNotNone(user.voting_member_attested_at)
        self.assertGreaterEqual(user.voting_member_attested_at, before)
        self.assertTrue(response.data["created"])
        again = self.client.post(
            reverse("google_mobile_login"), {"id_token": "a.b.c"}, format="json"
        )
        self.assertEqual(again.status_code, status.HTTP_200_OK, again.data)
        self.assertFalse(again.data["created"])

    @override_settings(APPLE_OAUTH_AUDIENCES=["com.irlobby.app"])
    @patch("users.oauth_views.verify_apple_identity_token")
    def test_apple_mobile_create_stores_attestation(self, verify):
        verify.return_value = {"sub": "a-ok", "email": "a-ok@example.com"}
        response = self.client.post(
            reverse("apple_mobile_login"),
            _oauth_adult(identity_token="t"),
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        user = User.objects.get(email="a-ok@example.com")
        self.assertEqual(user.date_of_birth, _safe_birthdate(28))
        self.assertIsNotNone(user.voting_member_attested_at)

    def test_web_sign_in_views_use_the_same_gate(self):
        factory = APIRequestFactory()
        google_claims = {
            "sub": "web-g",
            "email": "web-g@example.com",
            "email_verified": True,
            "given_name": "Web",
            "family_name": "Google",
        }
        with (
            override_settings(GOOGLE_CLIENT_IDS="web-client"),
            patch("users.google_auth.verify_google_identity_token", return_value=google_claims),
        ):
            request = factory.post("/", {"identity_token": "t"}, format="json")
            missing = google_sign_in(request)
            self.assertEqual(missing.status_code, status.HTTP_400_BAD_REQUEST)
            self.assertEqual(missing.data["date_of_birth"], [ACCOUNT_AGE_ERROR])
            created = google_sign_in(
                factory.post("/", _oauth_adult(identity_token="t"), format="json")
            )
            self.assertEqual(created.status_code, status.HTTP_200_OK, created.data)
        user = User.objects.get(email="web-g@example.com")
        self.assertIsNotNone(user.voting_member_attested_at)
        self.assertEqual(user.date_of_birth, _safe_birthdate(28))

        apple_claims = {"sub": "web-a", "email": "web-a@example.com"}
        with (
            override_settings(APPLE_CLIENT_ID="com.irlobby.web"),
            patch("users.apple_auth.verify_apple_identity_token", return_value=apple_claims),
        ):
            young = apple_sign_in(
                factory.post(
                    "/",
                    _oauth_adult(
                        identity_token="t",
                        date_of_birth=_safe_birthdate(15).isoformat(),
                    ),
                    format="json",
                )
            )
            self.assertEqual(young.status_code, status.HTTP_400_BAD_REQUEST)
            self.assertEqual(young.data["date_of_birth"], [ACCOUNT_AGE_ERROR])
            self.assertFalse(User.objects.filter(email="web-a@example.com").exists())
            created = apple_sign_in(
                factory.post("/", _oauth_adult(identity_token="t"), format="json")
            )
            self.assertEqual(created.status_code, status.HTTP_200_OK, created.data)
        apple_user = User.objects.get(email="web-a@example.com")
        self.assertIsNotNone(apple_user.voting_member_attested_at)
