from rest_framework import generics, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from django.db import transaction
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator
from activities.models import Activity
from matches.models import Match
from .models import Swipe
from .serializers import SwipeSerializer

class SwipeListView(generics.ListCreateAPIView):
    serializer_class = SwipeSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Swipe.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
@csrf_exempt
def swipe_activity(request, pk):
    activity = get_object_or_404(Activity, pk=pk)
    user = request.user
    direction = request.data.get('direction')

    if direction not in ['left', 'right']:
        return Response({'error': 'Invalid direction'}, status=status.HTTP_400_BAD_REQUEST)

    # Check if user already swiped on this activity
    existing_swipe = Swipe.objects.filter(user=user, activity=activity).first()
    if existing_swipe:
        return Response({'error': 'Already swiped on this activity'}, status=status.HTTP_400_BAD_REQUEST)

    with transaction.atomic():
        # Create the swipe
        swipe = Swipe.objects.create(user=user, activity=activity, direction=direction)

        # If it's a right swipe, check for matches
        if direction == 'right':
            # Check if the activity host swiped right on any activity by this user
            # This is a simplified matching logic - you might want to implement more complex logic
            host_right_swipes = Swipe.objects.filter(
                user=activity.host,
                direction='right'
            ).values_list('activity', flat=True)

            user_activities = Activity.objects.filter(host=user)

            for user_activity in user_activities:
                if user_activity.id in host_right_swipes:
                    # Create a match
                    Match.objects.get_or_create(
                        activity=activity,
                        user_a=min(user.id, activity.host.id, key=lambda x: x),
                        user_b=max(user.id, activity.host.id, key=lambda x: x)
                    )
                    break

    return Response({'message': f'Swiped {direction}'}, status=status.HTTP_201_CREATED)
