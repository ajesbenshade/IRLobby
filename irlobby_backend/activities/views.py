from rest_framework import generics, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from django.db.models import Q
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator
from .models import Activity, ActivityParticipant
from .serializers import ActivitySerializer, ActivityParticipantSerializer

class ActivityListCreateView(generics.ListCreateAPIView):
    serializer_class = ActivitySerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = Activity.objects.all()
        # Filter by location if provided
        latitude = self.request.query_params.get('latitude')
        longitude = self.request.query_params.get('longitude')
        radius = self.request.query_params.get('radius', 10)  # Default 10km radius

        if latitude and longitude:
            # Simple distance filtering (you might want to use a more sophisticated geospatial query)
            lat_min = float(latitude) - (float(radius) / 111)  # Rough conversion
            lat_max = float(latitude) + (float(radius) / 111)
            lon_min = float(longitude) - (float(radius) / 111)
            lon_max = float(longitude) + (float(radius) / 111)

            queryset = queryset.filter(
                latitude__range=(lat_min, lat_max),
                longitude__range=(lon_min, lon_max)
            )

        return queryset.order_by('-created_at')

    def perform_create(self, serializer):
        serializer.save(host=self.request.user)

class ActivityDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Activity.objects.all()
    serializer_class = ActivitySerializer
    permission_classes = [IsAuthenticated]

class HostedActivitiesView(generics.ListAPIView):
    serializer_class = ActivitySerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Activity.objects.filter(host=self.request.user)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
@csrf_exempt
def join_activity(request, pk):
    activity = get_object_or_404(Activity, pk=pk)
    user = request.user

    # Check if user is already a participant
    participant, created = ActivityParticipant.objects.get_or_create(
        activity=activity,
        user=user,
        defaults={'status': 'pending'}
    )

    if not created:
        return Response({'message': 'Already requested to join'}, status=status.HTTP_400_BAD_REQUEST)

    return Response({'message': 'Join request sent'}, status=status.HTTP_201_CREATED)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
@csrf_exempt
def leave_activity(request, pk):
    activity = get_object_or_404(Activity, pk=pk)
    user = request.user

    try:
        participant = ActivityParticipant.objects.get(activity=activity, user=user)
        participant.delete()
        return Response({'message': 'Left activity successfully'})
    except ActivityParticipant.DoesNotExist:
        return Response({'message': 'Not a participant'}, status=status.HTTP_400_BAD_REQUEST)

@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
@csrf_exempt
def activity_chat(request, pk):
    """Get chat messages for an activity or send a message"""
    activity = get_object_or_404(Activity, pk=pk)
    user = request.user

    # Check if user is a participant
    if not ActivityParticipant.objects.filter(activity=activity, user=user).exists():
        return Response({'error': 'Not authorized'}, status=status.HTTP_403_FORBIDDEN)

    if request.method == 'GET':
        # Get or create conversation for this activity
        from matches.models import Match
        participants = ActivityParticipant.objects.filter(activity=activity, status='confirmed')
        if participants.count() >= 2:
            user_a = participants.first().user
            user_b = participants.last().user

            match, created = Match.objects.get_or_create(
                activity=activity,
                user_a=user_a,
                user_b=user_b
            )

            from chat.models import Conversation
            conversation, created = Conversation.objects.get_or_create(match=match)

            messages = conversation.messages.all().order_by('created_at')
            from chat.serializers import MessageSerializer
            serializer = MessageSerializer(messages, many=True)
            return Response(serializer.data)

        return Response([])

    elif request.method == 'POST':
        message_text = request.data.get('message')
        if not message_text:
            return Response({'error': 'Message is required'}, status=status.HTTP_400_BAD_REQUEST)

        # Get or create conversation for this activity
        from matches.models import Match
        participants = ActivityParticipant.objects.filter(activity=activity, status='confirmed')
        if participants.count() >= 2:
            user_a = participants.first().user
            user_b = participants.last().user

            match, created = Match.objects.get_or_create(
                activity=activity,
                user_a=user_a,
                user_b=user_b
            )

            from chat.models import Conversation, Message
            conversation, created = Conversation.objects.get_or_create(match=match)

            # Create the message
            message = Message.objects.create(
                conversation=conversation,
                sender=user,
                text=message_text
            )

            from chat.serializers import MessageSerializer
            serializer = MessageSerializer(message)
            return Response(serializer.data, status=status.HTTP_201_CREATED)

        return Response({'error': 'Not enough participants to start chat'}, status=status.HTTP_400_BAD_REQUEST)
