from rest_framework import generics
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.db.models import Q
from django.shortcuts import get_object_or_404
from .models import Review
from .serializers import ReviewSerializer

class ReviewListCreateView(generics.ListCreateAPIView):
    serializer_class = ReviewSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        return Review.objects.filter(
            Q(reviewer=user) | Q(reviewee=user)
        ).order_by('-created_at')

    def perform_create(self, serializer):
        serializer.save(reviewer=self.request.user)

@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def activity_reviews(request, activity_id):
    """Get reviews for a specific activity or create a new review"""
    from activities.models import Activity
    activity = get_object_or_404(Activity, pk=activity_id)

    if request.method == 'GET':
        reviews = Review.objects.filter(activity=activity).order_by('-created_at')
        serializer = ReviewSerializer(reviews, many=True)
        return Response(serializer.data)

    elif request.method == 'POST':
        # Check if user attended this activity
        from activities.models import ActivityParticipant
        if not ActivityParticipant.objects.filter(
            activity=activity,
            user=request.user,
            status='confirmed'
        ).exists():
            return Response({'error': 'You must have attended this activity to leave a review'}, status=403)

        serializer = ReviewSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(reviewer=request.user, activity=activity)
            return Response(serializer.data, status=201)
        return Response(serializer.errors, status=400)
