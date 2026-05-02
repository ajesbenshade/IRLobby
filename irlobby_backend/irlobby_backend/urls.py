"""
URL configuration for irlobby_backend project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/5.2/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""

import logging
from datetime import datetime, timezone

from django.conf import settings
from django.contrib import admin
from django.http import JsonResponse
from django.shortcuts import render
from django.urls import include, path, re_path
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
)

from users.views import (
    CookieTokenRefreshView,
    logout_view,
    password_reset_confirm,
    request_password_reset,
)


def home(request):
    return render(request, "index.html")


def react_app(request):
    return render(request, "index.html")


logger = logging.getLogger(__name__)


def _client_ip(request):
    real_ip = request.META.get("HTTP_X_REAL_IP", "").strip()
    if real_ip:
        return real_ip

    forwarded_for = request.META.get("HTTP_X_FORWARDED_FOR", "")
    if forwarded_for:
        return forwarded_for.split(",")[-1].strip()
    return request.META.get("REMOTE_ADDR", "")


def _can_view_health_dashboard(request):
    user = getattr(request, "user", None)
    if user and user.is_authenticated and user.is_staff:
        return True

    allowed_ips = set(getattr(settings, "HEALTH_DASHBOARD_ALLOWED_IPS", []) or [])
    return bool(allowed_ips and _client_ip(request) in allowed_ips)


def health_check(request):
    checks = {"status": "ok", "database": "ok", "redis": "ok"}

    try:
        from django.db import connection

        connection.ensure_connection()
    except Exception as exc:
        logger.error("Health check database failure: %s", exc)
        checks["database"] = "error"
        checks["status"] = "degraded"
        return JsonResponse(checks, status=503)

    try:
        import redis as redis_lib
        from django.conf import settings

        redis_conn = redis_lib.Redis.from_url(
            getattr(settings, "REDIS_URL", "redis://localhost:6379/0")
        )
        redis_conn.ping()
    except Exception as exc:
        logger.error("Health check redis failure: %s", exc)
        checks["redis"] = "error"
        checks["status"] = "degraded"
        return JsonResponse(checks, status=503)

    return JsonResponse(checks)


def health_dashboard(request):
    if not _can_view_health_dashboard(request):
        return JsonResponse({"detail": "Forbidden"}, status=403)

    checks = {"database": "ok", "redis": "ok", "cache": "ok"}
    status_code = 200

    try:
        from django.db import connection

        connection.ensure_connection()
    except Exception as exc:
        logger.error("Health dashboard database failure: %s", exc)
        checks["database"] = "error"
        status_code = 503

    try:
        import redis as redis_lib
        from django.conf import settings

        redis_conn = redis_lib.Redis.from_url(
            getattr(settings, "REDIS_URL", "redis://localhost:6379/0")
        )
        redis_conn.ping()
    except Exception as exc:
        logger.error("Health dashboard redis failure: %s", exc)
        checks["redis"] = "error"
        status_code = 503

    try:
        from django.core.cache import cache

        cache.set("health-dashboard", "ok", timeout=5)
        if cache.get("health-dashboard") != "ok":
            raise RuntimeError("cache round-trip failed")
    except Exception as exc:
        logger.error("Health dashboard cache failure: %s", exc)
        checks["cache"] = "error"
        status_code = 503

    payload = {
        "status": "ok" if status_code == 200 else "degraded",
        "checked_at": datetime.now(timezone.utc).isoformat(),
        "checks": checks,
        "monitors": {
            "nearby_activity_cache": "activities:nearby:v1",
            "websocket_presence_ttl_seconds": 120,
        },
    }
    return JsonResponse(payload, status=status_code)


admin_url_path = getattr(settings, "ADMIN_URL_PATH", "admin/").strip("/") or "admin"

urlpatterns = [
    path("", home, name="home"),
    path(f"{admin_url_path}/", admin.site.urls),
    path("api/health/", health_check, name="health"),
    path("api/health/dashboard/", health_dashboard, name="health-dashboard"),
    path("api/auth/token/", TokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("api/auth/token/refresh/", CookieTokenRefreshView.as_view(), name="token_refresh"),
    path("api/auth/logout/", logout_view, name="token_logout"),
    path("api/auth/request-password-reset/", request_password_reset, name="request-password-reset"),
    path("api/auth/password-reset-confirm/", password_reset_confirm, name="password-reset-confirm"),
    path("api/auth/reset-password/", password_reset_confirm, name="reset-password"),
    path("api/auth/twitter/", include("users.oauth_urls")),
    path("api/users/", include("users.urls")),
    path("api/activities/", include("activities.urls")),
    path("api/swipes/", include("swipes.urls")),
    path("api/matches/", include("matches.urls")),
    path("api/messages/", include("chat.urls")),
    path("api/reviews/", include("reviews.urls")),
    path("api/moderation/", include("moderation.urls")),
    re_path(r"^(?!api|admin).*$", react_app),  # Serve React for non-API routes
]
