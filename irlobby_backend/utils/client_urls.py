from urllib.parse import urlparse

from django.conf import settings

ALLOWED_APP_SCHEME = "irlobby"
ALLOWED_APP_TARGETS = {
    "tickets/success",
    "tickets/cancel",
    "stripe/connect/return",
    "stripe/connect/refresh",
}
ALLOWED_HTTPS_HOSTS = {"irlobby.com", "www.irlobby.com", "api.irlobby.com"}
LOCAL_HOSTS = {"localhost", "127.0.0.1", "0.0.0.0", "::1"}
DEFAULT_STRIPE_REDIRECT_BASE_URL = "https://api.irlobby.com"
CHECKOUT_SESSION_PLACEHOLDER = "{CHECKOUT_SESSION_ID}"


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


def stripe_redirect_base_url():
    """Public https origin Stripe can redirect to after Checkout / Connect."""
    configured = (getattr(settings, "STRIPE_REDIRECT_BASE_URL", "") or "").strip().rstrip("/")
    if configured:
        return configured
    return DEFAULT_STRIPE_REDIRECT_BASE_URL


def _deep_link_target(parsed):
    """Map irlobby:// and Expo exp:// URLs onto known app bounce targets."""
    if parsed.scheme == ALLOWED_APP_SCHEME:
        target = _app_target(parsed)
        return target if target in ALLOWED_APP_TARGETS else None

    if parsed.scheme == "exp":
        path = (parsed.path or "").lstrip("/")
        if path.startswith("--/"):
            path = path[3:]
        return path if path in ALLOWED_APP_TARGETS else None

    return None


def to_stripe_https_return_url(value):
    """Rewrite app-scheme URLs to https bounce pages Stripe will accept.

    Stripe Account Links and Checkout success/cancel URLs must be http(s).
    The mobile app still sends irlobby://…; this converts those to
    https://api.irlobby.com/… bounce pages that deep-link back into the app.
    """
    if not isinstance(value, str):
        return value

    candidate = value.strip()
    if not candidate:
        return candidate

    normalized = candidate.replace(CHECKOUT_SESSION_PLACEHOLDER, "cs_placeholder")
    parsed = urlparse(normalized)
    if parsed.scheme in {"http", "https"} and parsed.hostname:
        return candidate

    original = urlparse(candidate)
    target = _deep_link_target(parsed)
    if not target:
        return candidate

    rewritten = f"{stripe_redirect_base_url()}/{target}"
    query = original.query
    if query:
        rewritten = f"{rewritten}?{query}"
    return rewritten


def is_allowed_client_return_url(value):
    """Allow only first-party https origins or the IRLobby app scheme."""
    if not isinstance(value, str):
        return False

    candidate = value.strip()
    if not candidate or len(candidate) > 2048:
        return False

    normalized = candidate.replace(CHECKOUT_SESSION_PLACEHOLDER, "cs_placeholder")
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
