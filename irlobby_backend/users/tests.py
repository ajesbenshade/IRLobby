from datetime import date, timedelta
from unittest.mock import Mock, patch
from urllib.parse import parse_qs, urlparse

import jwt
from axes.models import AccessAttempt, AccessFailureLog, AccessLog
from django.conf import settings
from django.core import mail
from django.core.cache import cache
from django.test import override_settings
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import (
    APIRequestFactory,
    APITestCase,
)
from rest_framework.test import (
    force_authenticate as force_request_authenticate,
)
from rest_framework_simplejwt.tokens import RefreshToken

from activities.models import Activity, ActivityParticipant, Ticket, TicketRedemptionLog
from matches.models import Match
from reviews.models import Review
from swipes.models import Swipe
from swipes.throttles import _swipe_daily_key
from users.models import PushDeviceToken, SocialAuthIdentity, User
from users.password_reset import hash_password_reset_token
from users.push_notifications import send_push_to_user
from users.social_auth import get_google_oauth_client_ids, verify_apple_identity_token
from users.views import logout_view


def extract_reset_token(message_body):
    marker = "reset-password/"
    assert marker in message_body
    return message_body.split(marker, 1)[1].split()[0]


@override_settings(
    AXES_ENABLED=True,
    AXES_FAILURE_LIMIT=2,
    AXES_COOLOFF_TIME=timedelta(minutes=15),
    AXES_LOCKOUT_PARAMETERS=[["username", "ip_address"]],
    REST_FRAMEWORK={
        "DEFAULT_THROTTLE_RATES": {
            "auth_anon": "100/min",
            "auth_user": "100/min",
        }
    },
)
class LoginAbusePreventionTests(APITestCase):
    def setUp(self):
        cache.clear()
        AccessAttempt.objects.all().delete()
        AccessFailureLog.objects.all().delete()
        AccessLog.objects.all().delete()
        self.user = User.objects.create_user(
            username="login-abuse-user",
            email="login-abuse@example.com",
            password="password123",
        )
        self.url = reverse("user-login")

    def post_login(self, password):
        return self.client.post(
            self.url,
            {"email": self.user.email, "password": password},
            format="json",
            REMOTE_ADDR="203.0.113.55",
            HTTP_USER_AGENT="IRLobby test client",
        )

    def test_repeated_failed_login_attempts_lock_out_endpoint(self):
        first_response = self.post_login("wrong-password")
        second_response = self.post_login("wrong-password")
        locked_response = self.post_login("password123")

        self.assertEqual(first_response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(second_response.status_code, status.HTTP_429_TOO_MANY_REQUESTS)
        self.assertEqual(second_response.json()["error_code"], "login_locked")
        self.assertEqual(locked_response.status_code, status.HTTP_429_TOO_MANY_REQUESTS)

    def test_successful_login_resets_failed_attempts(self):
        failed_response = self.post_login("wrong-password")
        success_response = self.post_login("password123")

        self.assertEqual(failed_response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(success_response.status_code, status.HTTP_200_OK)
        self.assertFalse(AccessAttempt.objects.exists())


class PasswordResetRequestTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="request-user",
            email="request@example.com",
            password="password123",
        )
        self.url = reverse("request-password-reset")

    def test_request_sets_hashed_token_and_sends_email(self):
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
        emailed_token = extract_reset_token(sent.body)
        self.assertNotEqual(self.user.password_reset_token, emailed_token)
        self.assertEqual(self.user.password_reset_token, hash_password_reset_token(emailed_token))

    def test_new_request_invalidates_previous_reset_token(self):
        mail.outbox = []

        first_response = self.client.post(self.url, {"email": self.user.email}, format="json")
        self.assertEqual(first_response.status_code, status.HTTP_200_OK)
        first_token = extract_reset_token(mail.outbox[-1].body)

        second_response = self.client.post(self.url, {"email": self.user.email}, format="json")
        self.assertEqual(second_response.status_code, status.HTTP_200_OK)
        second_token = extract_reset_token(mail.outbox[-1].body)

        self.assertNotEqual(first_token, second_token)
        self.user.refresh_from_db()
        self.assertEqual(self.user.password_reset_token, hash_password_reset_token(second_token))

    def test_request_with_unknown_email_still_returns_200_but_no_mail(self):
        mail.outbox = []
        response = self.client.post(
            self.url,
            {"email": "doesnotexist@example.com"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(mail.outbox), 0)


class ReliabilitySummaryTests(APITestCase):
    def setUp(self):
        self.host = User.objects.create_user(
            username="reliable-host", email="reliable@example.com", password="password123"
        )
        self.reviewer = User.objects.create_user(
            username="reliability-reviewer",
            email="reliability-reviewer@example.com",
            password="password123",
        )
        self.activity = Activity.objects.create(
            host=self.host,
            is_approved=True,
            title="Reliability Activity",
            description="Test",
            location="Location",
            latitude=40.0,
            longitude=-74.0,
            time=timezone.now() - timedelta(hours=2),
            capacity=10,
            tags=[],
            images=[],
        )

    def test_profile_includes_review_and_ticket_reliability(self):
        Review.objects.create(
            reviewer=self.reviewer,
            reviewee=self.host,
            activity=self.activity,
            rating=5,
        )
        ticket = Ticket.objects.create(
            buyer=self.reviewer,
            activity=self.activity,
            status="paid",
        )
        TicketRedemptionLog.objects.create(
            ticket=ticket,
            activity=self.activity,
            host=self.host,
            successful=True,
            status="used",
        )

        self.client.force_authenticate(self.host)
        response = self.client.get(reverse("user-profile"))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        reliability = response.data["reliability"]
        self.assertEqual(reliability["score"], 100)
        self.assertEqual(reliability["label"], "Highly reliable")
        self.assertEqual(reliability["reviewCount"], 1)
        self.assertEqual(reliability["averageRating"], 5.0)
        self.assertEqual(reliability["ticketValidationRate"], 100)


class ProfileSwipeQuotaTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.user = User.objects.create_user(
            username="quota-user", email="quota@example.com", password="password123"
        )
        self.host = User.objects.create_user(
            username="quota-host", email="quota-host@example.com", password="password123"
        )
        self.activity = Activity.objects.create(
            host=self.host,
            is_approved=True,
            title="Quota Activity",
            description="Test",
            location="Location",
            latitude=40.0,
            longitude=-74.0,
            time=timezone.now() + timedelta(days=1),
            capacity=10,
            tags=[],
            images=[],
        )

    def get_profile(self):
        self.client.force_authenticate(self.user)
        return self.client.get(reverse("user-profile"))

    @override_settings(SWIPE_DAILY_LIMIT=5)
    def test_profile_includes_swipes_remaining_today(self):
        response = self.get_profile()

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["swipes_remaining_today"], 5)
        self.assertEqual(response.data["swipesRemainingToday"], 5)

    @override_settings(SWIPE_DAILY_LIMIT=5)
    def test_profile_swipes_remaining_decreases_after_successful_swipe(self):
        self.client.force_authenticate(self.user)
        swipe_response = self.client.post(
            reverse("swipe-activity", args=[self.activity.pk]),
            {"direction": "right"},
            format="json",
        )
        profile_response = self.client.get(reverse("user-profile"))

        self.assertEqual(swipe_response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(profile_response.data["swipes_remaining_today"], 4)
        self.assertEqual(profile_response.data["swipesRemainingToday"], 4)

    @override_settings(SWIPE_DAILY_LIMIT=5)
    def test_profile_swipes_remaining_does_not_go_negative(self):
        cache.set(_swipe_daily_key(self.user), 9, timeout=60)

        response = self.get_profile()

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["swipes_remaining_today"], 0)
        self.assertEqual(response.data["swipesRemainingToday"], 0)

    @override_settings(SWIPE_DAILY_LIMIT=0)
    def test_profile_swipes_remaining_is_null_when_unlimited(self):
        response = self.get_profile()

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIsNone(response.data["swipes_remaining_today"])
        self.assertIsNone(response.data["swipesRemainingToday"])


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
                "birth_date": "1990-01-15",
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

    @override_settings(
        TWITTER_CLIENT_ID="twitter-client-id",
        TWITTER_CLIENT_SECRET="twitter-client-secret",
    )
    @patch("users.oauth_views.requests.get")
    @patch("users.oauth_views.exchange_twitter_token")
    def test_mobile_callback_handles_existing_username_collision(
        self,
        mock_exchange_twitter_token,
        mock_requests_get,
    ):
        User.objects.create_user(
            username="irlobbytester",
            email="existing@example.com",
            password="password123",
        )
        cache.set(
            "twitter_oauth_collision-state",
            {
                "code_verifier": "test-verifier",
                "redirect_uri": "http://testserver/api/auth/twitter/callback/",
                "mobile_redirect_uri": "irlobby://auth/twitter",
                "birth_date": "1990-01-15",
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
                        "id": "twitter-user-id-collision",
                        "username": "irlobbytester",
                        "name": "IR Lobby",
                    }
                }
            ),
        )

        response = self.client.get(
            self.callback_url,
            {"code": "oauth-code", "state": "collision-state"},
        )

        self.assertEqual(response.status_code, status.HTTP_302_FOUND)
        self.assertTrue(
            SocialAuthIdentity.objects.filter(
                provider="twitter",
                provider_user_id="twitter-user-id-collision",
            ).exists()
        )
        created_user = SocialAuthIdentity.objects.get(
            provider="twitter",
            provider_user_id="twitter-user-id-collision",
        ).user
        self.assertNotEqual(created_user.email, "existing@example.com")
        self.assertNotEqual(created_user.username, "irlobbytester")

    def test_callback_rejects_expired_state(self):
        response = self.client.get(
            self.callback_url,
            {"code": "oauth-code", "state": "missing-state"},
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["error"], "Session expired or invalid state")


