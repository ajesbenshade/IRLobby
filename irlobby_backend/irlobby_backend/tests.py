from pathlib import Path
from unittest.mock import Mock, patch

from django.conf import settings
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


class LegalPageTests(TestCase):
    def test_privacy_and_support_are_real_html_documents(self):
        for path in ("/privacy", "/privacy/", "/privacy-policy", "/support", "/support/"):
            with self.subTest(path=path):
                response = self.client.get(path)
                self.assertEqual(response.status_code, 200)
                self.assertIn("text/html", response["Content-Type"])
                body = response.content.decode("utf-8")
                self.assertNotIn("Redirecting to", body)
                self.assertIn("support@irlobby.com", body)
                if "privacy" in path:
                    self.assertIn("Privacy Policy", body)
                    self.assertIn("location", body.lower())
                    self.assertIn("chat", body.lower())
                else:
                    self.assertIn("Support", body)

    def test_site_legal_html_matches_backend_deploy_copies(self):
        repo_root = Path(__file__).resolve().parents[2]
        site_dir = repo_root / "site"
        legal_dir = Path(settings.BASE_DIR) / "deploy" / "oracle" / "legal"
        self.assertTrue(legal_dir.is_dir())
        if not site_dir.is_dir():
            self.skipTest("site/ is not present in this checkout")
        for name in ("privacy.html", "support.html"):
            self.assertEqual(
                (site_dir / name).read_bytes(),
                (legal_dir / name).read_bytes(),
                f"{name} in site/ and deploy/oracle/legal/ must stay identical",
            )

    def test_nginx_templates_route_legal_pages(self):
        nginx_dir = Path(settings.BASE_DIR) / "deploy" / "oracle" / "nginx"
        include_text = (nginx_dir / "legal-locations.inc").read_text(encoding="utf-8")
        self.assertIn("location = /privacy", include_text)
        self.assertIn("location = /support", include_text)
        default_conf = (nginx_dir / "default.conf.template").read_text(encoding="utf-8")
        self.assertIn("legal-locations.inc", default_conf)
        self.assertIn("server_name irlobby.com www.irlobby.com", default_conf)
        self.assertIn("location /api/health/", default_conf)
        self.assertIn("location /ws/", default_conf)

    def test_certbot_webroot_is_the_host_path_nginx_serves(self):
        repo_root = Path(__file__).resolve().parents[2]
        compose = (Path(settings.BASE_DIR) / "docker-compose.oracle.yml").read_text(
            encoding="utf-8"
        )
        enable_tls = (
            Path(settings.BASE_DIR) / "deploy" / "oracle" / "enable-marketing-tls.sh"
        ).read_text(encoding="utf-8")
        deploy_docs = (repo_root / "docs" / "DEPLOYMENT.md").read_text(encoding="utf-8")
        backend_deploy = (repo_root / ".github" / "workflows" / "backend-deploy.yml").read_text(
            encoding="utf-8"
        )
        self.assertIn("- /var/www/certbot:/var/www/certbot", compose)
        self.assertNotIn("certbot-webroot:/var/www/certbot", compose)
        self.assertIn("--webroot -w /var/www/certbot", enable_tls)
        self.assertNotIn("certbot-webroot -d irlobby.com", enable_tls)
        self.assertIn("--webroot -w /var/www/certbot", deploy_docs)
        self.assertIn(
            "Do not renew or replace the existing `api.irlobby.com` certificate", deploy_docs
        )
        self.assertIn("validate-nginx.sh", backend_deploy)
        validate_idx = backend_deploy.index("validate-nginx.sh")
        recreate_idx = backend_deploy.index("up -d --no-deps --force-recreate nginx")
        self.assertLess(validate_idx, recreate_idx)
        # Call site must close stdin so compose run cannot eat the SSH heredoc.
        validate_line = next(
            line for line in backend_deploy.splitlines() if "validate-nginx.sh" in line
        )
        self.assertIn("</dev/null", validate_line)

    def test_validate_nginx_does_not_steal_ssh_heredoc_stdin(self):
        script = (
            Path(settings.BASE_DIR) / "deploy" / "oracle" / "validate-nginx.sh"
        ).read_text(encoding="utf-8")
        self.assertIn("run --rm --no-deps -T", script)
        self.assertIn("</dev/null", script)

    def test_nginx_recreate_workflow_force_recreates_without_compose_run(self):
        repo_root = Path(__file__).resolve().parents[2]
        workflow = (repo_root / ".github" / "workflows" / "nginx-recreate.yml").read_text(
            encoding="utf-8"
        )
        self.assertIn("workflow_dispatch", workflow)
        self.assertIn("HETZNER_SSH_KEY", workflow)
        self.assertIn("HETZNER_HOST", workflow)
        self.assertIn(
            "docker compose -f docker-compose.oracle.yml --env-file .env.production"
            " up -d --no-deps --force-recreate nginx",
            workflow,
        )
        self.assertIn("docker ps", workflow)
        self.assertIn("logs --tail=40 nginx", workflow)
        self.assertIn("http://127.0.0.1/api/health/", workflow)
        self.assertNotIn("docker compose run", workflow)
        self.assertNotIn("bash -s", workflow)
