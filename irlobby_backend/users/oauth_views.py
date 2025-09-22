from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework import status
from django.contrib.auth import get_user_model
from django.conf import settings
from rest_framework_simplejwt.tokens import RefreshToken
from django.utils import timezone
import requests
import secrets
import hashlib
import base64
import logging
from .serializers import UserSerializer
from .throttles import AuthAnonThrottle, AuthUserThrottle

logger = logging.getLogger(__name__)

User = get_user_model()


def generate_code_verifier() -> str:
    """Generate a random code verifier for PKCE"""
    return secrets.token_urlsafe(64)


def generate_code_challenge(code_verifier: str) -> str:
    """Generate code challenge from code verifier"""
    code_challenge = hashlib.sha256(code_verifier.encode('utf-8')).digest()
    return base64.urlsafe_b64encode(code_challenge).decode('utf-8').rstrip('=')


def build_redirect_uri() -> str:
    """Return the correct redirect URI for the current environment."""
    if getattr(settings, 'DEBUG', False):
        return 'http://localhost:5173/auth/twitter/callback'
    return 'https://irlobby.vercel.app/auth/twitter/callback'


@api_view(['GET'])
@permission_classes([AllowAny])
@throttle_classes([AuthAnonThrottle, AuthUserThrottle])
def twitter_oauth_url(request):
    """Get Twitter OAuth authorization URL"""
    try:
        client_id = getattr(settings, 'TWITTER_CLIENT_ID', None)
        client_secret = getattr(settings, 'TWITTER_CLIENT_SECRET', None)
        if not client_id or not client_secret:
            logger.error('Twitter OAuth credentials missing')
            return Response({
                'error': 'Twitter OAuth not configured. Please contact support.'
            }, status=status.HTTP_503_SERVICE_UNAVAILABLE)

        # Generate PKCE + state values and store server-side for verification
        code_verifier = generate_code_verifier()
        code_challenge = generate_code_challenge(code_verifier)
        state_token = secrets.token_urlsafe(32)
        request.session['twitter_code_verifier'] = code_verifier
        request.session['twitter_oauth_state'] = state_token
        request.session['twitter_oauth_issued_at'] = timezone.now().isoformat()
        request.session.modified = True

        redirect_uri = build_redirect_uri()
        scope = 'tweet.read users.read'

        # Build the authorization URL with proper encoding
        auth_url = (
            'https://twitter.com/i/oauth2/authorize?'
            f'response_type=code&'
            f'client_id={client_id}&'
            f'redirect_uri={redirect_uri}&'
            f'scope={scope}&'
            f'state={state_token}&'
            f'code_challenge={code_challenge}&'
            'code_challenge_method=S256'
        )

        return Response({
            'auth_url': auth_url,
            'code_verifier': code_verifier,
        })

    except Exception as exc:  # pragma: no cover - defensive logging
        logger.exception('Twitter OAuth URL generation failed: %s', exc)
        return Response({
            'error': 'Failed to generate Twitter OAuth URL. Please try again later.'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([AllowAny])
@throttle_classes([AuthAnonThrottle, AuthUserThrottle])
def twitter_oauth_callback(request):
    """Handle Twitter OAuth callback"""
    try:
        code = request.GET.get('code')
        returned_state = request.GET.get('state')
        code_verifier = request.session.pop('twitter_code_verifier', None)
        if not code_verifier:
            code_verifier = request.GET.get('code_verifier')
            if code_verifier:
                logger.info('Using code_verifier from request parameters as session data was unavailable')
        expected_state = request.session.pop('twitter_oauth_state', None)
        request.session.pop('twitter_oauth_issued_at', None)

        if not code:
            return Response({'error': 'Authorization code required'}, status=status.HTTP_400_BAD_REQUEST)

        if not code_verifier:
            logger.warning('Twitter OAuth callback missing code_verifier')
            return Response({'error': 'Code verifier missing or expired. Please restart the login process.'}, status=status.HTTP_400_BAD_REQUEST)

        if not expected_state or expected_state != returned_state:
            logger.warning('Twitter OAuth callback state mismatch expected=%s received=%s', expected_state, returned_state)
            return Response({'error': 'Invalid OAuth state. Please retry the login process.'}, status=status.HTTP_400_BAD_REQUEST)

        client_id = getattr(settings, 'TWITTER_CLIENT_ID', None)
        client_secret = getattr(settings, 'TWITTER_CLIENT_SECRET', None)

        if not client_id or not client_secret:
            logger.error('Twitter OAuth credentials not configured during callback')
            return Response({'error': 'Twitter OAuth not configured'}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

        redirect_uri = build_redirect_uri()
        token_url = 'https://api.twitter.com/2/oauth2/token'

        token_data = {
            'code': code,
            'grant_type': 'authorization_code',
            'client_id': client_id,
            'redirect_uri': redirect_uri,
            'code_verifier': code_verifier
        }

        auth = (client_id, client_secret)

        try:
            token_response = requests.post(token_url, data=token_data, auth=auth, timeout=30)
        except requests.RequestException as exc:
            logger.warning('Twitter token exchange network failure: %s', exc)
            return Response({'error': 'Failed to connect to Twitter'}, status=status.HTTP_502_BAD_GATEWAY)

        if token_response.status_code != 200:
            logger.warning('Twitter token exchange failed: %s - %s', token_response.status_code, token_response.text)
            return Response({'error': 'Failed to authenticate with Twitter'}, status=status.HTTP_400_BAD_REQUEST)

        token_payload = token_response.json()
        access_token = token_payload.get('access_token')

        if not access_token:
            logger.error('No access token received from Twitter response=%s', token_payload)
            return Response({'error': 'Invalid response from Twitter'}, status=status.HTTP_502_BAD_GATEWAY)

        user_url = 'https://api.twitter.com/2/users/me'
        headers = {'Authorization': f'Bearer {access_token}'}
        params = {'user.fields': 'name,username'}

        try:
            user_response = requests.get(user_url, headers=headers, params=params, timeout=30)
        except requests.RequestException as exc:
            logger.warning('Twitter user info request failed: %s', exc)
            return Response({'error': 'Failed to get user information from Twitter'}, status=status.HTTP_502_BAD_GATEWAY)

        if user_response.status_code != 200:
            logger.warning('Twitter user info failed: %s - %s', user_response.status_code, user_response.text)
            return Response({'error': 'Failed to get user information from Twitter'}, status=status.HTTP_502_BAD_GATEWAY)

        twitter_user = user_response.json().get('data')
        if not twitter_user:
            logger.error('Twitter response missing user data: %s', user_response.json())
            return Response({'error': 'Invalid response from Twitter'}, status=status.HTTP_502_BAD_GATEWAY)

        user, created = User.objects.get_or_create(
            oauth_id=twitter_user['id'],
            oauth_provider='twitter',
            defaults={
                'username': twitter_user['username'],
                'email': f"{twitter_user['username']}@twitter.local",
                'first_name': twitter_user.get('name', '').split()[0] if twitter_user.get('name') else '',
                'last_name': ' '.join(twitter_user.get('name', '').split()[1:]) if twitter_user.get('name') and len(twitter_user.get('name', '').split()) > 1 else '',
            }
        )

        refresh = RefreshToken.for_user(user)

        return Response({
            'user': UserSerializer(user).data,
            'tokens': {
                'refresh': str(refresh),
                'access': str(refresh.access_token),
            },
            'created': created
        }, status=status.HTTP_200_OK)

    except Exception as exc:  # pragma: no cover - defensive logging
        logger.exception('Twitter OAuth callback failed: %s', exc)
        return Response({
            'error': 'Authentication failed. Please try again.'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
