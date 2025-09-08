from django.db import models
from users.models import User
from activities.models import Activity

class Match(models.Model):
    activity = models.ForeignKey(Activity, on_delete=models.CASCADE, null=True, blank=True)
    user_a = models.ForeignKey(User, on_delete=models.CASCADE, related_name='matches_as_a')
    user_b = models.ForeignKey(User, on_delete=models.CASCADE, related_name='matches_as_b')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('user_a', 'user_b', 'activity')

    def __str__(self):
        return f"Match between {self.user_a} and {self.user_b}"
