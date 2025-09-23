from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework import status
from django.contrib.auth import get_user_model
from django.conf import settings
from django.core.cache import cache
from rest_framework_simplejwt.tokens import RefreshToken
import requests
import secrets
import hashlib
import base64
import logging
from urllib.parse import urlencode, quote
from .serializers import UserSerializer

logger = logging.getLogger(__name__)

User = get_user_model()

def generate_code_verifier():
    """Generate a random code verifier for PKCE"""
    return secrets.token_urlsafe(32)

def generate_code_challenge(code_verifier):
    """Generate code challenge from code verifier"""
    code_challenge = hashlib.sha256(code_verifier.encode('utf-8')).digest()
    return base64.urlsafe_b64encode(code_challenge).decode('utf-8').rstrip('=')

@api_view(['GET'])
@permission_classes([AllowAny])
def twitter_oauth_url(request):
    """Get Twitter OAuth authorization URL"""
    try:
        client_id = getattr(settings, 'TWITTER_CLIENT_ID', None)
        if not client_id or client_id == '':
            return Response({
                'error': 'Twitter OAuth not configured. Please contact support.'
            }, status=status.HTTP_503_SERVICE_UNAVAILABLE)

        # Generate PKCE values
        code_verifier = generate_code_verifier()
        code_challenge = generate_code_challenge(code_verifier)

        # Use explicit redirect URI based on environment
        if getattr(settings, 'DEBUG', False):
            redirect_uri = 'http://localhost:5173/auth/twitter/callback'
        else:
            redirect_uri = 'https://irlobby.vercel.app/auth/twitter/callback'

        scope = 'tweet.read users.read'

        # Validate credentials before proceeding
        client_secret = getattr(settings, 'TWITTER_CLIENT_SECRET', None)
        if not client_secret or client_secret == '':
            return Response({
                'error': 'Twitter OAuth configuration incomplete'
            }, status=status.HTTP_503_SERVICE_UNAVAILABLE)

        # Generate secure random state for CSRF protection
        state = secrets.token_urlsafe(32)

        params = {
            'response_type': 'code',
            'client_id': client_id,
            'redirect_uri': redirect_uri,
            'scope': scope,
            'state': state,
            'code_challenge': code_challenge,
            'code_challenge_method': 'S256',
        }
        auth_url = f"https://twitter.com/i/oauth2/authorize?{urlencode(params, quote_via=quote)}"

        # Store code_verifier in cache using state as key (expires in 10 minutes)
        cache.set(f'twitter_oauth_{state}', code_verifier, timeout=600)

        return Response({
            'auth_url': auth_url,
            'state': state  # Return state for frontend validation
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
        code = request.GET.get('code')
        state = request.GET.get('state')

        if not code:
            return Response({'error': 'Authorization code required'}, status=status.HTTP_400_BAD_REQUEST)

        if not state:
            return Response({'error': 'State parameter required'}, status=status.HTTP_400_BAD_REQUEST)

        # Retrieve code_verifier from cache using state as key
        code_verifier = cache.get(f'twitter_oauth_{state}')
        if not code_verifier:
            return Response({'error': 'Session expired or invalid state'}, status=status.HTTP_400_BAD_REQUEST)

        # Clean up the cached code_verifier
        cache.delete(f'twitter_oauth_{state}')

        client_id = getattr(settings, 'TWITTER_CLIENT_ID', None)
        client_secret = getattr(settings, 'TWITTER_CLIENT_SECRET', None)

        if not client_id or not client_secret:
            logger.error("Twitter OAuth credentials not configured")
            return Response({'error': 'Twitter OAuth not configured'}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

        # Use explicit redirect URI based on environment (must match the one used in authorization URL)
        if getattr(settings, 'DEBUG', False):
            redirect_uri = 'http://localhost:5173/auth/twitter/callback'
        else:
            redirect_uri = 'https://irlobby.vercel.app/auth/twitter/callback'

        # Exchange code for access token
        token_url = "https://api.twitter.com/2/oauth2/token"

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
            logger.info(f"Token exchange request to: {token_url}")
            logger.info(f"Using redirect_uri: {redirect_uri}")
            logger.info(f"Client ID: {client_id[:10]}...")
            logger.info(f"Has client secret: {'YES' if client_secret else 'NO'}")
        except requests.RequestException as e:
            logger.error(f"Twitter token exchange network error: {str(e)}")
            logger.error(f"Request details - URL: {token_url}, Data keys: {list(token_data.keys())}")
            return Response({'error': 'Failed to connect to Twitter'}, status=status.HTTP_502_BAD_GATEWAY)

        if token_response.status_code != 200:
            logger.error(f"Twitter token exchange failed: {token_response.status_code} - {token_response.text}")
            return Response({'error': 'Failed to authenticate with Twitter'}, status=status.HTTP_400_BAD_REQUEST)

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