class SocialMobileLoginTests(APITestCase):
    def setUp(self):
        self.google_url = reverse("google_mobile_login")
        self.apple_url = reverse("apple_mobile_login")

    @override_settings(GOOGLE_OAUTH_CLIENT_IDS=["google-client-id"])
    @patch("users.oauth_views.verify_google_identity_token")
    def test_google_mobile_login_links_existing_email(self, mock_verify_google_identity_token):
        user = User.objects.create_user(
            username="existing-user",
            email="existing@example.com",
            password="password123",
            birth_date=date(1990, 1, 15),
        )
        mock_verify_google_identity_token.return_value = {
            "sub": "google-sub-123",
            "email": "existing@example.com",
            "email_verified": True,
            "given_name": "Existing",
            "family_name": "User",
        }

        response = self.client.post(
            self.google_url, {"id_token": "aaa.bbb.ccc"}, format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["user"]["email"], user.email)
        self.assertTrue(
            SocialAuthIdentity.objects.filter(
                provider="google",
                provider_user_id="google-sub-123",
                user=user,
            ).exists()
        )

    @override_settings(GOOGLE_OAUTH_CLIENT_IDS=["", "   "], ALLOWED_HOSTS=["testserver"])
    @patch("users.oauth_views.verify_google_identity_token")
    def test_google_mobile_login_rejects_blank_config(self, mock_verify_google_identity_token):
        with patch("django.core.handlers.base.log_response"):
            response = self.client.post(
                self.google_url, {"id_token": "google-token"}, format="json"
            )

        self.assertEqual(response.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)
        self.assertEqual(response.data["error"], "Google OAuth is not configured.")
        mock_verify_google_identity_token.assert_not_called()

    def test_google_mobile_login_rejects_missing_token(self):
        response = self.client.post(self.google_url, {}, format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["error"], "Google identity token is required.")

    @override_settings(GOOGLE_OAUTH_CLIENT_IDS=["google-client-id"])
    @patch("users.oauth_views.verify_google_identity_token")
    def test_google_mobile_login_rejects_malformed_token(
        self, mock_verify_google_identity_token
    ):
        response = self.client.post(
            self.google_url, {"id_token": "ya29.access-token-not-a-jwt"}, format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("malformed", response.data["error"])
        mock_verify_google_identity_token.assert_not_called()

    @override_settings(
        GOOGLE_OAUTH_CLIENT_IDS=[],
        GOOGLE_CLIENT_IDS=[],
        GOOGLE_IOS_CLIENT_ID="ios.apps.googleusercontent.com",
        GOOGLE_WEB_CLIENT_ID="web.apps.googleusercontent.com",
        GOOGLE_ANDROID_CLIENT_ID="android.apps.googleusercontent.com",
    )
    def test_google_oauth_client_ids_include_platform_aliases(self):
        self.assertEqual(
            get_google_oauth_client_ids(),
            [
                "ios.apps.googleusercontent.com",
                "android.apps.googleusercontent.com",
                "web.apps.googleusercontent.com",
            ],
        )

    @override_settings(GOOGLE_OAUTH_CLIENT_IDS=["allowed-client.apps.googleusercontent.com"])
    def test_google_mobile_login_reports_audience_mismatch(self):
        token = jwt.encode(
            {
                "aud": "ios-client.apps.googleusercontent.com",
                "sub": "google-sub",
                "iss": "https://accounts.google.com",
                "email": "aaron@example.com",
                "email_verified": True,
                "exp": 4102444800,
                "iat": 1700000000,
            },
            "secret",
            algorithm="HS256",
        )
        if isinstance(token, bytes):
            token = token.decode("utf-8")

        response = self.client.post(self.google_url, {"id_token": token}, format="json")

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertIn("ios-client.apps.googleusercontent.com", response.data["error"])
        self.assertIn("GOOGLE_OAUTH_CLIENT_IDS", response.data["error"])

    @override_settings(GOOGLE_OAUTH_CLIENT_IDS=["google-client-id"])
    @patch("users.oauth_views.verify_google_identity_token")
    def test_google_mobile_login_rejects_different_identity_for_same_user(
        self,
        mock_verify_google_identity_token,
    ):
        user = User.objects.create_user(
            username="linked-user",
            email="linked@example.com",
            password="password123",
            birth_date=date(1990, 1, 15),
        )
        SocialAuthIdentity.objects.create(
            user=user,
            provider="google",
            provider_user_id="existing-google-sub",
            email=user.email,
        )
        mock_verify_google_identity_token.return_value = {
            "sub": "new-google-sub",
            "email": user.email,
            "email_verified": True,
        }

        response = self.client.post(
            self.google_url, {"id_token": "aaa.bbb.ccc"}, format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)
        self.assertEqual(
            response.data["error"],
            "This account is already linked to a different google identity.",
        )
        self.assertFalse(
            SocialAuthIdentity.objects.filter(
                provider="google",
                provider_user_id="new-google-sub",
            ).exists()
        )

    @override_settings(APPLE_OAUTH_AUDIENCES=["com.irlobby.app"])
    @patch("users.oauth_views.verify_apple_identity_token")
    def test_apple_mobile_login_creates_user_without_email(self, mock_verify_apple_identity_token):
        mock_verify_apple_identity_token.return_value = {
            "sub": "apple-sub-123",
        }

        response = self.client.post(
            self.apple_url,
            {
                "identity_token": "apple-token",
                "first_name": "Apple",
                "last_name": "User",
                "birth_date": "1990-01-15",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(
            SocialAuthIdentity.objects.filter(
                provider="apple",
                provider_user_id="apple-sub-123",
            ).exists()
        )
        created_user = SocialAuthIdentity.objects.get(
            provider="apple",
            provider_user_id="apple-sub-123",
        ).user
        self.assertTrue(created_user.email.endswith("@apple.oauth.local"))
        self.assertEqual(created_user.first_name, "Apple")
        self.assertEqual(created_user.last_name, "User")

    @override_settings(APPLE_OAUTH_AUDIENCES=["com.irlobby.app"])
    @patch("users.social_auth.jwt.get_unverified_header")
    def test_apple_identity_token_rejects_unexpected_algorithm(self, mock_get_unverified_header):
        mock_get_unverified_header.return_value = {"kid": "apple-key", "alg": "HS256"}

        with self.assertRaisesMessage(ValueError, "Unexpected Apple token algorithm"):
            verify_apple_identity_token("apple-token")


class PasswordResetConfirmTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.user = User.objects.create_user(
            username="reset-user",
            email="reset@example.com",
            password="password123",
        )
        self.url = reverse("password-reset-confirm")

    def _set_token(self, token="reset-token", created_at=None):
        self.user.password_reset_token = hash_password_reset_token(token)
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
        other_user.password_reset_token = hash_password_reset_token(token_value)
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

    def test_password_reset_rejects_plaintext_legacy_token_storage(self):
        User.objects.filter(id=self.user.id).update(
            password_reset_token="legacy-plaintext-token",
            token_created_at=timezone.now(),
        )

        response = self.client.post(
            self.url,
            {"token": "legacy-plaintext-token", "new_password": "newpass123"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.user.refresh_from_db()
        self.assertFalse(self.user.check_password("newpass123"))

    def test_password_reset_uses_django_password_validators(self):
        self._set_token()

        response = self.client.post(
            self.url,
            {"token": "reset-token", "new_password": "12345678"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("password", response.data["error"].lower())
        self.user.refresh_from_db()
        self.assertFalse(self.user.check_password("12345678"))

    def test_password_reset_does_not_reflect_untrusted_cors_origin(self):
        self._set_token()

        response = self.client.post(
            self.url,
            {"token": "reset-token", "new_password": "newpass123"},
            format="json",
            HTTP_ORIGIN="https://evil.example",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(response.has_header("Access-Control-Allow-Origin"))


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

    def test_onboarding_completion_allows_skipped_vibe_quiz_with_legal(self):
        self.client.force_authenticate(self.user)

        response = self.client.patch(
            reverse("user-onboarding"),
            {
                "activity_preferences": {"vibe": {"vibeQuizSkipped": True}},
                "terms_accepted": True,
                "privacy_accepted": True,
                "onboarding_completed": True,
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.user.refresh_from_db()
        self.assertTrue(self.user.preferences.get("onboarding_completed"))
        self.assertTrue(
            (self.user.preferences.get("activity_preferences") or {})
            .get("vibe", {})
            .get("vibeQuizSkipped")
        )
        self.assertIsNotNone(self.user.terms_accepted_at)
        self.assertIsNotNone(self.user.privacy_accepted_at)

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
        self.assertIn("terms of service", str(response.data["detail"]).lower())
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


class UserAccountWorkflowTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.user = User.objects.create_user(
            username="account-user",
            email="account@example.com",
            password="password123",
        )
        self.other = User.objects.create_user(
            username="account-other",
            email="account-other@example.com",
            password="password123",
        )

    def _activity(self, host=None):
        return Activity.objects.create(
            host=host or self.user,
            is_approved=True,
            title="Account Activity",
            description="A test activity for account data export.",
            location="Location",
            latitude=40.0,
            longitude=-74.0,
            time=timezone.now() + timedelta(days=1),
            capacity=10,
            tags=["board games"],
            images=[],
        )

    def test_register_login_auth_status_and_logout_flow(self):
        register_response = self.client.post(
            reverse("user-register"),
            {
                "username": "new-account",
                "email": "new-account@example.com",
                "password": "password123",
                "password_confirm": "password123",
                "birth_date": "1990-05-01",
                "sex": "female",
            },
            format="json",
        )
        self.assertEqual(register_response.status_code, status.HTTP_201_CREATED)
        self.assertIn("tokens", register_response.data)

        invalid_login = self.client.post(
            reverse("user-login"),
            {"email": self.user.email, "password": "wrong-password"},
            format="json",
        )
        self.assertEqual(invalid_login.status_code, status.HTTP_400_BAD_REQUEST)

        login_response = self.client.post(
            reverse("user-login"),
            {"email": self.user.email, "password": "password123"},
            format="json",
        )
        self.assertEqual(login_response.status_code, status.HTTP_200_OK)

        unauthenticated_status = self.client.get(reverse("auth-status"))
        self.assertEqual(unauthenticated_status.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertFalse(unauthenticated_status.data["authenticated"])

        self.client.force_authenticate(self.user)
        authenticated_status = self.client.get(reverse("auth-status"))
        self.assertEqual(authenticated_status.status_code, status.HTTP_200_OK)
        self.assertTrue(authenticated_status.data["authenticated"])

    def test_logout_view_clears_refresh_cookie_with_invalid_token(self):
        factory = APIRequestFactory()
        request = factory.post(
            reverse("token_logout"), {"refresh": "not-a-refresh-token"}, format="json"
        )
        force_request_authenticate(request, user=self.user)

        response = logout_view(request)

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertIn(settings.REFRESH_TOKEN_COOKIE_NAME, response.cookies)

    def test_refresh_view_uses_refresh_cookie(self):
        refresh = RefreshToken.for_user(self.user)
        self.client.cookies[settings.REFRESH_TOKEN_COOKIE_NAME] = str(refresh)

        response = self.client.post(reverse("token_refresh"), {}, format="json")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("access", response.data)
        self.assertIn(settings.REFRESH_TOKEN_COOKIE_NAME, response.cookies)

    def test_push_token_register_and_deactivate(self):
        self.client.force_authenticate(self.user)

        register_response = self.client.post(
            reverse("push-token-register"),
            {
                "token": "ExponentPushToken[account-flow]",
                "platform": "ios",
                "device_id": "device-1",
            },
            format="json",
        )
        self.assertEqual(register_response.status_code, status.HTTP_200_OK)
        self.assertTrue(PushDeviceToken.objects.filter(user=self.user, is_active=True).exists())

        deactivate_response = self.client.delete(
            reverse("push-token-deactivate"),
            {"token": "ExponentPushToken[account-flow]"},
            format="json",
        )
        self.assertEqual(deactivate_response.status_code, status.HTTP_200_OK)
        self.assertEqual(deactivate_response.data["deactivatedCount"], 1)

    def test_export_user_data_includes_related_records(self):
        hosted_activity = self._activity(host=self.user)
        joined_activity = self._activity(host=self.other)
        ActivityParticipant.objects.create(
            activity=joined_activity,
            user=self.user,
            status="confirmed",
        )
        Swipe.objects.create(user=self.user, activity=joined_activity, direction="right")
        Match.objects.create(user_a=self.user, user_b=self.other, activity=joined_activity)
        Review.objects.create(
            reviewer=self.user,
            reviewee=self.other,
            activity=joined_activity,
            rating=4,
            comment="Great plan.",
        )
        Review.objects.create(
            reviewer=self.other,
            reviewee=self.user,
            activity=hosted_activity,
            rating=5,
            comment="Great host.",
        )

        self.client.force_authenticate(self.user)
        response = self.client.get(reverse("export-user-data"))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.json()["hosted_activities"][0]["title"], hosted_activity.title)
        self.assertEqual(response.json()["activity_participations"][0]["status"], "confirmed")
        self.assertEqual(response.json()["swipes"][0]["direction"], "right")
        self.assertEqual(response.json()["matches"][0]["other_user"]["id"], self.other.id)
        self.assertEqual(response.json()["reviews_given"][0]["rating"], 4)
        self.assertEqual(response.json()["reviews_received"][0]["rating"], 5)

    def test_delete_profile_removes_authenticated_user(self):
        self.client.force_authenticate(self.user)

        response = self.client.delete(reverse("delete-profile"))

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(User.objects.filter(id=self.user.id).exists())


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


class SeedReviewAccountTests(APITestCase):
    def test_seeds_review_account_with_content_visible_from_any_location(self):
        from django.core.management import call_command

        from chat.models import Conversation

        call_command("seed_review_account", password="Review-pass-123")
        # Re-running must be idempotent and keep dates in the future.
        call_command("seed_review_account", password="Review-pass-123")

        reviewer = User.objects.get(email="app-review@irlobby.com")
        self.assertTrue(reviewer.check_password("Review-pass-123"))
        self.assertTrue(reviewer.preferences["onboarding_completed"])
        self.assertEqual(Match.objects.filter(user_b=reviewer).count(), 1)
        self.assertEqual(Conversation.objects.get(match__user_b=reviewer).messages.count(), 4)
        self.assertTrue(
            ActivityParticipant.objects.filter(user=reviewer, status="confirmed").exists()
        )

        # Real content elsewhere must not leak into the review feed.
        other_host = User.objects.create_user(
            username="london_host", email="london@example.com", password="x"
        )
        Activity.objects.create(
            host=other_host,
            is_approved=True,
            title="London Walk",
            description="Elsewhere",
            location="London",
            latitude=51.5,
            longitude=-0.12,
            time=timezone.now() + timedelta(days=1),
            capacity=5,
        )

        self.client.force_authenticate(reviewer)
        # Coordinates far from the seeded Cupertino content (London).
        response = self.client.get(
            reverse("activity-list"), {"latitude": 51.5, "longitude": -0.12}
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = response.data["results"] if isinstance(response.data, dict) else response.data
        self.assertEqual(len(results), 6)
        self.assertNotIn("London Walk", [item["title"] for item in results])

    def test_seed_review_account_requires_password(self):
        from django.core.management import CommandError, call_command

        with self.assertRaises(CommandError):
            call_command("seed_review_account")
