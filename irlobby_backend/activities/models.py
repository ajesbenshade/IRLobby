from django.db import models
from users.models import User

class Activity(models.Model):
    host = models.ForeignKey(User, on_delete=models.CASCADE, related_name='hosted_activities')
    title = models.CharField(max_length=255)
    description = models.TextField()
    location = models.CharField(max_length=255)
    latitude = models.FloatField()
    longitude = models.FloatField()
    time = models.DateTimeField()
    capacity = models.PositiveIntegerField()
    # Privacy and approval controls
    is_private = models.BooleanField(default=False)
    requires_approval = models.BooleanField(default=False)
    auto_approve = models.BooleanField(default=False)
    tags = models.JSONField(default=list)
    images = models.JSONField(default=list)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.title

class ActivityParticipant(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('confirmed', 'Confirmed'),
        ('declined', 'Declined'),
    ]
    activity = models.ForeignKey(Activity, on_delete=models.CASCADE, related_name='participants')
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='participating_activities')
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='pending')
    joined_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('activity', 'user')

    def __str__(self):
        return f"{self.user} - {self.activity}"
