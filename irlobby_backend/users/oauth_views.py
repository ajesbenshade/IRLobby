import base64
import hashlib
import json
import logging
import secrets
from urllib.parse import quote, urlencode, urlparse

import requests
from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.http import HttpResponse
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken

from .serializers import UserSerializer

logger = logging.getLogger(__name__)

User = get_user_model()

ALLOWED_MOBILE_REDIRECT_PATHS = {"/twitter"}


def get_twitter_credentials():
    # Read only from Django settings so tests can override with override_settings.
    client_id = str(getattr(settings, "TWITTER_CLIENT_ID", "") or "").strip()
    client_secret = str(getattr(settings, "TWITTER_CLIENT_SECRET", "") or "").strip()
    return client_id, client_secret


def is_twitter_oauth_configured(client_id, client_secret):
    return bool(client_id and client_secret)


def generate_code_verifier():
    """Generate a random code verifier for PKCE"""
    return secrets.token_urlsafe(32)


def generate_code_challenge(code_verifier):
    """Generate code challenge from code verifier"""
    code_challenge = hashlib.sha256(code_verifier.encode("utf-8")).digest()
    return base64.urlsafe_b64encode(code_challenge).decode("utf-8").rstrip("=")


def exchange_twitter_token(code, redirect_uri, code_verifier, client_id, client_secret):
    token_url = "https://api.twitter.com/2/oauth2/token"
    base_headers = {
        "Content-Type": "application/x-www-form-urlencoded",
        "Accept": "application/json",
    }

    token_data = {
        "code": code,
        "grant_type": "authorization_code",
        "redirect_uri": redirect_uri,
        "code_verifier": code_verifier,
    }

    def _confidential_exchange():
        credential_bytes = f"{client_id}:{client_secret}".encode("utf-8")
        basic_token = base64.b64encode(credential_bytes).decode("utf-8")
        headers = {
            **base_headers,
            "Authorization": f"Basic {basic_token}",
        }
        # Keep client_id in body for maximum compatibility across Twitter app setups.
        return requests.post(
            token_url,
            data={
                **token_data,
                "client_id": client_id,
            },
            headers=headers,
            timeout=30,
        )

    def _public_exchange():
        return requests.post(
            token_url,
            data={
                **token_data,
                "client_id": client_id,
            },
            headers=base_headers,
            timeout=30,
        )

    # First attempt follows configured mode; if Twitter rejects with unauthorized_client,
    # retry with the alternate auth style to handle app-mode mismatches gracefully.
    first_response = _confidential_exchange() if client_secret else _public_exchange()
    if first_response.status_code == 200:
        return first_response

    response_text = first_response.text or ""
    should_retry = (
        first_response.status_code in (400, 401) and "unauthorized_client" in response_text.lower()
    )
    if not should_retry:
        return first_response

    logger.warning(
        "Twitter token exchange unauthorized_client; retrying with alternate client auth mode."
    )

    return _public_exchange() if client_secret else _confidential_exchange()


def resolve_frontend_origin(request):
    """Resolve frontend origin for OAuth redirects."""
    request_origin = (request.META.get("HTTP_ORIGIN") or "").rstrip("/")
    if getattr(settings, "DEBUG", False):
        if request_origin.startswith("http://localhost:") or request_origin.startswith(
            "http://127.0.0.1:"
        ):
            return request_origin

    frontend_base_url = getattr(settings, "FRONTEND_BASE_URL", None) or "http://localhost:5173"
    return frontend_base_url.rstrip("/")


def is_valid_mobile_redirect_uri(uri):
    """Only allow the known app deep-link used by standalone/TestFlight builds."""
    if not isinstance(uri, str) or not uri:
        return False

    parsed = urlparse(uri)
    path = (parsed.path or "").rstrip("/") or "/"
    return (
        parsed.scheme == "irlobby"
        and parsed.netloc == "auth"
        and path in ALLOWED_MOBILE_REDIRECT_PATHS
        and not parsed.query
        and not parsed.fragment
        and not parsed.params
    )


def redirect_to_mobile(mobile_redirect_uri, params):
    """Redirect to an app deep link.

    Django's HttpResponseRedirect disallows custom schemes, so set Location manually.
    """
    target = f"{mobile_redirect_uri}?{urlencode(params)}"
    response = HttpResponse(status=302)
    response["Location"] = target
    return response


def mobile_or_json_error(mobile_redirect_uri, message, http_status=status.HTTP_400_BAD_REQUEST):
    if mobile_redirect_uri and is_valid_mobile_redirect_uri(mobile_redirect_uri):
        return redirect_to_mobile(mobile_redirect_uri, {"error": message})
    return Response({"error": message}, status=http_status)


