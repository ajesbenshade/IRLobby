from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework import status
from django.contrib.auth import get_user_model
from django.conf import settings
from rest_framework_simplejwt.tokens import RefreshToken
import requests
import secrets
import hashlib
import base64
from .serializers import UserSerializer

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
    client_id = getattr(settings, 'TWITTER_CLIENT_ID', None)
    if not client_id or client_id == '':
        return Response({
            'error': 'Twitter OAuth credentials not configured. Please set TWITTER_CLIENT_ID and TWITTER_CLIENT_SECRET environment variables.'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    # Generate PKCE values
    code_verifier = generate_code_verifier()
    code_challenge = generate_code_challenge(code_verifier)

    # Use explicit redirect URI based on environment
    if getattr(settings, 'DEBUG', False):
        redirect_uri = 'http://localhost:5173/auth/twitter/callback'
    else:
        redirect_uri = 'https://irlobby.vercel.app/auth/twitter/callback'

    scope = 'tweet.read users.read'

    auth_url = (
        f"https://twitter.com/i/oauth2/authorize?"
        f"response_type=code&"
        f"client_id={client_id}&"
        f"redirect_uri={redirect_uri}&"
        f"scope={scope}&"
        f"state=state&"
        f"code_challenge={code_challenge}&"
        f"code_challenge_method=S256"
    )

    return Response({
        'auth_url': auth_url,
        'code_verifier': code_verifier  # Frontend needs to store this for the callback
    })

@api_view(['GET'])
@permission_classes([AllowAny])
def twitter_oauth_callback(request):
    """Handle Twitter OAuth callback"""
    code = request.GET.get('code')
    code_verifier = request.GET.get('code_verifier')  # Frontend should pass this back

    if not code:
        return Response({'error': 'Authorization code required'}, status=status.HTTP_400_BAD_REQUEST)

    if not code_verifier:
        return Response({'error': 'Code verifier required'}, status=status.HTTP_400_BAD_REQUEST)

    client_id = getattr(settings, 'TWITTER_CLIENT_ID', None)
    client_secret = getattr(settings, 'TWITTER_CLIENT_SECRET', None)

    if not client_id or not client_secret:
        return Response({'error': 'Twitter OAuth not configured'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

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
    token_response = requests.post(token_url, data=token_data, auth=auth)

    if token_response.status_code != 200:
        return Response({'error': 'Failed to get access token'}, status=status.HTTP_400_BAD_REQUEST)

    token_data = token_response.json()
    access_token = token_data.get('access_token')

    # Get user info from Twitter (including email)
    user_url = "https://api.twitter.com/2/users/me"
    headers = {'Authorization': f'Bearer {access_token}'}
    params = {'user.fields': 'name,username'}
    user_response = requests.get(user_url, headers=headers, params=params)

    if user_response.status_code != 200:
        return Response({'error': 'Failed to get user info'}, status=status.HTTP_400_BAD_REQUEST)

    twitter_user = user_response.json()['data']

    # Create or get user
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

    # Generate JWT tokens and set httpOnly cookies
    refresh = RefreshToken.for_user(user)

    response = Response({
        'user': UserSerializer(user).data,
        'created': created
    }, status=status.HTTP_200_OK)

    # Debug logging
    import logging
    logger = logging.getLogger(__name__)
    logger.info(f"OAuth callback - Setting cookies for user: {user.username}")
    logger.info(f"OAuth callback - Access token: {str(refresh.access_token)[:20]}...")
    logger.info(f"OAuth callback - Refresh token: {str(refresh)[:20]}...")

    response.set_cookie(
        'access_token',
        str(refresh.access_token),
        httponly=True,
        secure=not settings.DEBUG,
        samesite='None' if not settings.DEBUG else 'Lax',
        path='/',
        max_age=60 * 60  # 1 hour
    )
    response.set_cookie(
        'refresh_token',
        str(refresh),
        httponly=True,
        secure=not settings.DEBUG,
        samesite='None' if not settings.DEBUG else 'Lax',
        path='/',
        max_age=60 * 60 * 24 * 7  # 7 days
    )

    logger.info(f"OAuth callback - Response cookies: {response.cookies}")

    return response
