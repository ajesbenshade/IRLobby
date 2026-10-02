import hashlib
import logging
from urllib.parse import urljoin

from django.conf import settings
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.mail import send_mail
from django.http import JsonResponse
from django.utils import timezone
from rest_framework import generics, status
from rest_framework.decorators import (
    api_view,
    authentication_classes,
    permission_classes,
    throttle_classes,
)
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenRefreshView

from .account_deletion import delete_account
from .models import Invite, PushDeviceToken, User
from .password_reset import (
    generate_password_reset_token,
    hash_password_reset_token,
    password_reset_token_expired,
    password_reset_token_matches,
)
from .serializers import (
    InviteCreateSerializer,
    InviteSerializer,
    PushDeviceTokenSerializer,
    PushDeviceTokenUpsertSerializer,
    UserLoginSerializer,
    UserOnboardingSerializer,
    UserRegistrationSerializer,
    UserSerializer,
)
from .throttles import AuthAnonThrottle, AuthUserThrottle
from .utils import clear_refresh_cookie, set_refresh_cookie

logger = logging.getLogger(__name__)


def _email_log_hash(email):
    if not email or not isinstance(email, str):
        return None
    normalized = email.strip().lower()
    if not normalized:
        return None
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()[:12]


def _clear_password_reset_token(user):
    user.password_reset_token = None
    user.token_created_at = None
    user.save(update_fields=["password_reset_token", "token_created_at"])


def _get_user_for_password_reset_token(token):
    token_hash = hash_password_reset_token(token)
    users = list(User.objects.filter(password_reset_token=token_hash))
    if len(users) != 1:
        if len(users) > 1:
            logger.warning("Multiple users share password reset token hash; clearing collisions.")
            User.objects.filter(password_reset_token=token_hash).update(
                password_reset_token=None,
                token_created_at=None,
            )
        return None

    user = users[0]
    if not password_reset_token_matches(user.password_reset_token, token):
        return None
    return user


class UserProfileView(generics.RetrieveUpdateAPIView):
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated]

    def get_object(self):
        return self.request.user


@api_view(["GET", "PATCH"])
@permission_classes([IsAuthenticated])
def user_onboarding(request):
    user = request.user

    if request.method == "GET":
        serializer = UserOnboardingSerializer(user)
        return Response(serializer.data, status=status.HTTP_200_OK)

    serializer = UserOnboardingSerializer(instance=user, data=request.data, partial=True)
    serializer.is_valid(raise_exception=True)
    serializer.save()
    return Response(serializer.data, status=status.HTTP_200_OK)


class InviteListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Invite.objects.filter(inviter=self.request.user)

    def get_serializer_class(self):
        if self.request.method == "POST":
            return InviteCreateSerializer
        return InviteSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        invite = Invite.objects.create(inviter=request.user, **serializer.validated_data)
        response_serializer = InviteSerializer(invite)
        return Response(response_serializer.data, status=status.HTTP_201_CREATED)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def register_push_token(request):
    serializer = PushDeviceTokenUpsertSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    token = serializer.validated_data["token"]
    platform = serializer.validated_data.get("platform", "unknown")
    device_id = serializer.validated_data.get("device_id", "")

    push_token, _ = PushDeviceToken.objects.update_or_create(
        token=token,
        defaults={
            "user": request.user,
            "platform": platform,
            "device_id": device_id,
            "is_active": True,
        },
    )

    return Response(PushDeviceTokenSerializer(push_token).data, status=status.HTTP_200_OK)


@api_view(["DELETE"])
@permission_classes([IsAuthenticated])
def deactivate_push_token(request):
    token = request.data.get("token")
    queryset = PushDeviceToken.objects.filter(user=request.user, is_active=True)

    if token:
        queryset = queryset.filter(token=token)

    deactivated_count = queryset.update(is_active=False)
    return Response({"deactivatedCount": deactivated_count}, status=status.HTTP_200_OK)


@api_view(["GET"])
@permission_classes([AllowAny])
def resolve_invite(request, token):
    invite = Invite.objects.filter(token=token).select_related("inviter").first()
    if not invite:
        return Response({"detail": "Invite not found"}, status=status.HTTP_404_NOT_FOUND)

    data = InviteSerializer(invite).data
    data["is_valid"] = invite.status == "pending"
    return Response(data, status=status.HTTP_200_OK)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def accept_invite(request):
    token = request.data.get("token")
    if not token:
        return Response({"detail": "Token is required"}, status=status.HTTP_400_BAD_REQUEST)

    invite = Invite.objects.filter(token=token).first()
    if not invite:
        return Response({"detail": "Invite not found"}, status=status.HTTP_404_NOT_FOUND)

    if invite.status == "accepted":
        return Response({"detail": "Invite already accepted"}, status=status.HTTP_400_BAD_REQUEST)

    invite.status = "accepted"
    invite.invitee = request.user
    invite.accepted_at = timezone.now()
    invite.save(update_fields=["status", "invitee", "accepted_at"])

    return Response(InviteSerializer(invite).data, status=status.HTTP_200_OK)


