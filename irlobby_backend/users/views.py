from rest_framework import generics, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import authenticate
from django.shortcuts import get_object_or_404
from django.db.models import Q
from django.views.decorators.csrf import csrf_exempt
from django.contrib.auth.tokens import default_token_generator
from django.utils.http import urlsafe_base64_encode, urlsafe_base64_decode
from django.utils.encoding import force_bytes, force_str
from django.core.mail import send_mail
from django.template.loader import render_to_string
from django.conf import settings
from .models import User
from .serializers import UserSerializer, UserRegistrationSerializer, UserLoginSerializer

class UserProfileView(generics.RetrieveUpdateAPIView):
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated]

    def get_object(self):
        return self.request.user

class UserDetailView(generics.RetrieveAPIView):
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated]

@api_view(['POST'])
@permission_classes([AllowAny])
@csrf_exempt
def register(request):
    serializer = UserRegistrationSerializer(data=request.data)
    if serializer.is_valid():
        user = serializer.save()
        refresh = RefreshToken.for_user(user)
        return Response({
            'user': UserSerializer(user).data,
            'tokens': {
                'refresh': str(refresh),
                'access': str(refresh.access_token),
            }
        }, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@api_view(['POST'])
@permission_classes([AllowAny])
@csrf_exempt
def login(request):
    serializer = UserLoginSerializer(data=request.data)
    if serializer.is_valid():
        user = serializer.validated_data['user']
        refresh = RefreshToken.for_user(user)
        return Response({
            'user': UserSerializer(user).data,
            'access': str(refresh.access_token),
            'refresh': str(refresh),
        })
    return Response(serializer.errors, status=status.HTTP_401_UNAUTHORIZED)

class UserDetailView(generics.RetrieveAPIView):
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated]

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def user_attended_activities(request, pk):
    """Get activities that a user has attended"""
    user = get_object_or_404(User, pk=pk)

    # Get activities where user is a confirmed participant
    from activities.models import ActivityParticipant, Activity
    from activities.serializers import ActivitySerializer

    attended_activities = Activity.objects.filter(
        activityparticipant__user=user,
        activityparticipant__status='confirmed'
    ).order_by('-created_at')

    serializer = ActivitySerializer(attended_activities, many=True)
    return Response(serializer.data)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def user_search(request):
    """Search for users by username or email"""
    query = request.query_params.get('q', '').strip()

    if not query:
        return Response([])

    users = User.objects.filter(
        Q(username__icontains=query) |
        Q(email__icontains=query) |
        Q(first_name__icontains=query) |
        Q(last_name__icontains=query)
    ).exclude(id=request.user.id)[:20]  # Limit results and exclude self

    serializer = UserSerializer(users, many=True)
    return Response(serializer.data)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def logout_view(request):
    """Logout user by blacklisting their refresh token"""
    try:
        refresh_token = request.data.get('refresh')
        if refresh_token:
            from rest_framework_simplejwt.tokens import RefreshToken
            token = RefreshToken(refresh_token)
            token.blacklist()
        return Response({'message': 'Successfully logged out'})
    except Exception as e:
        return Response({'message': 'Logout completed'}, status=status.HTTP_200_OK)

# Temporary notification endpoints (return empty data for now)
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def notifications_list(request):
    """Get user's notifications"""
    # Return empty list for now
    return Response([])

@api_view(['PATCH'])
@permission_classes([IsAuthenticated])
def notification_detail(request, pk):
    """Update a specific notification"""
    # Return success for now
    return Response({'message': 'Notification updated'})

@api_view(['PATCH'])
@permission_classes([IsAuthenticated])
def mark_all_notifications_read(request):
    """Mark all notifications as read"""
    # Return success for now
    return Response({'message': 'All notifications marked as read'})

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def notifications_unread_count(request):
    """Get count of unread notifications"""
    # Return 0 for now
    return Response({'count': 0})

