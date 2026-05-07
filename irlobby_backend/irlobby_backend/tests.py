from unittest.mock import Mock, patch

from django.core.exceptions import ImproperlyConfigured
from django.test import TestCase, override_settings

from irlobby_backend.settings import validate_redis_url


class RedisConfigurationTests(TestCase):
    def test_validate_redis_url_accepts_authenticated_urls(self):
        validate_redis_url("REDIS_URL", "redis://:password@redis:6379/0", require_auth=True)
        validate_redis_url(
            "REDIS_URL", "rediss://:password@redis.example.com:6379/0", require_auth=True
        )

    def test_validate_redis_url_rejects_unauthenticated_production_url(self):
        with self.assertRaisesMessage(
            ImproperlyConfigured, "REDIS_URL must include Redis authentication in production."
        ):
            validate_redis_url("REDIS_URL", "redis://redis:6379/0", require_auth=True)

    def test_validate_redis_url_rejects_non_redis_url(self):
        with self.assertRaisesMessage(
            ImproperlyConfigured, "REDIS_URL must be a valid redis:// or rediss:// URL."
        ):
            validate_redis_url("REDIS_URL", "http://redis:6379/0", require_auth=True)


class HealthDashboardAccessTests(TestCase):
    def test_health_dashboard_rejects_anonymous_requests_by_default(self):
        response = self.client.get("/api/health/dashboard/")

        self.assertEqual(response.status_code, 403)

    @override_settings(HEALTH_DASHBOARD_ALLOWED_IPS=["203.0.113.10"])
    @patch("irlobby_backend.celery.app.control.inspect")
    @patch("redis.Redis.from_url")
    def test_health_dashboard_allows_configured_ip(self, mock_from_url, mock_inspect):
        mock_from_url.return_value = Mock(ping=Mock(return_value=True))
        mock_inspect.return_value = Mock(ping=Mock(return_value={"worker": {"ok": "pong"}}))

        response = self.client.get(
            "/api/health/dashboard/",
            HTTP_X_REAL_IP="203.0.113.10",
            REMOTE_ADDR="172.18.0.5",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["checks"]["database"], "ok")
        self.assertEqual(response.json()["checks"]["celery"], "ok")

    @override_settings(HEALTH_DASHBOARD_ALLOWED_IPS=["203.0.113.10"])
    def test_health_dashboard_rejects_spoofed_forwarded_for(self):
        response = self.client.get(
            "/api/health/dashboard/",
            HTTP_X_FORWARDED_FOR="203.0.113.10, 198.51.100.20",
            REMOTE_ADDR="198.51.100.20",
        )

        self.assertEqual(response.status_code, 403)

    @override_settings(HEALTH_DASHBOARD_ALLOWED_IPS=["203.0.113.10"])
    @patch("django.core.handlers.base.log_response")
    @patch("irlobby_backend.celery.app.control.inspect")
    @patch("redis.Redis.from_url")
    def test_health_dashboard_reports_celery_failure(
        self, mock_from_url, mock_inspect, _mock_log_response
    ):
        mock_from_url.return_value = Mock(ping=Mock(return_value=True))
        mock_inspect.return_value = Mock(ping=Mock(return_value=None))

        response = self.client.get(
            "/api/health/dashboard/",
            HTTP_X_REAL_IP="203.0.113.10",
            REMOTE_ADDR="172.18.0.5",
        )

        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.json()["status"], "degraded")
        self.assertEqual(response.json()["checks"]["celery"], "error")
