from rest_framework import generics, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken
from django.http import JsonResponse
from django.db import transaction
from django.utils import timezone
from .models import User
from .serializers import UserSerializer, UserRegistrationSerializer, UserLoginSerializer
from activities.models import Activity
from swipes.models import Swipe
from matches.models import Match
from reviews.models import Review

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

@api_view(['POST'])
@permission_classes([AllowAny])
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
        }, status=status.HTTP_200_OK)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def export_user_data(request):
    """Export all user data as JSON"""
    user = request.user
    
    try:
        # Collect all user data
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
        
    except Exception as e:
        return JsonResponse({
            'error': 'Failed to export user data',
            'details': str(e)
        }, status=500)

@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def delete_profile(request):
    """Delete user profile and all associated data"""
    user = request.user
    
    try:
        with transaction.atomic():
            # Delete the user - cascade deletes should handle related data
            user.delete()
        
        return Response({"message": "Profile deleted successfully"}, status=status.HTTP_204_NO_CONTENT)
        
    except Exception as e:
        return Response({
            'error': 'Failed to delete profile',
            'details': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
