import re
import smtplib
from datetime import timedelta
from unittest.mock import patch

from django.core import mail
from django.core.cache import cache
from django.test import SimpleTestCase, override_settings
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from users.models import User
from users.password_reset import (
    PASSWORD_RESET_TOKEN_TTL,
    app_password_reset_link,
    hash_password_reset_token,
    password_reset_token_ttl_display,
)

GENERIC_MESSAGE = "If an account with that email exists, a password reset link has been sent."
TOKEN_RE = re.compile(r"reset-password/([A-Za-z0-9_-]+)")
APEX_RESET_BASE = "https://irlobby.com/"


@override_settings(
    EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend",
    DEFAULT_FROM_EMAIL="The Foyer <foyer-sender@example.com>",
    FOYER_SUPPORT_EMAIL="support@irlobby.com",
    FRONTEND_BASE_URL="https://irlobby.com/",
)
class PasswordResetEmailTests(APITestCase):
    def setUp(self):
        cache.clear()
        mail.outbox = []
        self.user = User.objects.create_user(
            username="ruth",
            email="ruth@example.com",
            password="password123",
            first_name="Ruth",
        )
        self.url = reverse("request-password-reset")

    def _request(self, email=None):
        return self.client.post(self.url, {"email": email or self.user.email}, format="json")

    def _sent(self):
        self.assertEqual(len(mail.outbox), 1)
        return mail.outbox[0]

    def _html(self, message):
        self.assertEqual(len(message.alternatives), 1)
        html, mimetype = message.alternatives[0]
        self.assertEqual(mimetype, "text/html")
        return html

    def test_subject_from_and_reply_to(self):
        response = self._request()

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        sent = self._sent()
        self.assertEqual(sent.subject, "Reset your password for The Foyer")
        self.assertEqual(sent.from_email, "The Foyer <foyer-sender@example.com>")
        self.assertEqual(sent.reply_to, ["support@irlobby.com"])
        self.assertEqual(sent.to, ["ruth@example.com"])

    @override_settings(FOYER_SUPPORT_EMAIL="help@example.org")
    def test_reply_to_and_footer_follow_support_setting(self):
        self._request()

        sent = self._sent()
        self.assertEqual(sent.reply_to, ["help@example.org"])
        self.assertIn("Write to help@example.org.", sent.body)
        self.assertIn('href="mailto:help@example.org"', self._html(sent))

    def test_link_uses_frontend_base_url_in_text_and_html(self):
        self._request()

        sent = self._sent()
        html = self._html(sent)
        token = TOKEN_RE.search(sent.body).group(1)
        link = app_password_reset_link(token, base_url=APEX_RESET_BASE)
        self.assertEqual(link, f"https://irlobby.com/reset-password/{token}")
        self.assertIn(link, sent.body)
        self.assertIn(f'href="{link}"', html)
        for body in (sent.body, html):
            self.assertNotIn("irlobby://", body)
            self.assertNotIn("www.irlobby.com", body)
            self.assertNotIn("I have a token", body)
            self.assertIn("I have a code", body)
            self.assertIn("On a phone without this page", body)

    def test_raw_token_written_out_in_text_and_html(self):
        self._request()

        sent = self._sent()
        html = self._html(sent)
        token = TOKEN_RE.search(sent.body).group(1)
        self.user.refresh_from_db()
        self.assertEqual(self.user.password_reset_token, hash_password_reset_token(token))
        # The code on its own line in text, and in its own block in HTML.
        self.assertIn(f"\n\n{token}\n\n", sent.body)
        self.assertRegex(html, rf">{re.escape(token)}</p>")
        self.assertGreaterEqual(sent.body.count(token), 2)
        self.assertGreaterEqual(html.count(token), 2)

    def test_copy_greeting_and_expiry_from_ttl_constant(self):
        self._request()

        sent = self._sent()
        html = self._html(sent)
        expiry = f"This link and code expire in {password_reset_token_ttl_display()}."
        self.assertEqual(password_reset_token_ttl_display(), "2 hours")
        for body in (sent.body, html):
            self.assertIn("Hello Ruth,", body)
            self.assertIn(expiry, body)
            self.assertIn("The Foyer", body)
            self.assertNotIn("IRLobby", body)
        self.assertIn("Choose a new password", html)

    @patch("users.views.password_reset_token_ttl_display", return_value="90 minutes")
    def test_expiry_line_is_not_hardcoded(self, _ttl):
        self._request()

        sent = self._sent()
        self.assertIn("expire in 90 minutes.", sent.body)
        self.assertIn("expire in 90 minutes.", self._html(sent))

    def test_blank_first_name_and_text_body_is_not_html_escaped(self):
        self.user.first_name = ""
        self.user.save(update_fields=["first_name"])
        self._request()
        sent = self._sent()
        self.assertTrue(sent.body.startswith("Hello,\n"))

        mail.outbox = []
        self.user.first_name = "O'Brien <b>"
        self.user.save(update_fields=["first_name"])
        self._request()
        sent = self._sent()
        self.assertIn("Hello O'Brien <b>,", sent.body)
        self.assertIn("Hello O&#x27;Brien &lt;b&gt;,", self._html(sent))

    def test_unknown_email_gets_same_generic_response_and_no_mail(self):
        known = self._request()
        mail.outbox = []
        unknown = self._request("nobody@example.com")

        self.assertEqual(known.status_code, status.HTTP_200_OK)
        self.assertEqual(unknown.status_code, status.HTTP_200_OK)
        self.assertEqual(known.json(), unknown.json())
        self.assertEqual(unknown.json(), {"message": GENERIC_MESSAGE})
        self.assertEqual(len(mail.outbox), 0)

    def test_smtp_failure_returns_generic_200_and_logs(self):
        with patch(
            "django.core.mail.EmailMultiAlternatives.send",
            side_effect=smtplib.SMTPAuthenticationError(535, b"bad credentials"),
        ):
            with self.assertLogs("users.views", level="ERROR") as logs:
                response = self._request()

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.json(), {"message": GENERIC_MESSAGE})
        self.assertIn("Failed to send password reset email", "\n".join(logs.output))
        self.assertIn("SMTPAuthenticationError", "\n".join(logs.output))
        # The token is still stored, as before; a retry issues a fresh one.
        self.user.refresh_from_db()
        self.assertIsNotNone(self.user.password_reset_token)

    def test_connection_refused_does_not_500(self):
        with patch(
            "django.core.mail.EmailMultiAlternatives.send",
            side_effect=ConnectionRefusedError(),
        ):
            with self.assertLogs("users.views", level="ERROR"):
                response = self._request()

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.json(), {"message": GENERIC_MESSAGE})

    @override_settings(DEFAULT_FROM_EMAIL="")
    def test_missing_from_address_skips_send_with_generic_response(self):
        with self.assertLogs("users.views", level="WARNING"):
            response = self._request()

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.json(), {"message": GENERIC_MESSAGE})
        self.assertEqual(len(mail.outbox), 0)

    @override_settings(FRONTEND_BASE_URL="https://www.irlobby.com")
    def test_www_frontend_base_url_is_emailed_as_apex(self):
        self._request()

        sent = self._sent()
        html = self._html(sent)
        token = TOKEN_RE.search(sent.body).group(1)
        link = f"https://irlobby.com/reset-password/{token}"
        self.assertEqual(app_password_reset_link(token), link)
        self.assertIn(link, sent.body)
        self.assertIn(f'href="{link}"', html)
        for body in (sent.body, html):
            self.assertNotIn("www.irlobby.com", body)
            self.assertNotIn("irlobby://", body)