@api_view(["POST"])
@permission_classes([AllowAny])
@throttle_classes([AuthAnonThrottle, AuthUserThrottle])
def register(request):
    """Handle user registration."""
    logger.info(
        f"Register request method: {request.method}, origin: {request.META.get('HTTP_ORIGIN')}"
    )

    try:
        logger.info(
            "Registration attempt email_hash=%s", _email_log_hash(request.data.get("email"))
        )
        serializer = UserRegistrationSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.save()
            refresh = RefreshToken.for_user(user)
            logger.info("User registration succeeded for user_id=%s", user.id)
            response_payload = {
                "user": UserSerializer(user).data,
                "tokens": {
                    "refresh": str(refresh),
                    "access": str(refresh.access_token),
                },
            }
            return Response(response_payload, status=status.HTTP_201_CREATED)

        logger.warning(
            "User registration failed email_hash=%s errors=%s",
            _email_log_hash(request.data.get("email")),
            serializer.errors,
        )
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    except Exception as e:
        logger.error("Registration error: %s", str(e))
        return Response(
            {"error": "Internal server error"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(["POST"])
@permission_classes([AllowAny])
@throttle_classes([AuthAnonThrottle, AuthUserThrottle])
def login(request):
    """Handle user login with email and password."""
    logger.info(
        f"Login request method: {request.method}, origin: {request.META.get('HTTP_ORIGIN')}"
    )

    try:
        logger.info("Login attempt email_hash=%s", _email_log_hash(request.data.get("email")))
        serializer = UserLoginSerializer(data=request.data, context={"request": request})
        if serializer.is_valid():
            user = serializer.validated_data["user"]
            refresh = RefreshToken.for_user(user)
            try:
                from axes.handlers.proxy import AxesProxyHandler

                axes_request = getattr(request, "_request", request)
                AxesProxyHandler.user_logged_in(sender=login, request=axes_request, user=user)
                AxesProxyHandler.reset_attempts(username=user.email)
            except Exception as exc:
                logger.warning("Login abuse tracking success reset failed: %s", exc)
            logger.info("User login succeeded for user_id=%s", user.id)
            response_payload = {
                "user": UserSerializer(user).data,
                "tokens": {
                    "refresh": str(refresh),
                    "access": str(refresh.access_token),
                },
            }
            return Response(response_payload, status=status.HTTP_200_OK)

        logger.warning(
            "User login failed email_hash=%s errors=%s",
            _email_log_hash(request.data.get("email")),
            serializer.errors,
        )
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    except Exception as e:
        logger.error("Login error: %s", str(e))
        return Response(
            {"error": "Internal server error"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(["POST"])
@permission_classes([AllowAny])
@throttle_classes([AuthAnonThrottle, AuthUserThrottle])
def logout_view(request):
    """Invalidate the refresh token and clear the cookie."""
    refresh_token_value = request.COOKIES.get(
        settings.REFRESH_TOKEN_COOKIE_NAME
    ) or request.data.get("refresh")
    response = Response(status=status.HTTP_204_NO_CONTENT)

    if refresh_token_value:
        try:
            token = RefreshToken(refresh_token_value)
            token.blacklist()
        except TokenError as exc:
            logger.debug("Refresh token blacklist skipped: %s", exc)
        except Exception as exc:  # pragma: no cover - unexpected edge case
            logger.warning("Unexpected error while blacklisting refresh token: %s", exc)

    clear_refresh_cookie(response)
    user_identifier = request.user.id if request.user.is_authenticated else None
    logger.info(
        "Logout processed user_id=%s authenticated=%s",
        user_identifier,
        request.user.is_authenticated,
    )
    return response


class CookieTokenRefreshView(TokenRefreshView):
    """Refresh access tokens while managing secure refresh cookies."""

    def post(self, request, *args, **kwargs):
        request_data = self._with_cookie_refresh(request)
        serializer = self.get_serializer(data=request_data)
        try:
            serializer.is_valid(raise_exception=True)
        except InvalidToken as exc:
            logger.warning("Token refresh rejected: %s", exc)
            response = Response(
                {"error": "Invalid or expired refresh token", "error_code": "invalid_refresh"},
                status=status.HTTP_401_UNAUTHORIZED,
            )
            clear_refresh_cookie(response)
            return response

        response = Response(serializer.validated_data, status=status.HTTP_200_OK)
        refresh_token = serializer.validated_data.get("refresh")
        if isinstance(refresh_token, str):
            set_refresh_cookie(response, refresh_token)
        else:
            cookie_token = request_data.get("refresh")
            if isinstance(cookie_token, str):
                set_refresh_cookie(response, cookie_token)
        return response

    def _with_cookie_refresh(self, request):
        if hasattr(request.data, "copy"):
            data = request.data.copy()
        else:
            data = dict(request.data)
        if not data.get("refresh"):
            cookie_token = request.COOKIES.get(settings.REFRESH_TOKEN_COOKIE_NAME)
            if cookie_token:
                data["refresh"] = cookie_token
        return data


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def export_user_data(request):
    """Export all user data as JSON"""
    user = request.user

    try:
        user_data = {
            "export_date": timezone.now().isoformat(),
            "user_profile": UserSerializer(user).data,
            "hosted_activities": [
                {
                    "id": activity.id,
                    "title": activity.title,
                    "description": activity.description,
                    "location": activity.location,
                    "latitude": activity.latitude,
                    "longitude": activity.longitude,
                    "time": activity.time.isoformat(),
                    "capacity": activity.capacity,
                    "tags": activity.tags,
                    "images": activity.images,
                    "created_at": activity.created_at.isoformat(),
                    "participant_count": activity.participants.count(),
                }
                for activity in user.hosted_activities.all()
            ],
            "activity_participations": [
                {
                    "activity_id": participation.activity.id,
                    "activity_title": participation.activity.title,
                    "status": participation.status,
                    "joined_at": participation.joined_at.isoformat(),
                }
                for participation in user.participating_activities.all()
            ],
            "swipes": [
                {
                    "activity_id": swipe.activity.id,
                    "activity_title": swipe.activity.title,
                    "direction": swipe.direction,
                    "created_at": swipe.created_at.isoformat(),
                }
                for swipe in user.swipe_set.all()
            ],
            "matches": [
                {
                    "match_id": match.id,
                    "activity_title": match.activity.title if match.activity else None,
                    "other_user": {
                        "id": match.user_b.id if match.user_a == user else match.user_a.id,
                        "username": (
                            match.user_b.username if match.user_a == user else match.user_a.username
                        ),
                        "email": match.user_b.email if match.user_a == user else match.user_a.email,
                    },
                    "created_at": match.created_at.isoformat(),
                }
                for match in user.matches_as_a.all() | user.matches_as_b.all()
            ],
            "reviews_given": [
                {
                    "review_id": review.id,
                    "activity_title": review.activity.title,
                    "reviewee_username": review.reviewee.username,
                    "rating": review.rating,
                    "comment": review.comment,
                    "created_at": review.created_at.isoformat(),
                }
                for review in user.given_reviews.all()
            ],
            "reviews_received": [
                {
                    "review_id": review.id,
                    "activity_title": review.activity.title,
                    "reviewer_username": review.reviewer.username,
                    "rating": review.rating,
                    "comment": review.comment,
                    "created_at": review.created_at.isoformat(),
                }
                for review in user.received_reviews.all()
            ],
        }

        return JsonResponse(user_data, safe=False)

    except Exception as exc:  # pragma: no cover - defensive logging
        logger.exception("Failed to export user data for user_id=%s", user.id)
        return JsonResponse(
            {"error": "Failed to export user data", "details": str(exc)}, status=500
        )


@api_view(["DELETE"])
@permission_classes([IsAuthenticated])
def delete_profile(request):
    """Delete the signed-in account. 204 on success.

    Removes the account and its data; hosted upcoming gatherings are cancelled (attendees
    notified) first. Keeps only other people's gathering chats (without this user's messages)
    and anonymised abuse reports. The exact list is in users/account_deletion.py and
    docs/FOYER_API_CONTRACT.md.
    """
    user = request.user

    try:
        delete_account(user)

        return Response(
            {"message": "Profile deleted successfully"}, status=status.HTTP_204_NO_CONTENT
        )

    except Exception as exc:  # pragma: no cover - defensive logging
        logger.exception("Failed to delete profile for user_id=%s", user.id)
        return Response(
            {"error": "Failed to delete profile", "details": str(exc)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


@api_view(["GET"])
@permission_classes([AllowAny])
@throttle_classes([AuthAnonThrottle, AuthUserThrottle])
def auth_status(request):
    """Return whether the current request is authenticated."""
    if request.user and request.user.is_authenticated:
        return Response({"authenticated": True, "user": UserSerializer(request.user).data})
    return Response({"authenticated": False, "user": None}, status=status.HTTP_401_UNAUTHORIZED)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def stripe_connect_status(request):
    """Return the host's Stripe Connect payout readiness."""
    from .stripe_connect import StripeConnectError, get_stripe_client, sync_connect_account_status

    try:
        get_stripe_client()
        status_payload = sync_connect_account_status(request.user)
    except StripeConnectError as exc:
        return Response({"error": str(exc)}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
    except Exception as exc:  # noqa: BLE001 - surface Stripe API errors cleanly
        return Response(
            {"error": f"Unable to refresh Stripe Connect status: {exc}"},
            status=status.HTTP_502_BAD_GATEWAY,
        )

    request.user.refresh_from_db()
    status_payload["user"] = UserSerializer(request.user).data
    return Response(status_payload)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def stripe_connect_onboard(request):
    """Create/continue Stripe Connect onboarding for ticketed event hosts."""
    from .stripe_connect import StripeConnectError, create_connect_onboarding_link

    return_url = request.data.get("returnUrl") or request.data.get("return_url")
    refresh_url = request.data.get("refreshUrl") or request.data.get("refresh_url")

    from utils.client_urls import is_allowed_client_return_url

    if return_url and not is_allowed_client_return_url(return_url):
        return Response({"error": "Invalid return URL."}, status=status.HTTP_400_BAD_REQUEST)
    if refresh_url and not is_allowed_client_return_url(refresh_url):
        return Response({"error": "Invalid refresh URL."}, status=status.HTTP_400_BAD_REQUEST)

    try:
        onboarding_url = create_connect_onboarding_link(
            request.user,
            return_url=return_url,
            refresh_url=refresh_url,
        )
    except StripeConnectError as exc:
        return Response({"error": str(exc)}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
    except Exception as exc:  # noqa: BLE001
        return Response(
            {"error": f"Unable to start Stripe Connect onboarding: {exc}"},
            status=status.HTTP_502_BAD_GATEWAY,
        )

    return Response(
        {
            "url": onboarding_url,
            "accountId": request.user.stripe_connect_account_id,
        }
    )


# old simple password reset helper removed; logic below handles requests and email delivery
#
# The previous implementation above generated a token and sent mail directly using
# request.get_host(), which meant the link pointed back to the API server.  We now
# use `request_password_reset` further down, which builds a frontend URL using
# `FRONTEND_BASE_URL` and respects DEBUG email settings.  Keeping the implementation
# behind a separate view avoids duplicate behaviour and ensures the route defined in
# `urls.py` is exercised.


@api_view(["GET", "POST", "OPTIONS"])
@permission_classes([AllowAny])
@throttle_classes([AuthAnonThrottle, AuthUserThrottle])
def password_reset_confirm(request):
    """Handle password reset confirmations."""
    if request.method == "OPTIONS":
        return Response(status=status.HTTP_200_OK)

    def _invalid_response(message, status_code=status.HTTP_400_BAD_REQUEST):
        return Response({"error": message}, status=status_code)

    token = None
    if request.method == "GET":
        token = request.query_params.get("token") or request.GET.get(
            "token"
        )  # pragma: no cover - fallback for non-DRF requests
    else:
        token = request.data.get("token") or request.data.get("resetToken")

    if request.method == "GET":
        if not token:
            return _invalid_response("Token is required.")

        user = _get_user_for_password_reset_token(token)
        if not user:
            return _invalid_response("Invalid or expired token.")

        if password_reset_token_expired(user.token_created_at):
            logger.warning("Password reset token missing timestamp for user_id=%s", user.id)
            _clear_password_reset_token(user)
            return _invalid_response("Token has expired.")

        frontend_base = getattr(settings, "FRONTEND_BASE_URL", "").rstrip("/")
        if frontend_base:
            reset_path = f"reset-password/{token}"
            redirect_url = urljoin(f"{frontend_base}/", reset_path)
            response = Response(status=status.HTTP_302_FOUND)
            response["Location"] = redirect_url
            return response

        success_response = Response(
            {"detail": "Token is valid.", "token": token}, status=status.HTTP_200_OK
        )
        return success_response

    new_password = (
        request.data.get("new_password")
        or request.data.get("newPassword")
        or request.data.get("password")
    )

    if not token or not new_password:
        return _invalid_response("Token and new password are required.")

    user = _get_user_for_password_reset_token(token)
    if not user:
        return _invalid_response("Invalid or expired token.")

    if password_reset_token_expired(user.token_created_at):
        logger.warning("Password reset token missing timestamp for user_id=%s", user.id)
        _clear_password_reset_token(user)
        return _invalid_response("Token has expired.")

    try:
        validate_password(new_password, user)
    except DjangoValidationError as exc:
        return _invalid_response(" ".join(exc.messages))

    try:
        user.set_password(new_password)
        _clear_password_reset_token(user)
        user.save(update_fields=["password"])

        logger.info("Password reset successful for user_id=%s", user.id)
        response = Response(
            {"detail": "Password has been reset successfully."}, status=status.HTTP_200_OK
        )
        return response
    except Exception as e:
        logger.error("Password reset failed for user_id=%s: %s", user.id, str(e))
        response = Response(
            {"error": "Failed to reset password. Please try again."},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )
        return response


@api_view(["POST", "OPTIONS"])
@permission_classes([AllowAny])
@throttle_classes([AuthAnonThrottle, AuthUserThrottle])
def request_password_reset(request):
    """Handle password reset requests by generating a token and emailing the user."""
    if request.method == "OPTIONS":
        return Response(status=status.HTTP_200_OK)

    email = request.data.get("email")
    if not email:
        return Response({"message": "Email is required"}, status=status.HTTP_400_BAD_REQUEST)

    normalized_email = email.strip().lower()
    user = None

    try:
        user = User.objects.filter(email__iexact=normalized_email).first()
    except Exception as exc:  # pragma: no cover - defensive logging
        logger.exception("Unexpected error while looking up user for password reset: %s", exc)

    if user:
        try:
            token = generate_password_reset_token()
            user.password_reset_token = hash_password_reset_token(token)
            user.token_created_at = timezone.now()
            user.save(update_fields=["password_reset_token", "token_created_at"])

            base_url = getattr(settings, "FRONTEND_BASE_URL", None) or request.build_absolute_uri(
                "/"
            )
            if not base_url.endswith("/"):
                base_url = f"{base_url}/"
            reset_link = urljoin(base_url, f"reset-password/{token}")

            from_email = getattr(settings, "DEFAULT_FROM_EMAIL", None)
            if from_email:
                email_subject = "Password Reset Request"
                email_body = (
                    "You recently requested to reset your IRLobby password.\n\n"
                    f"Use the link below to set a new password: {reset_link}\n\n"
                    "If you did not request a password reset, you can safely ignore this message."
                )
                try:
                    send_mail(
                        email_subject,
                        email_body,
                        from_email,
                        [user.email],
                        fail_silently=False,
                    )
                except Exception as exc:  # pragma: no cover - defensive logging
                    logger.exception(
                        "Failed to send password reset email to user_id=%s: %s", user.id, exc
                    )
            else:
                logger.warning(
                    "DEFAULT_FROM_EMAIL is not configured; skipping password reset email send."
                )
        except Exception as exc:  # pragma: no cover - defensive logging
            logger.exception(
                "Failed to process password reset for user_id=%s: %s",
                user.id if user else None,
                exc,
            )

    return Response(
        {"message": "If an account with that email exists, a password reset link has been sent."},
        status=status.HTTP_200_OK,
    )


@api_view(["GET"])
@authentication_classes([])
@permission_classes([AllowAny])
def app_config(request):
    """Public app settings the clients need before sign-in: legal links and contacts."""

    def clean(value):
        value = (value or "").strip() if isinstance(value, str) else ""
        return value or None

    church_admin = {
        "name": clean(settings.FOYER_CHURCH_ADMIN_CONTACT_NAME),
        "email": clean(settings.FOYER_CHURCH_ADMIN_CONTACT_EMAIL),
        "phone": clean(settings.FOYER_CHURCH_ADMIN_PHONE),
    }
    return Response(
        {
            "terms_url": clean(settings.FOYER_TERMS_URL),
            "privacy_url": clean(settings.FOYER_PRIVACY_URL),
            "support_email": clean(settings.FOYER_SUPPORT_EMAIL),
            "church_admin": church_admin if any(church_admin.values()) else None,
        }
    )
