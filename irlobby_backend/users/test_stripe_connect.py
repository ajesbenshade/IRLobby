from types import SimpleNamespace
from unittest.mock import Mock, patch

from django.test import override_settings
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from users.models import User
from users.stripe_connect import (
    StripeConnectError,
    assert_test_mode_api_key,
    create_connect_onboarding_link,
    get_stripe_client,
    platform_fee_amount_cents,
)


class StripeConnectHelperTests(APITestCase):
    def test_platform_fee_is_ten_percent_in_cents(self):
        self.assertEqual(platform_fee_amount_cents("25.00", 10), 250)
        self.assertEqual(platform_fee_amount_cents("10.00", 10), 100)

    @override_settings(STRIPE_API_KEY="")
    def test_get_stripe_client_requires_api_key(self):
        with self.assertRaises(StripeConnectError):
            get_stripe_client()

    @override_settings(STRIPE_ALLOW_LIVE_MODE=False)
    def test_live_keys_are_rejected(self):
        with self.assertRaises(StripeConnectError):
            assert_test_mode_api_key("sk_live_should_not_run")

    @override_settings(STRIPE_API_KEY="sk_test_123")
    def test_get_stripe_client_accepts_test_key(self):
        client = get_stripe_client()
        self.assertIsNotNone(client)

    @override_settings(
        STRIPE_API_KEY="sk_test_123",
        STRIPE_REDIRECT_BASE_URL="https://api.irlobby.com",
        STRIPE_CONNECT_RETURN_URL="irlobby://stripe/connect/return",
        STRIPE_CONNECT_REFRESH_URL="irlobby://stripe/connect/refresh",
    )
    @patch("users.stripe_connect.get_stripe_client")
    def test_onboarding_link_rewrites_app_scheme_urls(self, mock_get_client):
        host = User.objects.create_user(
            username="connect-host",
            email="connect-host@example.com",
            password="password123",
        )
        mock_client = Mock()
        mock_client.v2.core.accounts.create.return_value = SimpleNamespace(id="acct_test_123")
        mock_client.v2.core.account_links.create.return_value = SimpleNamespace(
            url="https://connect.stripe.com/setup/s/test"
        )
        mock_get_client.return_value = mock_client

        url = create_connect_onboarding_link(
            host,
            return_url="irlobby://stripe/connect/return",
            refresh_url="irlobby://stripe/connect/refresh",
        )

        self.assertEqual(url, "https://connect.stripe.com/setup/s/test")
        params = mock_client.v2.core.account_links.create.call_args[0][0]
        onboarding = params["use_case"]["account_onboarding"]
        self.assertEqual(onboarding["return_url"], "https://api.irlobby.com/stripe/connect/return")
        self.assertEqual(
            onboarding["refresh_url"], "https://api.irlobby.com/stripe/connect/refresh"
        )
        create_params = mock_client.v2.core.accounts.create.call_args[0][0]
        capabilities = create_params["configuration"]["recipient"]["capabilities"]["stripe_balance"]
        self.assertTrue(capabilities["stripe_transfers"]["requested"])
        self.assertTrue(capabilities["payouts"]["requested"])
        self.assertEqual(create_params["dashboard"], "express")


class StripeConnectViewTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="payout-host",
            email="payout-host@example.com",
            password="password123",
        )
        self.client.force_authenticate(self.user)

    @override_settings(STRIPE_API_KEY="")
    def test_status_is_unavailable_without_api_key(self):
        response = self.client.get(reverse("stripe-connect-status"))
        self.assertEqual(response.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)
        self.assertIn("STRIPE_API_KEY", response.data.get("error", ""))

    @override_settings(STRIPE_API_KEY="sk_live_blocked", STRIPE_ALLOW_LIVE_MODE=False)
    def test_onboard_rejects_live_key(self):
        response = self.client.post(reverse("stripe-connect-onboard"), {}, format="json")
        self.assertEqual(response.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)
        self.assertIn("Live Stripe keys", response.data.get("error", ""))

    @override_settings(STRIPE_API_KEY="sk_test_123")
    @patch("users.stripe_connect.create_connect_onboarding_link")
    def test_onboard_returns_url(self, mock_link):
        mock_link.return_value = "https://connect.stripe.com/setup/s/test"
        response = self.client.post(
            reverse("stripe-connect-onboard"),
            {
                "returnUrl": "irlobby://stripe/connect/return",
                "refreshUrl": "irlobby://stripe/connect/refresh",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["url"], "https://connect.stripe.com/setup/s/test")
        mock_link.assert_called_once()