@override_settings(FRONTEND_BASE_URL="https://irlobby.com/")
class PasswordResetConfirmGetTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.user = User.objects.create_user(
            username="get-reset", email="get-reset@example.com", password="password123"
        )
        self.user.password_reset_token = hash_password_reset_token("good-token")
        self.user.token_created_at = timezone.now()
        self.user.save(update_fields=["password_reset_token", "token_created_at"])

    def test_get_valid_token_no_longer_redirects_to_web_loop(self):
        for name in ("password-reset-confirm", "reset-password"):
            response = self.client.get(reverse(name), {"token": "good-token"})
            self.assertEqual(response.status_code, status.HTTP_200_OK)
            self.assertFalse(response.has_header("Location"))
            self.assertEqual(response.json(), {"detail": "Token is valid.", "token": "good-token"})

    def test_get_invalid_or_expired_token(self):
        response = self.client.get(reverse("password-reset-confirm"), {"token": "nope"})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

        self.user.token_created_at = timezone.now() - PASSWORD_RESET_TOKEN_TTL - timedelta(1)
        self.user.save(update_fields=["token_created_at"])
        response = self.client.get(reverse("password-reset-confirm"), {"token": "good-token"})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class PasswordResetLinkTests(SimpleTestCase):
    def test_urljoin_with_and_without_trailing_slash(self):
        token = "abc_DEF-123"
        expected = f"https://irlobby.com/reset-password/{token}"
        self.assertEqual(app_password_reset_link(token, base_url="https://irlobby.com"), expected)
        self.assertEqual(app_password_reset_link(token, base_url="https://irlobby.com/"), expected)

    def test_www_irlobby_host_is_rewritten_to_apex(self):
        token = "abc"
        expected = f"https://irlobby.com/reset-password/{token}"
        self.assertEqual(
            app_password_reset_link(token, base_url="https://www.irlobby.com"),
            expected,
        )
        self.assertEqual(
            app_password_reset_link(token, base_url="https://www.irlobby.com/"),
            expected,
        )

    @override_settings(FRONTEND_BASE_URL="https://preview.example.org")
    def test_other_hosts_follow_frontend_base_url(self):
        link = app_password_reset_link("abc")
        self.assertEqual(link, "https://preview.example.org/reset-password/abc")
        self.assertNotIn("www.", link)
        self.assertFalse(link.startswith("irlobby://"))


class PasswordResetTtlDisplayTests(SimpleTestCase):
    def test_display(self):
        self.assertEqual(password_reset_token_ttl_display(timedelta(hours=2)), "2 hours")
        self.assertEqual(password_reset_token_ttl_display(timedelta(hours=1)), "1 hour")
        self.assertEqual(password_reset_token_ttl_display(timedelta(minutes=30)), "30 minutes")
        self.assertEqual(password_reset_token_ttl_display(timedelta(minutes=61)), "1 hour 1 minute")
