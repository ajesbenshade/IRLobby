from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework import status
from django.contrib.auth import get_user_model
from django.conf import settings
from django.views.decorators.csrf import csrf_exempt
from rest_framework_simplejwt.tokens import RefreshToken
import requests
from .serializers import UserSerializer

User = get_user_model()

@api_view(['GET'])
@permission_classes([AllowAny])
def twitter_oauth_url(request):
    """Get X (Twitter) OAuth authorization URL"""
    client_id = getattr(settings, 'TWITTER_CLIENT_ID', None)
    if not client_id or client_id == '':
        return Response({'error': 'X OAuth not configured - missing client ID'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    redirect_uri = f"{request.scheme}://{request.get_host()}/api/auth/twitter/callback/"
    # Updated scopes for X.com API v2
    scope = 'tweet.read users.read follows.read'

    auth_url = (
        f"https://x.com/i/oauth2/authorize?"
        f"response_type=code&"
        f"client_id={client_id}&"
        f"redirect_uri={redirect_uri}&"
        f"scope={scope}&"
        f"state=state&"
        f"code_challenge=challenge&"
        f"code_challenge_method=plain"
    )

    return Response({'auth_url': auth_url})

@api_view(['GET', 'POST'])
@permission_classes([AllowAny])
@csrf_exempt
def twitter_oauth_callback(request):
    """Handle X (Twitter) OAuth callback"""
    if request.method == 'GET':
        code = request.GET.get('code')
        state = request.GET.get('state')
        error = request.GET.get('error')
    else:
        code = request.data.get('code')
        state = request.data.get('state')
        error = request.data.get('error')

    if error:
        # Redirect to frontend with error
        frontend_url = f"{request.scheme}://{request.get_host().replace('8000', '5173')}/?error={error}"
        return Response({'redirect_url': frontend_url}, status=status.HTTP_302_FOUND)

    if not code:
        frontend_url = f"{request.scheme}://{request.get_host().replace('8000', '5173')}/?error=no_code"
        return Response({'redirect_url': frontend_url}, status=status.HTTP_302_FOUND)

    client_id = getattr(settings, 'TWITTER_CLIENT_ID', None)
    client_secret = getattr(settings, 'TWITTER_CLIENT_SECRET', None)

    if not client_id or not client_secret or client_id == '' or client_secret == '':
        frontend_url = f"{request.scheme}://{request.get_host().replace('8000', '5173')}/?error=oauth_not_configured"
        return Response({'redirect_url': frontend_url}, status=status.HTTP_302_FOUND)

    # Exchange code for access token
    token_url = "https://api.x.com/2/oauth2/token"
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
        frontend_url = f"{request.scheme}://{request.get_host().replace('8000', '5173')}/?error=token_exchange_failed"
        return Response({'redirect_url': frontend_url}, status=status.HTTP_302_FOUND)

    token_data = token_response.json()
    access_token = token_data.get('access_token')

    # Get user info from X (including profile data)
    user_url = "https://api.x.com/2/users/me"
    headers = {'Authorization': f'Bearer {access_token}'}
    params = {'user.fields': 'name,username,profile_image_url,description,location'}
    user_response = requests.get(user_url, headers=headers, params=params)

    if user_response.status_code != 200:
        frontend_url = f"{request.scheme}://{request.get_host().replace('8000', '5173')}/?error=user_info_failed"
        return Response({'redirect_url': frontend_url}, status=status.HTTP_302_FOUND)

    x_user = user_response.json()['data']

    # Create or get user
    user, created = User.objects.get_or_create(
        oauth_id=x_user['id'],
        oauth_provider='x',
        defaults={
            'username': x_user['username'],
            'email': f"{x_user['username']}@x.local",  # X doesn't provide email in basic scope
            'first_name': x_user.get('name', '').split()[0] if x_user.get('name') else '',
            'last_name': ' '.join(x_user.get('name', '').split()[1:]) if x_user.get('name') and len(x_user.get('name', '').split()) > 1 else '',
            'bio': x_user.get('description', ''),
            'avatar_url': x_user.get('profile_image_url', ''),
            'location': x_user.get('location', ''),
        }
    )

    # If user already exists but some fields are missing, update them
    if not created:
        if not user.bio and x_user.get('description'):
            user.bio = x_user['description']
        if not user.avatar_url and x_user.get('profile_image_url'):
            user.avatar_url = x_user['profile_image_url']
        if not user.location and x_user.get('location'):
            user.location = x_user['location']
        user.save()

    # Generate JWT tokens
    refresh = RefreshToken.for_user(user)

    # Create a session token for the frontend to pick up
    import uuid
    session_token = str(uuid.uuid4())
    
    # Store the auth data temporarily (in production, use Redis/cache)
    # For now, we'll redirect with tokens in URL fragment (not ideal but works for demo)
    import json
    tokens_data = {
        'access': str(refresh.access_token),
        'refresh': str(refresh),
        'user_id': user.id,
        'user': UserSerializer(user).data
    }
    
    # Serialize tokens data
    tokens_json = json.dumps(tokens_data)
    frontend_url = f"{request.scheme}://{request.get_host().replace('8000', '5173')}/oauth/callback#tokens={requests.utils.quote(tokens_json)}"
    
    return Response({'redirect_url': frontend_url}, status=status.HTTP_302_FOUND)