def build_auth_tokens_payload(user, created=False):
    refresh = RefreshToken.for_user(user)
    access_token = str(refresh.access_token)
    refresh_token = str(refresh)
    serialized_user = UserSerializer(user).data
    return {
        "user": serialized_user,
        "tokens": {
            "refresh": refresh_token,
            "access": access_token,
        },
        "created": created,
        "access_token": access_token,
        "refresh_token": refresh_token,
        "serialized_user": serialized_user,
    }


@api_view(["GET"])
@permission_classes([AllowAny])
def twitter_oauth_url(request):
    """Get Twitter OAuth authorization URL"""
    try:
        logger.info(f"Twitter OAuth URL request from origin: {request.META.get('HTTP_ORIGIN')}")

        client_id, client_secret = get_twitter_credentials()
        if not is_twitter_oauth_configured(client_id, client_secret):
            logger.error("Twitter OAuth credentials are incomplete")
            return Response(
                {"error": "Twitter OAuth not configured. Please contact support."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        # Generate PKCE values
        code_verifier = generate_code_verifier()
        code_challenge = generate_code_challenge(code_verifier)

        mobile_redirect_uri = request.GET.get("mobile_redirect_uri")
        if mobile_redirect_uri:
            if not is_valid_mobile_redirect_uri(mobile_redirect_uri):
                return Response(
                    {"error": "Invalid mobile redirect URI."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            redirect_uri = request.build_absolute_uri("/api/auth/twitter/callback/")
        else:
            frontend_origin = resolve_frontend_origin(request)
            redirect_uri = f"{frontend_origin}/auth/twitter/callback"

        logger.info("Using Twitter OAuth redirect URI: %s", redirect_uri)

        # Store OAuth session details in cache with state as key
        state = secrets.token_urlsafe(32)
        cache.set(
            f"twitter_oauth_{state}",
            {
                "code_verifier": code_verifier,
                "redirect_uri": redirect_uri,
                "mobile_redirect_uri": mobile_redirect_uri,
            },
            timeout=600,
        )  # 10 minutes

        # Twitter OAuth 2.0 authorization URL with correct scopes
        auth_url = (
            "https://twitter.com/i/oauth2/authorize?"
            f"response_type=code&"
            f"client_id={client_id}&"
            f"redirect_uri={quote(redirect_uri)}&"
            f"scope=users.read%20tweet.read&"
            f"state={state}&"
            f"code_challenge={code_challenge}&"
            f"code_challenge_method=S256"
        )

        logger.info("Generated Twitter OAuth URL")

        return Response({"auth_url": auth_url, "state": state})

    except Exception as e:
        logger.error(f"Twitter OAuth URL generation failed: {str(e)}")
        return Response(
            {"error": "Failed to generate Twitter OAuth URL. Please try again later."},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


@api_view(["GET"])
@permission_classes([AllowAny])
def twitter_oauth_callback(request):
    """Handle Twitter OAuth callback"""
    mobile_redirect_uri = None
    try:
        logger.info(
            f"Twitter OAuth callback received from origin: {request.META.get('HTTP_ORIGIN')}"
        )
        code = request.GET.get("code")
        state = request.GET.get("state")
        oauth_error = request.GET.get("error")

        logger.info(f"Twitter callback - code present: {bool(code)}, state present: {bool(state)}")

        oauth_session = cache.get(f"twitter_oauth_{state}") if state else None
        if isinstance(oauth_session, dict):
            mobile_redirect_uri = oauth_session.get("mobile_redirect_uri")

        if oauth_error:
            description = request.GET.get("error_description") or oauth_error
            logger.warning("Twitter callback returned error: %s", description)
            if state:
                cache.delete(f"twitter_oauth_{state}")
            return mobile_or_json_error(
                mobile_redirect_uri,
                f"Twitter authentication was cancelled or failed: {description}",
            )

        if not code:
            logger.warning("Twitter callback missing authorization code")
            return mobile_or_json_error(mobile_redirect_uri, "Authorization code required")

        if not state:
            logger.warning("Twitter callback missing state parameter")
            return mobile_or_json_error(mobile_redirect_uri, "State parameter required")

        if not oauth_session:
            logger.warning(f"Twitter callback - invalid or expired state: {state[:10]}...")
            return mobile_or_json_error(mobile_redirect_uri, "Session expired or invalid state")

        if isinstance(oauth_session, dict):
            code_verifier = oauth_session.get("code_verifier")
            redirect_uri = oauth_session.get("redirect_uri")
            mobile_redirect_uri = oauth_session.get("mobile_redirect_uri")
        else:
            # Backward compatibility for previously cached values
            code_verifier = oauth_session
            mobile_redirect_uri = None
            frontend_origin = resolve_frontend_origin(request)
            redirect_uri = f"{frontend_origin}/auth/twitter/callback"

        if not code_verifier:
            logger.warning("Twitter callback - missing code_verifier in cached state")
            return mobile_or_json_error(mobile_redirect_uri, "Session invalid. Please try again.")

        # Clean up the cached code_verifier
        cache.delete(f"twitter_oauth_{state}")
        logger.info("Twitter callback - retrieved and cleared code_verifier from cache")

        client_id, client_secret = get_twitter_credentials()

        if not is_twitter_oauth_configured(client_id, client_secret):
            logger.error("Twitter OAuth credentials are incomplete")
            return mobile_or_json_error(
                mobile_redirect_uri,
                "Twitter OAuth not configured",
                status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        logger.info("Twitter callback - using redirect_uri: %s", redirect_uri)

        try:
            token_response = exchange_twitter_token(
                code=code,
                redirect_uri=redirect_uri,
                code_verifier=code_verifier,
                client_id=client_id,
                client_secret=client_secret,
            )
            logger.info(f"Twitter callback - token response status: {token_response.status_code}")

            if token_response.status_code != 200:
                logger.error(
                    f"Twitter callback - token exchange failed: {token_response.status_code}"
                )
                logger.error(f"Twitter callback - token response body: {token_response.text}")
                return mobile_or_json_error(
                    mobile_redirect_uri,
                    "Twitter authentication failed. Please try again.",
                )

        except requests.RequestException as e:
            logger.error(f"Twitter callback - network error during token exchange: {str(e)}")
            return mobile_or_json_error(
                mobile_redirect_uri,
                "Failed to connect to Twitter",
                status.HTTP_502_BAD_GATEWAY,
            )

        token_data = token_response.json()
        access_token = token_data.get("access_token")

        if not access_token:
            logger.error("No access token received from Twitter")
            return mobile_or_json_error(
                mobile_redirect_uri,
                "Invalid response from Twitter",
                status.HTTP_502_BAD_GATEWAY,
            )

        # Get user info from Twitter
        user_url = "https://api.twitter.com/2/users/me"
        headers = {"Authorization": f"Bearer {access_token}"}
        params = {"user.fields": "name,username"}

        try:
            user_response = requests.get(user_url, headers=headers, params=params, timeout=30)
        except requests.RequestException as e:
            logger.error(f"Twitter user info request failed: {str(e)}")
            return mobile_or_json_error(
                mobile_redirect_uri,
                "Failed to get user information from Twitter",
                status.HTTP_502_BAD_GATEWAY,
            )

        if user_response.status_code != 200:
            logger.error(
                f"Twitter user info failed: {user_response.status_code} - {user_response.text}"
            )
            return mobile_or_json_error(
                mobile_redirect_uri,
                "Failed to get user information from Twitter",
                status.HTTP_502_BAD_GATEWAY,
            )

        twitter_user = user_response.json()["data"]

        # Create or get user
        user, created = User.objects.get_or_create(
            oauth_id=twitter_user["id"],
            oauth_provider="twitter",
            defaults={
                "username": twitter_user["username"],
                "email": f"{twitter_user['username']}@twitter.oauth.local",
                "first_name": (
                    twitter_user.get("name", "").split()[0] if twitter_user.get("name") else ""
                ),
                "last_name": (
                    " ".join(twitter_user.get("name", "").split()[1:])
                    if twitter_user.get("name") and len(twitter_user.get("name", "").split()) > 1
                    else ""
                ),
            },
        )

        auth_payload = build_auth_tokens_payload(user, created=created)

        if mobile_redirect_uri:
            return redirect_to_mobile(
                mobile_redirect_uri,
                {
                    "access": auth_payload["access_token"],
                    "refresh": auth_payload["refresh_token"],
                    "user": json.dumps(auth_payload["serialized_user"], separators=(",", ":")),
                    "created": "true" if created else "false",
                },
            )

        return Response(
            {
                "user": auth_payload["user"],
                "tokens": auth_payload["tokens"],
                "created": created,
            },
            status=status.HTTP_200_OK,
        )

    except Exception as e:
        logger.error(f"Twitter OAuth callback failed: {str(e)}")
        return mobile_or_json_error(
            mobile_redirect_uri,
            "Authentication failed. Please try again.",
            status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


@api_view(["GET"])
@permission_classes([AllowAny])
def twitter_oauth_status(request):
    """Check Twitter OAuth configuration status"""
    try:
        client_id, client_secret = get_twitter_credentials()

        status_info = {
            "configured": is_twitter_oauth_configured(client_id, client_secret),
            "client_id_set": bool(client_id),
            "client_secret_set": bool(client_secret),
            "debug_mode": getattr(settings, "DEBUG", False),
            "redirect_uri": f"{resolve_frontend_origin(request)}/auth/twitter/callback",
        }

        logger.info(f"Twitter OAuth status check: {status_info}")

        return Response(status_info)

    except Exception as e:
        logger.error(f"Twitter OAuth status check failed: {str(e)}")
        return Response(
            {"error": "Failed to check Twitter OAuth status", "configured": False},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )
