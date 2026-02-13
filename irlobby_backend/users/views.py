from rest_framework import generics, status
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenRefreshView
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from django.http import JsonResponse
from django.conf import settings
from django.db import transaction
from django.utils import timezone
import logging
from django.core.mail import send_mail
from django.utils.crypto import get_random_string
from datetime import timedelta

from urllib.parse import urljoin

from .throttles import AuthAnonThrottle, AuthUserThrottle
from .utils import set_refresh_cookie, clear_refresh_cookie
from .models import User
from .serializers import UserSerializer, UserRegistrationSerializer, UserLoginSerializer
from activities.models import Activity
from swipes.models import Swipe
from matches.models import Match
from reviews.models import Review

logger = logging.getLogger(__name__)


class UserProfileView(generics.RetrieveUpdateAPIView):
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated]

    def get_object(self):
        return self.request.user


@api_view(['POST', 'OPTIONS'])
@permission_classes([AllowAny])
@throttle_classes([AuthAnonThrottle, AuthUserThrottle])
def register(request):
    """Handle user registration."""
    logger.info(f"Register request method: {request.method}, origin: {request.META.get('HTTP_ORIGIN')}")

    # Handle OPTIONS request for CORS preflight
    if request.method == 'OPTIONS':
        logger.info("Handling OPTIONS preflight for register")
        response = Response(status=status.HTTP_200_OK)
        # Add CORS headers for preflight responses
        response['Access-Control-Allow-Origin'] = request.META.get('HTTP_ORIGIN', '*')
        response['Access-Control-Allow-Methods'] = 'POST, OPTIONS'
        response['Access-Control-Allow-Headers'] = 'Content-Type, Authorization'
        response['Access-Control-Allow-Credentials'] = 'true'
        return response

    try:
        logger.info(f"Registration attempt for email: {request.data.get('email')}")
        serializer = UserRegistrationSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.save()
            refresh = RefreshToken.for_user(user)
            logger.info("User registration succeeded for user_id=%s email=%s", user.id, user.email)
            response_payload = {
                'user': UserSerializer(user).data,
                'tokens': {
                    'refresh': str(refresh),
                    'access': str(refresh.access_token),
                }
            }
            response = Response(response_payload, status=status.HTTP_201_CREATED)
            # Add CORS headers to successful response
            response['Access-Control-Allow-Origin'] = request.META.get('HTTP_ORIGIN', '*')
            response['Access-Control-Allow-Credentials'] = 'true'
            return response

        logger.warning("User registration failed for email=%s errors=%s", request.data.get('email'), serializer.errors)
        response = Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        response['Access-Control-Allow-Origin'] = request.META.get('HTTP_ORIGIN', '*')
        response['Access-Control-Allow-Credentials'] = 'true'
        return response
    except Exception as e:
        logger.error("Registration error: %s", str(e))
        response = Response({'error': 'Internal server error'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        response['Access-Control-Allow-Origin'] = request.META.get('HTTP_ORIGIN', '*')
        response['Access-Control-Allow-Credentials'] = 'true'
        return response


@api_view(['POST', 'OPTIONS'])
@permission_classes([AllowAny])
@throttle_classes([AuthAnonThrottle, AuthUserThrottle])
def login(request):
    """Handle user login with email and password."""
    logger.info(f"Login request method: {request.method}, origin: {request.META.get('HTTP_ORIGIN')}")

    # Handle OPTIONS request for CORS preflight
    if request.method == 'OPTIONS':
        logger.info("Handling OPTIONS preflight for login")
        response = Response(status=status.HTTP_200_OK)
        # Add CORS headers for preflight responses
        response['Access-Control-Allow-Origin'] = request.META.get('HTTP_ORIGIN', '*')
        response['Access-Control-Allow-Methods'] = 'POST, OPTIONS'
        response['Access-Control-Allow-Headers'] = 'Content-Type, Authorization'
        response['Access-Control-Allow-Credentials'] = 'true'
        return response

    try:
        logger.info(f"Login attempt for email: {request.data.get('email')}")
        serializer = UserLoginSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.validated_data['user']
            refresh = RefreshToken.for_user(user)
            logger.info("User login succeeded for user_id=%s email=%s", user.id, user.email)
            response_payload = {
                'user': UserSerializer(user).data,
                'tokens': {
                    'refresh': str(refresh),
                    'access': str(refresh.access_token),
                }
            }
            response = Response(response_payload, status=status.HTTP_200_OK)
            # Add CORS headers to successful response
            response['Access-Control-Allow-Origin'] = request.META.get('HTTP_ORIGIN', '*')
            response['Access-Control-Allow-Credentials'] = 'true'
            return response

        logger.warning("User login failed for email=%s errors=%s", request.data.get('email'), serializer.errors)
        response = Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        response['Access-Control-Allow-Origin'] = request.META.get('HTTP_ORIGIN', '*')
        response['Access-Control-Allow-Credentials'] = 'true'
        return response
    except Exception as e:
        logger.error("Login error: %s", str(e))
        response = Response({'error': 'Internal server error'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        response['Access-Control-Allow-Origin'] = request.META.get('HTTP_ORIGIN', '*')
        response['Access-Control-Allow-Credentials'] = 'true'
        return response


@api_view(['POST'])
@permission_classes([AllowAny])
@throttle_classes([AuthAnonThrottle, AuthUserThrottle])
def logout_view(request):
    """Invalidate the refresh token and clear the cookie."""
    refresh_token_value = request.COOKIES.get(settings.REFRESH_TOKEN_COOKIE_NAME) or request.data.get('refresh')
    response = Response(status=status.HTTP_204_NO_CONTENT)

    if refresh_token_value:
        try:
            token = RefreshToken(refresh_token_value)
            token.blacklist()
        except TokenError as exc:
            logger.debug('Refresh token blacklist skipped: %s', exc)
        except Exception as exc:  # pragma: no cover - unexpected edge case
            logger.warning('Unexpected error while blacklisting refresh token: %s', exc)

    clear_refresh_cookie(response)
    user_identifier = request.user.id if request.user.is_authenticated else None
    logger.info('Logout processed user_id=%s authenticated=%s', user_identifier, request.user.is_authenticated)
    return response


class CookieTokenRefreshView(TokenRefreshView):
    """Refresh access tokens while managing secure refresh cookies."""

    def post(self, request, *args, **kwargs):
        request_data = self._with_cookie_refresh(request)
        serializer = self.get_serializer(data=request_data)
        try:
            serializer.is_valid(raise_exception=True)
        except InvalidToken as exc:
            logger.warning('Token refresh rejected: %s', exc)
            response = Response({
                'error': 'Invalid or expired refresh token',
                'error_code': 'invalid_refresh'
            }, status=status.HTTP_401_UNAUTHORIZED)
            clear_refresh_cookie(response)
            return response

        response = Response(serializer.validated_data, status=status.HTTP_200_OK)
        refresh_token = serializer.validated_data.get('refresh')
        if isinstance(refresh_token, str):
            set_refresh_cookie(response, refresh_token)
        else:
            cookie_token = request_data.get('refresh')
            if isinstance(cookie_token, str):
                set_refresh_cookie(response, cookie_token)
        return response

    def _with_cookie_refresh(self, request):
        if hasattr(request.data, 'copy'):
            data = request.data.copy()
        else:
            data = dict(request.data)
        if not data.get('refresh'):
            cookie_token = request.COOKIES.get(settings.REFRESH_TOKEN_COOKIE_NAME)
            if cookie_token:
                data['refresh'] = cookie_token
        return data


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def export_user_data(request):
    """Export all user data as JSON"""
    user = request.user

    try:
        user_data = {
            'export_date': timezone.now().isoformat(),
            'user_profile': UserSerializer(user).data,
            'hosted_activities': [
                {
                    'id': activity.id,
                    'title': activity.title,
                    'description': activity.description,
                    'location': activity.location,
                    'latitude': activity.latitude,
                    'longitude': activity.longitude,
                    'time': activity.time.isoformat(),
                    'capacity': activity.capacity,
                    'tags': activity.tags,
                    'images': activity.images,
                    'created_at': activity.created_at.isoformat(),
                    'participant_count': activity.participants.count(),
                }
                for activity in user.hosted_activities.all()
            ],
            'activity_participations': [
                {
                    'activity_id': participation.activity.id,
                    'activity_title': participation.activity.title,
                    'status': participation.status,
                    'joined_at': participation.joined_at.isoformat(),
                }
                for participation in user.participating_activities.all()
            ],
            'swipes': [
                {
                    'activity_id': swipe.activity.id,
                    'activity_title': swipe.activity.title,
                    'direction': swipe.direction,
                    'created_at': swipe.created_at.isoformat(),
                }
                for swipe in user.swipe_set.all()
            ],
            'matches': [
                {
                    'match_id': match.id,
                    'activity_title': match.activity.title if match.activity else None,
                    'other_user': {
                        'id': match.user_b.id if match.user_a == user else match.user_a.id,
                        'username': match.user_b.username if match.user_a == user else match.user_a.username,
                        'email': match.user_b.email if match.user_a == user else match.user_a.email,
                    },
                    'created_at': match.created_at.isoformat(),
                }
                for match in user.matches_as_a.all() | user.matches_as_b.all()
            ],
            'reviews_given': [
                {
                    'review_id': review.id,
                    'activity_title': review.activity.title,
                    'reviewee_username': review.reviewee.username,
                    'rating': review.rating,
                    'comment': review.comment,
                    'created_at': review.created_at.isoformat(),
                }
                for review in user.given_reviews.all()
            ],
            'reviews_received': [
                {
                    'review_id': review.id,
                    'activity_title': review.activity.title,
                    'reviewer_username': review.reviewer.username,
                    'rating': review.rating,
                    'comment': review.comment,
                    'created_at': review.created_at.isoformat(),
                }
                for review in user.received_reviews.all()
            ],
        }

        return JsonResponse(user_data, safe=False)

    except Exception as exc:  # pragma: no cover - defensive logging
        logger.exception("Failed to export user data for user_id=%s", user.id)
        return JsonResponse({
            'error': 'Failed to export user data',
            'details': str(exc)
        }, status=500)


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def delete_profile(request):
    """Delete user profile and all associated data"""
    user = request.user

    try:
        with transaction.atomic():
            user.delete()

        return Response({"message": "Profile deleted successfully"}, status=status.HTTP_204_NO_CONTENT)

    except Exception as exc:  # pragma: no cover - defensive logging
        logger.exception("Failed to delete profile for user_id=%s", user.id)
        return Response({
            'error': 'Failed to delete profile',
            'details': str(exc)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([AllowAny])
@throttle_classes([AuthAnonThrottle, AuthUserThrottle])
def auth_status(request):
    """Return whether the current request is authenticated."""
    if request.user and request.user.is_authenticated:
        return Response({
            'authenticated': True,
            'user': UserSerializer(request.user).data
        })
    return Response({
        'authenticated': False,
        'user': None
    }, status=status.HTTP_401_UNAUTHORIZED)


@api_view(['POST'])
@permission_classes([AllowAny])
@throttle_classes([AuthAnonThrottle, AuthUserThrottle])
def password_reset_request(request):
    """Handle password reset requests."""
    email = request.data.get('email')
    if not email:
        return Response({'error': 'Email address is required.'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        user = User.objects.get(email=email)
    except User.DoesNotExist:
        logger.warning("Password reset requested for non-existent user: email=%s", email)
        return Response({'detail': 'Password reset link has been sent if the email is associated with an account.'}, status=status.HTTP_200_OK)

    token = get_random_string(length=32)
    user.password_reset_token = token
    user.token_created_at = timezone.now()
    user.save()

    reset_link = f"{request.scheme}://{request.get_host()}/reset-password/{token}"
    send_mail(
        'Password Reset Request',
        f'Please use the following link to reset your password: {reset_link}',
        settings.DEFAULT_FROM_EMAIL,
        [user.email],
        fail_silently=False,
    )

    logger.info("Password reset link sent to email=%s", email)
    return Response({'detail': 'Password reset link sent.'}, status=status.HTTP_200_OK)


@api_view(['GET', 'POST', 'OPTIONS'])
@permission_classes([AllowAny])
@throttle_classes([AuthAnonThrottle, AuthUserThrottle])
def password_reset_confirm(request):
    """Handle password reset confirmations."""
    if request.method == 'OPTIONS':
        response = Response(status=status.HTTP_200_OK)
        response['Access-Control-Allow-Origin'] = request.META.get('HTTP_ORIGIN', '*')
        response['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS'
        response['Access-Control-Allow-Headers'] = 'Content-Type, Authorization'
        response['Access-Control-Allow-Credentials'] = 'true'
        return response

    def _invalid_response(message, status_code=status.HTTP_400_BAD_REQUEST):
        error_response = Response({'error': message}, status=status_code)
        error_response['Access-Control-Allow-Origin'] = request.META.get('HTTP_ORIGIN', '*')
        error_response['Access-Control-Allow-Credentials'] = 'true'
        return error_response

    token = None
    if request.method == 'GET':
        token = (
            request.query_params.get('token')
            or request.GET.get('token')  # pragma: no cover - fallback for non-DRF requests
        )
    else:
        token = request.data.get('token') or request.data.get('resetToken')

    if request.method == 'GET':
        if not token:
            return _invalid_response('Token is required.')

        try:
            user = User.objects.get(password_reset_token=token)
        except User.DoesNotExist:
            return _invalid_response('Invalid or expired token.')
        except User.MultipleObjectsReturned:
            logger.warning('Multiple users share password reset token=%s; clearing collisions.', token)
            User.objects.filter(password_reset_token=token).update(
                password_reset_token=None,
                token_created_at=None,
            )
            return _invalid_response('Invalid or expired token.')

        if not user.token_created_at:
            logger.warning('Password reset token missing timestamp for user_id=%s', user.id)
            user.password_reset_token = None
            user.save(update_fields=['password_reset_token'])
            return _invalid_response('Token has expired.')

        token_age = timezone.now() - user.token_created_at
        if token_age > timedelta(hours=2):
            user.password_reset_token = None
            user.token_created_at = None
            user.save(update_fields=['password_reset_token', 'token_created_at'])
            return _invalid_response('Token has expired.')

        frontend_base = getattr(settings, 'FRONTEND_BASE_URL', '').rstrip('/')
        if frontend_base:
            reset_path = f"reset-password/{token}"
            redirect_url = urljoin(f"{frontend_base}/", reset_path)
            response = Response(status=status.HTTP_302_FOUND)
            response['Location'] = redirect_url
            response['Access-Control-Allow-Origin'] = request.META.get('HTTP_ORIGIN', '*')
            response['Access-Control-Allow-Credentials'] = 'true'
            return response

        success_response = Response({'detail': 'Token is valid.', 'token': token}, status=status.HTTP_200_OK)
        success_response['Access-Control-Allow-Origin'] = request.META.get('HTTP_ORIGIN', '*')
        success_response['Access-Control-Allow-Credentials'] = 'true'
        return success_response

    new_password = (
        request.data.get('new_password')
        or request.data.get('newPassword')
        or request.data.get('password')
    )

    if not token or not new_password:
        return _invalid_response('Token and new password are required.')

    try:
        user = User.objects.get(password_reset_token=token)
    except User.DoesNotExist:
        return _invalid_response('Invalid or expired token.')
    except User.MultipleObjectsReturned:
        logger.warning('Multiple users share password reset token=%s; clearing collisions.', token)
        User.objects.filter(password_reset_token=token).update(
            password_reset_token=None,
            token_created_at=None,
        )
        return _invalid_response('Invalid or expired token.')

    if not user.token_created_at:
        logger.warning('Password reset token missing timestamp for user_id=%s', user.id)
        user.password_reset_token = None
        user.save(update_fields=['password_reset_token'])
        return _invalid_response('Token has expired.')

    token_age = timezone.now() - user.token_created_at
    if token_age > timedelta(hours=2):
        user.password_reset_token = None
        user.token_created_at = None
        user.save(update_fields=['password_reset_token', 'token_created_at'])
        return _invalid_response('Token has expired.')

    # Validate password strength
    if len(new_password) < 8:
        return _invalid_response('Password must be at least 8 characters long.')

    try:
        user.set_password(new_password)
        user.password_reset_token = None
        user.token_created_at = None
        user.save(update_fields=['password', 'password_reset_token', 'token_created_at'])

        logger.info("Password reset successful for user_id=%s", user.id)
        response = Response({'detail': 'Password has been reset successfully.'}, status=status.HTTP_200_OK)
        response['Access-Control-Allow-Origin'] = request.META.get('HTTP_ORIGIN', '*')
        response['Access-Control-Allow-Credentials'] = 'true'
        return response
    except Exception as e:
        logger.error("Password reset failed for user_id=%s: %s", user.id, str(e))
        response = Response({'error': 'Failed to reset password. Please try again.'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        response['Access-Control-Allow-Origin'] = request.META.get('HTTP_ORIGIN', '*')
        response['Access-Control-Allow-Credentials'] = 'true'
        return response


@api_view(['POST', 'OPTIONS'])
@permission_classes([AllowAny])
@throttle_classes([AuthAnonThrottle, AuthUserThrottle])
def request_password_reset(request):
    """Handle password reset requests by generating a token and emailing the user."""
    if request.method == 'OPTIONS':
        return Response(status=status.HTTP_200_OK)

    email = request.data.get('email')
    if not email:
        return Response({'message': 'Email is required'}, status=status.HTTP_400_BAD_REQUEST)

    normalized_email = email.strip().lower()
    user = None

    try:
        user = User.objects.filter(email__iexact=normalized_email).first()
    except Exception as exc:  # pragma: no cover - defensive logging
        logger.exception('Unexpected error while looking up user for password reset: %s', exc)

    if user:
        try:
            token = get_random_string(length=32)
            user.password_reset_token = token
            user.token_created_at = timezone.now()
            user.save(update_fields=['password_reset_token', 'token_created_at'])

            base_url = getattr(settings, 'FRONTEND_BASE_URL', None) or request.build_absolute_uri('/')
            if not base_url.endswith('/'):
                base_url = f"{base_url}/"
            reset_link = urljoin(base_url, f"reset-password/{token}")

            from_email = getattr(settings, 'DEFAULT_FROM_EMAIL', None)
            if from_email:
                email_subject = 'Password Reset Request'
                email_body = (
                    'You recently requested to reset your IRLobby password.\n\n'
                    f'Use the link below to set a new password: {reset_link}\n\n'
                    'If you did not request a password reset, you can safely ignore this message.'
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
                    logger.exception('Failed to send password reset email to user_id=%s: %s', user.id, exc)
            else:
                logger.warning('DEFAULT_FROM_EMAIL is not configured; skipping password reset email send.')
        except Exception as exc:  # pragma: no cover - defensive logging
            logger.exception('Failed to process password reset for user_id=%s: %s', user.id if user else None, exc)

    return Response(
        {'message': 'If an account with that email exists, a password reset link has been sent.'},
        status=status.HTTP_200_OK,
    )

