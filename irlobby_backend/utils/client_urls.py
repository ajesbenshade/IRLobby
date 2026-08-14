from urllib.parse import urlparse

from django.conf import settings

ALLOWED_APP_SCHEME = "irlobby"
ALLOWED_APP_TARGETS = {
    "tickets/success",
    "tickets/cancel",
    "stripe/connect/return",
    "stripe/connect/refresh",
}
ALLOWED_HTTPS_HOSTS = {"irlobby.com", "www.irlobby.com"}
LOCAL_HOSTS = {"localhost", "127.0.0.1", "0.0.0.0", "::1"}


def _hostname_set_from_origins(origins):
    hosts = set()
    for origin in origins or []:
        parsed = urlparse(origin)
        if parsed.hostname:
            hosts.add(parsed.hostname.lower())
    return hosts


def _allowed_https_hosts():
    hosts = set(ALLOWED_HTTPS_HOSTS)
    hosts |= _hostname_set_from_origins(getattr(settings, "CORS_ALLOWED_ORIGINS", []))
    hosts |= _hostname_set_from_origins(getattr(settings, "CSRF_TRUSTED_ORIGINS", []))
    frontend = getattr(settings, "FRONTEND_BASE_URL", "") or ""
    parsed = urlparse(frontend)
    if parsed.hostname:
        hosts.add(parsed.hostname.lower())
    return hosts


def _app_target(parsed):
    host = (parsed.netloc or "").strip("/")
    path = (parsed.path or "").lstrip("/")
    return "/".join(part for part in (host, path) if part)


def is_allowed_client_return_url(value):
    """Allow only first-party https origins or the IRLobby app scheme."""
    if not isinstance(value, str):
        return False

    candidate = value.strip()
    if not candidate or len(candidate) > 2048:
        return False

    normalized = candidate.replace("{CHECKOUT_SESSION_ID}", "cs_placeholder")
    parsed = urlparse(normalized)
    if parsed.username or parsed.password:
        return False

    if parsed.scheme == ALLOWED_APP_SCHEME:
        return _app_target(parsed) in ALLOWED_APP_TARGETS

    if parsed.scheme == "https" and parsed.hostname:
        return parsed.hostname.lower() in _allowed_https_hosts()

    if getattr(settings, "DEBUG", False):
        if parsed.scheme == "exp":
            return True
        if parsed.scheme == "http" and (parsed.hostname or "").lower() in LOCAL_HOSTS:
            return True

    return False
