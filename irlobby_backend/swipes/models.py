from django.db import models
from users.models import User
from activities.models import Activity

class Swipe(models.Model):
    DIRECTION_CHOICES = [
        ('left', 'Pass'),
        ('right', 'Interested'),
    ]
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    activity = models.ForeignKey(Activity, on_delete=models.CASCADE)
    direction = models.CharField(max_length=10, choices=DIRECTION_CHOICES)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('user', 'activity')

    def __str__(self):
        return f"{self.user} {self.direction} on {self.activity}"
