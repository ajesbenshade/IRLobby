from unittest.mock import Mock, patch

from django.test import TestCase, override_settings


class HealthDashboardAccessTests(TestCase):
    def test_health_dashboard_rejects_anonymous_requests_by_default(self):
        response = self.client.get("/api/health/dashboard/")

        self.assertEqual(response.status_code, 403)

    @override_settings(HEALTH_DASHBOARD_ALLOWED_IPS=["203.0.113.10"])
    @patch("redis.Redis.from_url")
    def test_health_dashboard_allows_configured_ip(self, mock_from_url):
        mock_from_url.return_value = Mock(ping=Mock(return_value=True))

        response = self.client.get(
            "/api/health/dashboard/",
            HTTP_X_REAL_IP="203.0.113.10",
            REMOTE_ADDR="172.18.0.5",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["checks"]["database"], "ok")

    @override_settings(HEALTH_DASHBOARD_ALLOWED_IPS=["203.0.113.10"])
    def test_health_dashboard_rejects_spoofed_forwarded_for(self):
        response = self.client.get(
            "/api/health/dashboard/",
            HTTP_X_FORWARDED_FOR="203.0.113.10, 198.51.100.20",
            REMOTE_ADDR="198.51.100.20",
        )

        self.assertEqual(response.status_code, 403)