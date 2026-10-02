"""Terms at sign-up, public app config and the /terms page."""

from unittest.mock import patch

from django.core.cache import cache
from django.test import override_settings
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from users.models import SocialAuthIdentity, User

PW = "SuperSecret-123"


def _register_body(**extra):
    body = {
        "username": "newbie",
        "email": "newbie@example.com",
        "password": PW,
        "password_confirm": PW,
    }
    body.update(extra)
    return body


class RegisterTermsTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.url = reverse("user-register")

    def test_older_clients_without_flags_still_register_with_nothing_stamped(self):
        response = self.client.post(self.url, _register_body(), format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        user = User.objects.get(email="newbie@example.com")
        self.assertIsNone(user.terms_accepted_at)
        self.assertIsNone(user.privacy_accepted_at)
        self.assertEqual((user.terms_version, user.privacy_version), ("", ""))

    def test_flags_and_versions_are_stamped(self):
        response = self.client.post(
            self.url,
            _register_body(
                terms_accepted=True,
                privacy_accepted=True,
                terms_version="2026-10-01",
                privacy_version="2026-10-02",
            ),
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        user = User.objects.get(email="newbie@example.com")
        self.assertIsNotNone(user.terms_accepted_at)
        self.assertIsNotNone(user.privacy_accepted_at)
        self.assertEqual(user.terms_version, "2026-10-01")
        self.assertEqual(user.privacy_version, "2026-10-02")
        self.assertTrue(response.data["user"]["termsAcceptedAt"])
        # None of the acceptance fields are echoed back as plain registration fields.
        self.assertNotIn("terms_version", response.data["user"])

    def test_camel_case_flags_work(self):
        response = self.client.post(
            self.url,
            _register_body(termsAccepted=True, privacyAccepted=True, termsVersion="v1"),
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        user = User.objects.get(email="newbie@example.com")
        self.assertIsNotNone(user.terms_accepted_at)
        self.assertEqual(user.terms_version, "v1")

    def test_only_terms_accepted_stamps_only_terms(self):
        self.client.post(self.url, _register_body(terms_accepted=True), format="json")
        user = User.objects.get(email="newbie@example.com")
        self.assertIsNotNone(user.terms_accepted_at)
        self.assertIsNone(user.privacy_accepted_at)

    def test_false_flags_do_not_stamp(self):
        self.client.post(
            self.url, _register_body(terms_accepted=False, privacy_accepted=False), format="json"
        )
        user = User.objects.get(email="newbie@example.com")
        self.assertIsNone(user.terms_accepted_at)

    @override_settings(REQUIRE_TERMS_ON_REGISTER=True)
    def test_required_setting_rejects_missing_acceptance(self):
        response = self.client.post(self.url, _register_body(), format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("terms_accepted", response.data)
        self.assertIn("privacy_accepted", response.data)
        self.assertFalse(User.objects.filter(email="newbie@example.com").exists())
        partial = self.client.post(self.url, _register_body(terms_accepted=True), format="json")
        self.assertEqual(partial.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertNotIn("terms_accepted", partial.data)
        self.assertIn("privacy_accepted", partial.data)

    @override_settings(REQUIRE_TERMS_ON_REGISTER=True)
    def test_required_setting_accepts_full_acceptance(self):
        response = self.client.post(
            self.url, _register_body(terms_accepted=True, privacy_accepted=True), format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_setting_defaults_to_off(self):
        from django.conf import settings

        self.assertFalse(settings.REQUIRE_TERMS_ON_REGISTER)


@override_settings(APPLE_OAUTH_AUDIENCES=["com.irlobby.app"])
class SocialTermsTests(APITestCase):
    def setUp(self):
        cache.clear()

    @patch("users.oauth_views.verify_apple_identity_token")
    def test_apple_login_stamps_flags_when_sent(self, verify):
        verify.return_value = {"sub": "apple-1"}
        response = self.client.post(
            reverse("apple_mobile_login"),
            {
                "identity_token": "t",
                "terms_accepted": True,
                "privacy_accepted": True,
                "terms_version": "v3",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        user = SocialAuthIdentity.objects.get(provider_user_id="apple-1").user
        self.assertIsNotNone(user.terms_accepted_at)
        self.assertIsNotNone(user.privacy_accepted_at)
        self.assertEqual(user.terms_version, "v3")

    @patch("users.oauth_views.verify_apple_identity_token")
    def test_apple_login_without_flags_stamps_nothing_and_never_overwrites(self, verify):
        verify.return_value = {"sub": "apple-2"}
        self.client.post(reverse("apple_mobile_login"), {"identity_token": "t"}, format="json")
        user = SocialAuthIdentity.objects.get(provider_user_id="apple-2").user
        self.assertIsNone(user.terms_accepted_at)
        self.client.post(
            reverse("apple_mobile_login"),
            {"identity_token": "t", "terms_accepted": "true", "terms_version": "a"},
            format="json",
        )
        user.refresh_from_db()
        first = user.terms_accepted_at
        self.assertIsNotNone(first)
        self.assertIsNone(user.privacy_accepted_at)
        self.client.post(
            reverse("apple_mobile_login"),
            {"identity_token": "t", "terms_accepted": True, "terms_version": "b"},
            format="json",
        )
        user.refresh_from_db()
        self.assertEqual(user.terms_accepted_at, first)
        self.assertEqual(user.terms_version, "a")

    @override_settings(GOOGLE_OAUTH_CLIENT_IDS=["gid"])
    @patch("users.oauth_views.verify_google_identity_token")
    def test_google_login_stamps_flags_when_sent(self, verify):
        verify.return_value = {"sub": "g-1", "email": "g1@example.com", "email_verified": True}
        response = self.client.post(
            reverse("google_mobile_login"),
            {"id_token": "a.b.c", "terms_accepted": True, "privacy_accepted": True},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        user = User.objects.get(email="g1@example.com")
        self.assertIsNotNone(user.terms_accepted_at)
        self.assertIsNotNone(user.privacy_accepted_at)

    @override_settings(REQUIRE_TERMS_ON_REGISTER=True)
    @patch("users.oauth_views.verify_apple_identity_token")
    def test_required_setting_only_applies_to_register(self, verify):
        verify.return_value = {"sub": "apple-3"}
        response = self.client.post(
            reverse("apple_mobile_login"), {"identity_token": "t"}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)


class AppConfigTests(APITestCase):
    def test_defaults_need_no_auth(self):
        response = self.client.get(reverse("app-config"))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            response.data,
            {
                "terms_url": "https://irlobby.com/terms",
                "privacy_url": "https://irlobby.com/privacy",
                "support_email": "support@irlobby.com",
                "church_admin": None,
            },
        )

    def test_url_is_api_config(self):
        self.assertEqual(reverse("app-config"), "/api/config/")

    @override_settings(
        FOYER_SUPPORT_EMAIL="help@example.org",
        FOYER_TERMS_URL="https://example.org/t",
        FOYER_PRIVACY_URL="https://example.org/p",
        FOYER_CHURCH_ADMIN_CONTACT_NAME="Pastor Rob",
        FOYER_CHURCH_ADMIN_CONTACT_EMAIL="rob@example.org",
        FOYER_CHURCH_ADMIN_PHONE="+12155550100",
    )
    def test_configured_values(self):
        data = self.client.get(reverse("app-config")).data
        self.assertEqual(data["support_email"], "help@example.org")
        self.assertEqual(data["terms_url"], "https://example.org/t")
        self.assertEqual(data["privacy_url"], "https://example.org/p")
        self.assertEqual(
            data["church_admin"],
            {"name": "Pastor Rob", "email": "rob@example.org", "phone": "+12155550100"},
        )

    @override_settings(FOYER_CHURCH_ADMIN_CONTACT_EMAIL="rob@example.org")
    def test_partial_church_admin_has_null_fields(self):
        data = self.client.get(reverse("app-config")).data
        self.assertEqual(
            data["church_admin"], {"name": None, "email": "rob@example.org", "phone": None}
        )

    @override_settings(FOYER_TERMS_URL="", FOYER_SUPPORT_EMAIL="  ")
    def test_blank_strings_become_null(self):
        data = self.client.get(reverse("app-config")).data
        self.assertIsNone(data["terms_url"])
        self.assertIsNone(data["support_email"])

    def test_works_with_a_bad_token_header(self):
        response = self.client.get(reverse("app-config"), HTTP_AUTHORIZATION="Bearer nope")
        self.assertEqual(response.status_code, status.HTTP_200_OK)


class TermsPageTests(APITestCase):
    def test_terms_is_served_like_privacy(self):
        for name in ("terms-of-use", "terms-of-use-slash"):
            response = self.client.get(reverse(name))
            self.assertEqual(response.status_code, status.HTTP_200_OK)
            self.assertIn("text/html", response["Content-Type"])
            self.assertEqual(response["Cache-Control"], "public, max-age=300")
        privacy = self.client.get(reverse("privacy-policy"))
        self.assertEqual(privacy["Cache-Control"], "public, max-age=300")

    def test_placeholder_is_clearly_marked(self):
        body = self.client.get("/terms").content.decode()
        self.assertIn("PLACEHOLDER", body)
        self.assertIn("Terms of Use", body)

    def test_urls_are_not_swallowed_by_the_spa_catch_all(self):
        self.assertEqual(reverse("terms-of-use"), "/terms")
