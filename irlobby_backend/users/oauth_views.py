from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework import status
from django.contrib.auth import get_user_model
from django.conf import settings
from django.core.cache import cache
from rest_framework_simplejwt.tokens import RefreshToken
from decouple import config as env_config
import requests
import secrets
import hashlib
import base64
import logging
from urllib.parse import quote
from .serializers import UserSerializer

logger = logging.getLogger(__name__)

User = get_user_model()


def get_twitter_credentials():
    client_id = getattr(settings, 'TWITTER_CLIENT_ID', None) or env_config(
        'TWITTER_CLIENT_ID', default=''
    )
    client_secret = getattr(settings, 'TWITTER_CLIENT_SECRET', None) or env_config(
        'TWITTER_CLIENT_SECRET', default=''
    )
    return client_id, client_secret

def generate_code_verifier():
    """Generate a random code verifier for PKCE"""
    return secrets.token_urlsafe(32)

def generate_code_challenge(code_verifier):
    """Generate code challenge from code verifier"""
    code_challenge = hashlib.sha256(code_verifier.encode('utf-8')).digest()
    return base64.urlsafe_b64encode(code_challenge).decode('utf-8').rstrip('=')


def resolve_frontend_origin(request):
    """Resolve frontend origin for OAuth redirects."""
    request_origin = (request.META.get('HTTP_ORIGIN') or '').rstrip('/')
    if getattr(settings, 'DEBUG', False):
        if request_origin.startswith('http://localhost:') or request_origin.startswith(
            'http://127.0.0.1:'
        ):
            return request_origin

    frontend_base_url = getattr(settings, 'FRONTEND_BASE_URL', None) or 'http://localhost:5173'
    return frontend_base_url.rstrip('/')

