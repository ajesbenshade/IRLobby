from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework import status
from django.contrib.auth import get_user_model
from django.conf import settings
from rest_framework_simplejwt.tokens import RefreshToken
import requests
from .serializers import UserSerializer

User = get_user_model()

@api_view(['GET'])
@permission_classes([AllowAny])
def twitter_oauth_url(request):
    """Get Twitter OAuth authorization URL"""
    client_id = getattr(settings, 'TWITTER_CLIENT_ID', None)
    if not client_id:
        return Response({'error': 'Twitter OAuth not configured'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    redirect_uri = request.build_absolute_uri('/api/auth/twitter/callback/')
    scope = 'tweet.read users.read email'

    auth_url = (
        f"https://twitter.com/i/oauth2/authorize?"
        f"response_type=code&"
        f"client_id={client_id}&"
        f"redirect_uri={redirect_uri}&"
        f"scope={scope}&"
        f"state=state&"
        f"code_challenge=challenge&"
        f"code_challenge_method=plain"
    )

    return Response({'auth_url': auth_url})

@api_view(['POST'])
@permission_classes([AllowAny])
def twitter_oauth_callback(request):
    """Handle Twitter OAuth callback"""
    code = request.data.get('code')
    if not code:
        return Response({'error': 'Authorization code required'}, status=status.HTTP_400_BAD_REQUEST)

    client_id = getattr(settings, 'TWITTER_CLIENT_ID', None)
    client_secret = getattr(settings, 'TWITTER_CLIENT_SECRET', None)

    if not client_id or not client_secret:
        return Response({'error': 'Twitter OAuth not configured'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    # Exchange code for access token
    token_url = "https://api.twitter.com/2/oauth2/token"
    redirect_uri = request.build_absolute_uri('/api/auth/twitter/callback/')

    token_data = {
        'code': code,
        'grant_type': 'authorization_code',
        'client_id': client_id,
        'redirect_uri': redirect_uri,
        'code_verifier': 'challenge'
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
    params = {'user.fields': 'name,username,email'}
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
            'email': twitter_user.get('email', f"{twitter_user['username']}@twitter.local"),
            'first_name': twitter_user.get('name', '').split()[0] if twitter_user.get('name') else '',
            'last_name': ' '.join(twitter_user.get('name', '').split()[1:]) if twitter_user.get('name') and len(twitter_user.get('name', '').split()) > 1 else '',
        }
    )

    # If user already exists but email wasn't set, update it
    if not created and not user.email and twitter_user.get('email'):
        user.email = twitter_user['email']
        user.save()

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
