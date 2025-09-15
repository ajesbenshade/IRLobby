from rest_framework import generics, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import authenticate
from django.db import transaction
from .models import User
from .serializers import UserSerializer, UserRegistrationSerializer, UserLoginSerializer

class UserProfileView(generics.RetrieveUpdateAPIView):
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated]

    def get_object(self):
        return self.request.user

@api_view(['POST'])
@permission_classes([AllowAny])
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

@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def delete_profile(request):
    """Delete user profile and all associated data"""
    user = request.user
    
    try:
        with transaction.atomic():
            # Delete user's activities (this will cascade to participants)
            user.hosted_activities.all().delete()
            
            # Delete user's swipes
            user.swipe_set.all().delete()
            
            # Delete matches where user is involved
            user.matches_as_a.all().delete()
            user.matches_as_b.all().delete()
            
            # Delete reviews given and received
            user.given_reviews.all().delete()
            user.received_reviews.all().delete()
            
            # Delete user's participations in activities
            user.participating_activities.all().delete()
            
            # Finally delete the user
            user.delete()
            
        return Response({
            'message': 'Profile deleted successfully'
        }, status=status.HTTP_200_OK)
        
    except Exception as e:
        return Response({
            'error': 'Failed to delete profile',
            'details': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