# Temporary friends endpoints
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def friends_list(request):
    """Get user's friends"""
    return Response([])

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def friend_requests(request):
    """Get user's friend requests"""
    return Response([])

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def send_friend_request(request):
    """Send a friend request"""
    return Response({'message': 'Friend request sent'})

# Temporary activity templates endpoint
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def activity_templates(request):
    """Get activity templates"""
    return Response([])

# Password reset functionality
@api_view(['POST'])
@permission_classes([AllowAny])
def request_password_reset(request):
    """Request password reset - sends email with reset link"""
    email = request.data.get('email')
    if not email:
        return Response({'message': 'Email is required'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        user = User.objects.get(email=email)
    except User.DoesNotExist:
        # Return success even if user doesn't exist for security
        return Response({
            'message': 'If an account with that email exists, a password reset link has been sent.'
        }, status=status.HTTP_200_OK)

    # Generate password reset token
    token = default_token_generator.make_token(user)
    uid = urlsafe_base64_encode(force_bytes(user.pk))

    # Build reset URL
    reset_url = f"{settings.FRONTEND_URL}/reset-password?uid={uid}&token={token}"

    # Send email
    subject = 'Password Reset Request - IRLobby'
    html_message = render_to_string('password_reset_email.html', {
        'user': user,
        'reset_url': reset_url,
        'site_name': 'IRLobby',
    })
    text_message = render_to_string('password_reset_email.txt', {
        'user': user,
        'reset_url': reset_url,
        'site_name': 'IRLobby',
    })

    try:
        send_mail(
            subject,
            text_message,
            settings.DEFAULT_FROM_EMAIL,
            [email],
            html_message=html_message,
        )
    except Exception as e:
        # Log the error but don't expose it to the user
        print(f"Failed to send password reset email: {e}")

    return Response({
        'message': 'If an account with that email exists, a password reset link has been sent.'
    }, status=status.HTTP_200_OK)

@api_view(['POST'])
@permission_classes([AllowAny])
def populate_test_data_api(request):
    """API endpoint to populate test data (for production use)"""
    # Simple security check - you might want to add proper authentication
    secret_key = request.data.get('secret_key')
    if secret_key != 'irlobby_test_data_secret_2025':
        return Response({'error': 'Unauthorized'}, status=status.HTTP_401_UNAUTHORIZED)

    try:
        from django.core.management import call_command
        from io import StringIO

        # Capture command output
        output = StringIO()
        call_command('populate_test_data', stdout=output, verbosity=1)

        return Response({
            'message': 'Test data populated successfully',
            'output': output.getvalue()
        })
    except Exception as e:
        return Response({
            'error': f'Failed to populate test data: {str(e)}'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    """Reset password with token"""
    uidb64 = request.data.get('uid')
    token = request.data.get('token')
    new_password = request.data.get('newPassword')

    if not uidb64 or not token or not new_password:
        return Response({
            'message': 'UID, token, and new password are required'
        }, status=status.HTTP_400_BAD_REQUEST)

    try:
        # Decode the user ID
        uid = force_str(urlsafe_base64_decode(uidb64))
        user = User.objects.get(pk=uid)
    except (TypeError, ValueError, OverflowError, User.DoesNotExist):
        return Response({
            'message': 'Invalid reset link'
        }, status=status.HTTP_400_BAD_REQUEST)

    # Check if token is valid
    if not default_token_generator.check_token(user, token):
        return Response({
            'message': 'Invalid or expired reset token'
        }, status=status.HTTP_400_BAD_REQUEST)

    # Validate password strength
    if len(new_password) < 8:
        return Response({
            'message': 'Password must be at least 8 characters long'
        }, status=status.HTTP_400_BAD_REQUEST)

    # Update password
    user.set_password(new_password)
    user.save()

    # Invalidate all existing tokens for security
    from rest_framework_simplejwt.tokens import RefreshToken
    RefreshToken.for_user(user).blacklist()

    return Response({
        'message': 'Password has been reset successfully'
    }, status=status.HTTP_200_OK)
