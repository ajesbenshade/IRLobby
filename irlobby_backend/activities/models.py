from django.db import models
from django.core.validators import MaxValueValidator
from users.models import User

class Activity(models.Model):
    host = models.ForeignKey(User, on_delete=models.CASCADE, related_name='hosted_activities')
    is_approved = models.BooleanField(default=False)
    title = models.CharField(max_length=255)
    description = models.TextField()
    category = models.CharField(max_length=120, blank=True, default='')
    location = models.CharField(max_length=255)
    latitude = models.FloatField()
    longitude = models.FloatField()
    time = models.DateTimeField()
    end_time = models.DateTimeField(null=True, blank=True)
    capacity = models.PositiveIntegerField(validators=[MaxValueValidator(10)])
    visibility = models.JSONField(default=list)
    is_private = models.BooleanField(default=False)
    requires_approval = models.BooleanField(default=False)
    price = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    currency = models.CharField(max_length=8, default='USD')
    age_restriction = models.CharField(max_length=32, blank=True, default='')
    skill_level = models.CharField(max_length=32, blank=True, default='')
    equipment_provided = models.BooleanField(default=False)
    equipment_required = models.TextField(blank=True, default='')
    weather_dependent = models.BooleanField(default=False)
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
