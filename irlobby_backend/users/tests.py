from datetime import timedelta
from unittest.mock import Mock, patch
from urllib.parse import parse_qs, urlparse

from django.core import mail
from django.core.cache import cache
from django.test import override_settings
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from users.models import PushDeviceToken, User
from users.push_notifications import send_push_to_user


class PasswordResetRequestTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="request-user",
            email="request@example.com",
            password="password123",
        )
        self.url = reverse("request-password-reset")

    def test_request_sets_token_and_sends_email(self):
        mail.outbox = []  # ensure empty

        response = self.client.post(
            self.url,
            {"email": self.user.email},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # user should now have a token stored
        self.user.refresh_from_db()
        self.assertIsNotNone(self.user.password_reset_token)
        self.assertIsNotNone(self.user.token_created_at)

        # email should have been queued in the backend
        self.assertEqual(len(mail.outbox), 1)
        sent = mail.outbox[0]
        self.assertIn(self.user.email, sent.to)
        self.assertIn("Password Reset", sent.subject)
        self.assertIn(self.user.password_reset_token, sent.body)

    def test_request_with_unknown_email_still_returns_200_but_no_mail(self):
        mail.outbox = []
        response = self.client.post(
            self.url,
            {"email": "doesnotexist@example.com"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(mail.outbox), 0)


class TwitterOAuthTests(APITestCase):
    def setUp(self):
        self.status_url = reverse("twitter_oauth_status")
        self.oauth_url = reverse("twitter_oauth_url")
        self.callback_url = reverse("twitter_oauth_callback")

    @override_settings(
        TWITTER_CLIENT_ID="twitter-client-id",
        TWITTER_CLIENT_SECRET="twitter-client-secret",
        FRONTEND_BASE_URL="http://localhost:5173",
    )
    def test_status_requires_client_id_and_secret(self):
        response = self.client.get(self.status_url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data["configured"])
        self.assertTrue(response.data["client_id_set"])
        self.assertTrue(response.data["client_secret_set"])

    @override_settings(
        TWITTER_CLIENT_ID="twitter-client-id",
        TWITTER_CLIENT_SECRET="",
        FRONTEND_BASE_URL="http://localhost:5173",
    )
    def test_status_reports_incomplete_credentials(self):
        response = self.client.get(self.status_url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(response.data["configured"])
        self.assertTrue(response.data["client_id_set"])
        self.assertFalse(response.data["client_secret_set"])

    @override_settings(
        TWITTER_CLIENT_ID="twitter-client-id",
        TWITTER_CLIENT_SECRET="twitter-client-secret",
    )
    def test_oauth_url_rejects_invalid_mobile_redirect_uri(self):
        response = self.client.get(
            self.oauth_url,
            {"mobile_redirect_uri": "https://example.com/not-mobile"},
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["error"], "Invalid mobile redirect URI.")

    @override_settings(
        TWITTER_CLIENT_ID="twitter-client-id",
        TWITTER_CLIENT_SECRET="twitter-client-secret",
    )
    @patch("users.oauth_views.requests.get")
    @patch("users.oauth_views.exchange_twitter_token")
    def test_mobile_callback_redirects_back_to_app_with_tokens(
        self,
        mock_exchange_twitter_token,
        mock_requests_get,
    ):
        cache.set(
            "twitter_oauth_mobile-state",
            {
                "code_verifier": "test-verifier",
                "redirect_uri": "http://testserver/api/auth/twitter/callback/",
                "mobile_redirect_uri": "irlobby://auth/twitter",
            },
            timeout=600,
        )

        mock_exchange_twitter_token.return_value = Mock(
            status_code=200,
            json=Mock(return_value={"access_token": "twitter-access-token"}),
            text='{"access_token":"twitter-access-token"}',
            headers={"content-type": "application/json"},
        )
        mock_requests_get.return_value = Mock(
            status_code=200,
            json=Mock(
                return_value={
                    "data": {
                        "id": "twitter-user-id",
                        "username": "irlobbytester",
                        "name": "IR Lobby",
                    }
                }
            ),
        )

        response = self.client.get(
            self.callback_url,
            {"code": "oauth-code", "state": "mobile-state"},
        )

        self.assertEqual(response.status_code, status.HTTP_302_FOUND)
        parsed_redirect = urlparse(response.url)
        self.assertEqual(parsed_redirect.scheme, "irlobby")
        self.assertEqual(parsed_redirect.netloc, "auth")
        self.assertEqual(parsed_redirect.path, "/twitter")

        params = parse_qs(parsed_redirect.query)
        self.assertIn("access", params)
        self.assertIn("refresh", params)
        self.assertIn("user", params)
        self.assertEqual(params["created"], ["true"])
        self.assertTrue(User.objects.filter(oauth_id="twitter-user-id").exists())

    def test_callback_rejects_expired_state(self):
        response = self.client.get(
            self.callback_url,
            {"code": "oauth-code", "state": "missing-state"},
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["error"], "Session expired or invalid state")


class PasswordResetConfirmTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="reset-user",
            email="reset@example.com",
            password="password123",
        )
        self.url = reverse("password-reset-confirm")

    def _set_token(self, token="reset-token", created_at=None):
        self.user.password_reset_token = token
        self.user.token_created_at = created_at or timezone.now()
        self.user.save(update_fields=["password_reset_token", "token_created_at"])

    def test_password_reset_success_clears_token(self):
        self._set_token()

        response = self.client.post(
            self.url,
            {"token": "reset-token", "new_password": "newpass123"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.user.refresh_from_db()
        self.assertIsNone(self.user.password_reset_token)
        self.assertIsNone(self.user.token_created_at)
        self.assertTrue(self.user.check_password("newpass123"))

    def test_password_reset_rejects_expired_token(self):
        expired_time = timezone.now() - timedelta(hours=3)
        self._set_token(created_at=expired_time)

        response = self.client.post(
            self.url,
            {"token": "reset-token", "new_password": "newpass123"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.user.refresh_from_db()
        self.assertIsNone(self.user.password_reset_token)
        self.assertIsNone(self.user.token_created_at)

    def test_password_reset_missing_timestamp(self):
        self._set_token()
        User.objects.filter(id=self.user.id).update(token_created_at=None)

        response = self.client.post(
            self.url,
            {"token": "reset-token", "new_password": "newpass123"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.user.refresh_from_db()
        self.assertIsNone(self.user.password_reset_token)
        self.assertIsNone(self.user.token_created_at)

    def test_password_reset_handles_duplicate_tokens(self):
        token_value = "duplicate-token"
        self._set_token(token=token_value)

        other_user = User.objects.create_user(
            username="other-user",
            email="other@example.com",
            password="password123",
        )
        other_user.password_reset_token = token_value
        other_user.token_created_at = timezone.now()
        other_user.save(update_fields=["password_reset_token", "token_created_at"])

        response = self.client.post(
            self.url,
            {"token": token_value, "new_password": "newpass123"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.user.refresh_from_db()
        other_user.refresh_from_db()
        self.assertIsNone(self.user.password_reset_token)
        self.assertIsNone(other_user.password_reset_token)


class OnboardingAndInviteTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="onboard-user",
            email="onboard@example.com",
            password="password123",
        )
        self.other = User.objects.create_user(
            username="invitee-user",
            email="invitee@example.com",
            password="password123",
        )

    def test_onboarding_patch_updates_profile_preferences(self):
        self.client.force_authenticate(self.user)
        response = self.client.patch(
            reverse("user-onboarding"),
            {
                "bio": "Love hiking and board games",
                "avatarUrl": "https://example.com/avatar.jpg",
                "city": "Seattle",
                "interests": ["hiking", "board games"],
                "ageRange": "25-34",
                "activityPreferences": {"outdoor": True, "group_size": "small"},
                "termsAccepted": True,
                "privacyAccepted": True,
                "onboardingCompleted": True,
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.user.refresh_from_db()
        self.assertEqual(self.user.bio, "Love hiking and board games")
        self.assertEqual(self.user.location, "Seattle")
        self.assertEqual(self.user.avatar_url, "https://example.com/avatar.jpg")
        self.assertEqual(self.user.preferences.get("interests"), ["hiking", "board games"])
        self.assertEqual(self.user.preferences.get("age_range"), "25-34")
        self.assertTrue(self.user.preferences.get("onboarding_completed"))
        self.assertIsNotNone(self.user.terms_accepted_at)
        self.assertIsNotNone(self.user.privacy_accepted_at)
        self.assertTrue(response.data["legalAccepted"])

    def test_onboarding_patch_accepts_data_url_profile_photo(self):
        self.client.force_authenticate(self.user)
        image_data_url = "data:image/png;base64," + ("a" * 512)

        response = self.client.patch(
            reverse("user-onboarding"),
            {
                "bio": "Love hiking and board games",
                "avatar_url": image_data_url,
                "city": "Seattle",
                "interests": ["hiking"],
                "terms_accepted": True,
                "privacy_accepted": True,
                "onboarding_completed": True,
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.user.refresh_from_db()
        self.assertEqual(self.user.avatar_url, image_data_url)
        self.assertTrue(self.user.preferences.get("onboarding_completed"))

    def test_onboarding_completion_allows_missing_profile_photo(self):
        self.client.force_authenticate(self.user)

        response = self.client.patch(
            reverse("user-onboarding"),
            {
                "bio": "Love hiking and board games",
                "city": "Seattle",
                "interests": ["hiking"],
                "terms_accepted": True,
                "privacy_accepted": True,
                "onboarding_completed": True,
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.user.refresh_from_db()
        self.assertEqual(self.user.avatar_url, "")
        self.assertTrue(self.user.preferences.get("onboarding_completed"))

    def test_mobile_onboarding_completion_allows_bio_and_city_later(self):
        self.client.force_authenticate(self.user)
        self.user.terms_accepted_at = timezone.now()
        self.user.privacy_accepted_at = timezone.now()
        self.user.save(update_fields=["terms_accepted_at", "privacy_accepted_at"])

        response = self.client.patch(
            reverse("user-onboarding"),
            {
                "avatar_url": "https://api.dicebear.com/9.x/adventurer/png?seed=IRLobby%20Spark",
                "activity_preferences": {"low_key": True},
                "onboarding_completed": True,
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.user.refresh_from_db()
        self.assertEqual(self.user.bio, "")
        self.assertEqual(self.user.location, "")
        self.assertTrue(self.user.preferences.get("onboarding_completed"))

    def test_onboarding_patch_allows_partial_progress_without_completion(self):
        self.client.force_authenticate(self.user)
        response = self.client.patch(
            reverse("user-onboarding"),
            {
                "bio": "Testing step save",
                "city": "Austin",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.user.refresh_from_db()
        self.assertEqual(self.user.bio, "Testing step save")
        self.assertEqual(self.user.location, "Austin")
        self.assertFalse(self.user.preferences.get("onboarding_completed", False))

    def test_onboarding_completion_requires_required_fields_and_legal_acceptance(self):
        self.client.force_authenticate(self.user)
        response = self.client.patch(
            reverse("user-onboarding"),
            {
                "onboardingCompleted": True,
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("detail", response.data)
        self.user.refresh_from_db()
        self.assertFalse(self.user.preferences.get("onboarding_completed", False))
        self.assertIsNone(self.user.terms_accepted_at)
        self.assertIsNone(self.user.privacy_accepted_at)

    def test_invite_create_and_accept_flow(self):
        self.client.force_authenticate(self.user)
        create_response = self.client.post(
            reverse("invite-list-create"),
            {
                "contact_name": "Sam",
                "contact_value": "+15555550123",
                "channel": "sms",
            },
            format="json",
        )

        self.assertEqual(create_response.status_code, status.HTTP_201_CREATED)
        token = create_response.data["token"]

        resolve_response = self.client.get(reverse("invite-resolve", args=[token]))
        self.assertEqual(resolve_response.status_code, status.HTTP_200_OK)
        self.assertTrue(resolve_response.data["is_valid"])

        self.client.force_authenticate(self.other)
        accept_response = self.client.post(
            reverse("invite-accept"),
            {"token": token},
            format="json",
        )
        self.assertEqual(accept_response.status_code, status.HTTP_200_OK)
        self.assertEqual(accept_response.data["status"], "accepted")


class PushNotificationTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="push-test-user",
            email="push-test@example.com",
            password="password123",
        )
        self.user.preferences = {"notifications": {"pushNotifications": True}}
        self.user.save(update_fields=["preferences"])

    @patch("users.push_notifications.requests.post")
    def test_send_push_deactivates_device_not_registered_token(self, mock_post):
        token = PushDeviceToken.objects.create(
            user=self.user,
            token="ExponentPushToken[test-deactivate]",
            platform="ios",
            is_active=True,
        )

        mock_response = Mock()
        mock_response.ok = True
        mock_response.json.return_value = {
            "data": [
                {
                    "status": "error",
                    "details": {"error": "DeviceNotRegistered"},
                }
            ]
        }
        mock_post.return_value = mock_response

        send_push_to_user(self.user, "Test", "Body")

        token.refresh_from_db()
        self.assertFalse(token.is_active)

    @patch("users.push_notifications.requests.post")
    def test_send_push_keeps_token_active_on_success(self, mock_post):
        token = PushDeviceToken.objects.create(
            user=self.user,
            token="ExponentPushToken[test-active]",
            platform="ios",
            is_active=True,
        )

        mock_response = Mock()
        mock_response.ok = True
        mock_response.json.return_value = {"data": [{"status": "ok", "id": "ticket-1"}]}
        mock_post.return_value = mock_response

        send_push_to_user(self.user, "Test", "Body")

        token.refresh_from_db()
        self.assertTrue(token.is_active)
