from django.test import SimpleTestCase, override_settings

from utils.client_urls import is_allowed_client_return_url, to_stripe_https_return_url
from utils.media import validate_image_reference, validate_image_reference_list


class ClientReturnUrlTests(SimpleTestCase):
    def test_allows_app_scheme_targets(self):
        self.assertTrue(is_allowed_client_return_url("irlobby://tickets/success"))
        self.assertTrue(
            is_allowed_client_return_url(
                "irlobby://tickets/success?session_id={CHECKOUT_SESSION_ID}"
            )
        )
        self.assertTrue(is_allowed_client_return_url("irlobby://stripe/connect/return"))

    def test_rejects_unknown_app_paths_and_schemes(self):
        self.assertFalse(is_allowed_client_return_url("irlobby://evil/path"))
        self.assertFalse(is_allowed_client_return_url("javascript:alert(1)"))
        self.assertFalse(is_allowed_client_return_url("https://evil.example/phish"))

    def test_allows_first_party_https(self):
        self.assertTrue(is_allowed_client_return_url("https://irlobby.com/app/tickets"))
        self.assertTrue(
            is_allowed_client_return_url("https://www.irlobby.com/stripe/connect/return")
        )
        self.assertTrue(
            is_allowed_client_return_url("https://api.irlobby.com/stripe/connect/return")
        )

    def test_rejects_credentials_in_url(self):
        self.assertFalse(is_allowed_client_return_url("https://user:pass@irlobby.com/app"))


class ImageReferenceTests(SimpleTestCase):
    def test_allows_jpeg_data_url(self):
        value = "data:image/jpeg;base64,abc"
        self.assertEqual(validate_image_reference(value), value)

    def test_rejects_html_and_svg_data_urls(self):
        with self.assertRaises(Exception):
            validate_image_reference("data:text/html;base64,abc")
        with self.assertRaises(Exception):
            validate_image_reference("data:image/svg+xml;base64,abc")

    def test_rejects_javascript_and_file_urls(self):
        with self.assertRaises(Exception):
            validate_image_reference("javascript:alert(1)")
        with self.assertRaises(Exception):
            validate_image_reference("file:///etc/passwd")

    def test_allows_https_image_url(self):
        url = "https://api.dicebear.com/9.x/adventurer/png?seed=sprout"
        self.assertEqual(validate_image_reference(url), url)

    def test_caps_list_length(self):
        with self.assertRaises(Exception):
            validate_image_reference_list(["data:image/jpeg;base64,a"] * 6, max_items=5)


class DebugReturnUrlTests(SimpleTestCase):
    @override_settings(DEBUG=True)
    def test_allows_expo_and_localhost_in_debug(self):
        self.assertTrue(is_allowed_client_return_url("exp://127.0.0.1:8081/--/tickets/success"))
        self.assertTrue(is_allowed_client_return_url("http://localhost:5173/tickets/cancel"))

    @override_settings(DEBUG=False)
    def test_rejects_expo_and_localhost_outside_debug(self):
        self.assertFalse(is_allowed_client_return_url("exp://127.0.0.1:8081/--/tickets/success"))
        self.assertFalse(is_allowed_client_return_url("http://localhost:5173/tickets/cancel"))


class StripeHttpsReturnUrlTests(SimpleTestCase):
    @override_settings(STRIPE_REDIRECT_BASE_URL="https://api.irlobby.com")
    def test_rewrites_app_scheme_to_api_bounce_page(self):
        self.assertEqual(
            to_stripe_https_return_url("irlobby://stripe/connect/return"),
            "https://api.irlobby.com/stripe/connect/return",
        )
        self.assertEqual(
            to_stripe_https_return_url(
                "irlobby://tickets/success?session_id={CHECKOUT_SESSION_ID}"
            ),
            "https://api.irlobby.com/tickets/success?session_id={CHECKOUT_SESSION_ID}",
        )

    @override_settings(STRIPE_REDIRECT_BASE_URL="https://api.irlobby.com")
    def test_leaves_https_urls_unchanged(self):
        url = "https://www.irlobby.com/stripe/connect/return"
        self.assertEqual(to_stripe_https_return_url(url), url)

    @override_settings(DEBUG=True, STRIPE_REDIRECT_BASE_URL="https://api.irlobby.com")
    def test_rewrites_expo_dev_urls_to_known_targets(self):
        self.assertEqual(
            to_stripe_https_return_url("exp://127.0.0.1:8081/--/tickets/cancel"),
            "https://api.irlobby.com/tickets/cancel",
        )
