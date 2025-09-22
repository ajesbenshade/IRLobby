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


@api_view(['POST'])
@permission_classes([AllowAny])
@throttle_classes([AuthAnonThrottle, AuthUserThrottle])
def register(request):
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
        set_refresh_cookie(response, str(refresh))
        return response

    logger.warning("User registration failed for email=%s errors=%s", request.data.get('email'), serializer.errors)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([AllowAny])
@throttle_classes([AuthAnonThrottle, AuthUserThrottle])
def login(request):
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
        set_refresh_cookie(response, str(refresh))
        return response

    logger.warning("User login failed for email=%s errors=%s", request.data.get('email'), serializer.errors)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


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
