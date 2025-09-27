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

    @staticmethod
    def _normalize_users(user_one, user_two):
        """Return users ordered by primary key so user_a <= user_b."""
        return tuple(sorted([user_one, user_two], key=lambda user: user.id))

    @classmethod
    def get_or_create_normalized(cls, activity, user_one, user_two):
        """Ensure matches are stored with a deterministic user ordering."""
        user_a, user_b = cls._normalize_users(user_one, user_two)
        return cls.objects.get_or_create(
            activity=activity,
            user_a=user_a,
            user_b=user_b,
        )