@api_view(['GET'])
@permission_classes([AllowAny])
def twitter_oauth_url(request):
    """Get Twitter OAuth authorization URL"""
    try:
        logger.info(f"Twitter OAuth URL request from origin: {request.META.get('HTTP_ORIGIN')}")

        client_id, _ = get_twitter_credentials()
        if not client_id or client_id == '':
            logger.error("TWITTER_CLIENT_ID not configured")
            return Response({
                'error': 'Twitter OAuth not configured. Please contact support.'
            }, status=status.HTTP_503_SERVICE_UNAVAILABLE)

        logger.info(f"Using Twitter Client ID: {client_id[:10]}...")

        # Generate PKCE values
        code_verifier = generate_code_verifier()
        code_challenge = generate_code_challenge(code_verifier)

        frontend_origin = resolve_frontend_origin(request)
        redirect_uri = f'{frontend_origin}/auth/twitter/callback'

        logger.info(f"Using redirect URI: {redirect_uri}")

        # Store OAuth session details in cache with state as key
        state = secrets.token_urlsafe(32)
        cache.set(
            f'twitter_oauth_{state}',
            {
                'code_verifier': code_verifier,
                'redirect_uri': redirect_uri,
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

        logger.info(f"Generated Twitter OAuth URL for state: {state[:10]}...")

        return Response({
            'auth_url': auth_url,
            'state': state
        })

    except Exception as e:
        logger.error(f"Twitter OAuth URL generation failed: {str(e)}")
        return Response({
            'error': 'Failed to generate Twitter OAuth URL. Please try again later.'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['GET'])
@permission_classes([AllowAny])
def twitter_oauth_callback(request):
    """Handle Twitter OAuth callback"""
    try:
        logger.info(f"Twitter OAuth callback received from origin: {request.META.get('HTTP_ORIGIN')}")
        code = request.GET.get('code')
        state = request.GET.get('state')

        logger.info(f"Twitter callback - code present: {bool(code)}, state present: {bool(state)}")

        if not code:
            logger.warning("Twitter callback missing authorization code")
            return Response({'error': 'Authorization code required'}, status=status.HTTP_400_BAD_REQUEST)

        if not state:
            logger.warning("Twitter callback missing state parameter")
            return Response({'error': 'State parameter required'}, status=status.HTTP_400_BAD_REQUEST)

        # Retrieve OAuth session details from cache using state as key
        oauth_session = cache.get(f'twitter_oauth_{state}')
        if not oauth_session:
            logger.warning(f"Twitter callback - invalid or expired state: {state[:10]}...")
            return Response({'error': 'Session expired or invalid state'}, status=status.HTTP_400_BAD_REQUEST)

        if isinstance(oauth_session, dict):
            code_verifier = oauth_session.get('code_verifier')
            redirect_uri = oauth_session.get('redirect_uri')
        else:
            # Backward compatibility for previously cached values
            code_verifier = oauth_session
            frontend_origin = resolve_frontend_origin(request)
            redirect_uri = f'{frontend_origin}/auth/twitter/callback'

        if not code_verifier:
            logger.warning("Twitter callback - missing code_verifier in cached state")
            return Response({'error': 'Session invalid. Please try again.'}, status=status.HTTP_400_BAD_REQUEST)

        # Clean up the cached code_verifier
        cache.delete(f'twitter_oauth_{state}')
        logger.info("Twitter callback - retrieved and cleared code_verifier from cache")

        client_id, client_secret = get_twitter_credentials()

        if not client_id or not client_secret:
            logger.error("Twitter OAuth credentials not configured")
            return Response({'error': 'Twitter OAuth not configured'}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

        logger.info(f"Twitter callback - using client_id: {client_id[:10]}...")

        logger.info(f"Twitter callback - using redirect_uri: {redirect_uri}")

        # Exchange code for access token using Twitter's OAuth 2.0 token endpoint
        token_url = "https://api.twitter.com/2/oauth2/token"

        token_data = {
            'code': code,
            'grant_type': 'authorization_code',
            'client_id': client_id,
            'redirect_uri': redirect_uri,
            'code_verifier': code_verifier
        }

        # Twitter OAuth 2.0 PKCE requires form-encoded data, not Basic Auth
        headers = {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': 'application/json'
        }

        logger.info(f"Twitter callback - token exchange data: client_id={client_id[:10]}..., redirect_uri={redirect_uri}")

        try:
            token_response = requests.post(token_url, data=token_data, headers=headers, timeout=30)
            logger.info(f"Twitter callback - token response status: {token_response.status_code}")
            logger.info(f"Twitter callback - token response headers: {dict(token_response.headers)}")

            if token_response.status_code != 200:
                logger.error(f"Twitter callback - token exchange failed: {token_response.status_code}")
                logger.error(f"Twitter callback - token response body: {token_response.text}")
                return Response({
                    'error': f'Twitter authentication failed: {token_response.status_code}',
                    'details': token_response.text[:200]
                }, status=status.HTTP_400_BAD_REQUEST)

        except requests.RequestException as e:
            logger.error(f"Twitter callback - network error during token exchange: {str(e)}")
            return Response({'error': 'Failed to connect to Twitter'}, status=status.HTTP_502_BAD_GATEWAY)

        token_data = token_response.json()
        access_token = token_data.get('access_token')

        if not access_token:
            logger.error("No access token received from Twitter")
            return Response({'error': 'Invalid response from Twitter'}, status=status.HTTP_502_BAD_GATEWAY)

        # Get user info from Twitter (including email)
        user_url = "https://api.twitter.com/2/users/me"
        headers = {'Authorization': f'Bearer {access_token}'}
        params = {'user.fields': 'name,username'}
        
        try:
            user_response = requests.get(user_url, headers=headers, params=params, timeout=30)
        except requests.RequestException as e:
            logger.error(f"Twitter user info request failed: {str(e)}")
            return Response({'error': 'Failed to get user information from Twitter'}, status=status.HTTP_502_BAD_GATEWAY)

        if user_response.status_code != 200:
            logger.error(f"Twitter user info failed: {user_response.status_code} - {user_response.text}")
            return Response({'error': 'Failed to get user information from Twitter'}, status=status.HTTP_502_BAD_GATEWAY)

        twitter_user = user_response.json()['data']

        # Create or get user
        user, created = User.objects.get_or_create(
            oauth_id=twitter_user['id'],
            oauth_provider='twitter',
            defaults={
                'username': twitter_user['username'],
                'email': f"{twitter_user['username']}@twitter.oauth.local",  # Use a more specific domain
                'first_name': twitter_user.get('name', '').split()[0] if twitter_user.get('name') else '',
                'last_name': ' '.join(twitter_user.get('name', '').split()[1:]) if twitter_user.get('name') and len(twitter_user.get('name', '').split()) > 1 else '',
            }
        )

        # Generate JWT tokens
        refresh = RefreshToken.for_user(user)

        return Response({
            'user': UserSerializer(user).data,
            'tokens': {
                'refresh': str(refresh),
                'access': str(refresh.access_token),
            },
            'created': created
        }, status=status.HTTP_200_OK)

    except Exception as e:
        logger.error(f"Twitter OAuth callback failed: {str(e)}")
        return Response({
            'error': 'Authentication failed. Please try again.'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['GET'])
@permission_classes([AllowAny])
def twitter_oauth_status(request):
    """Check Twitter OAuth configuration status"""
    try:
        client_id, client_secret = get_twitter_credentials()

        status_info = {
            'configured': bool(client_id and client_secret),
            'client_id_set': bool(client_id),
            'client_secret_set': bool(client_secret),
            'debug_mode': getattr(settings, 'DEBUG', False),
            'redirect_uri': f"{resolve_frontend_origin(request)}/auth/twitter/callback",
        }

        logger.info(f"Twitter OAuth status check: {status_info}")

        return Response(status_info)

    except Exception as e:
        logger.error(f"Twitter OAuth status check failed: {str(e)}")
        return Response({
            'error': 'Failed to check Twitter OAuth status',
            'configured': False
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

