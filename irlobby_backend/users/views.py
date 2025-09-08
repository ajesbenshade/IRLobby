from rest_framework import generics, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import authenticate
from django.shortcuts import get_object_or_404
from django.db.models import Q
from django.views.decorators.csrf import csrf_exempt
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
            'tokens': {
                'refresh': str(refresh),
                'access': str(refresh.access_token),
            }
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
