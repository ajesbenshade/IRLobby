from datetime import timedelta

from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from users.models import User


class PasswordResetConfirmTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username='reset-user',
            email='reset@example.com',
            password='password123',
        )
        self.url = reverse('password-reset-confirm')

    def _set_token(self, token='reset-token', created_at=None):
        self.user.password_reset_token = token
        self.user.token_created_at = created_at or timezone.now()
        self.user.save(update_fields=['password_reset_token', 'token_created_at'])

    def test_password_reset_success_clears_token(self):
        self._set_token()

        response = self.client.post(
            self.url,
            {'token': 'reset-token', 'new_password': 'newpass123'},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.user.refresh_from_db()
        self.assertIsNone(self.user.password_reset_token)
        self.assertIsNone(self.user.token_created_at)
        self.assertTrue(self.user.check_password('newpass123'))

    def test_password_reset_rejects_expired_token(self):
        expired_time = timezone.now() - timedelta(hours=3)
        self._set_token(created_at=expired_time)

        response = self.client.post(
            self.url,
            {'token': 'reset-token', 'new_password': 'newpass123'},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.user.refresh_from_db()
        self.assertIsNone(self.user.password_reset_token)
        self.assertIsNone(self.user.token_created_at)

    def test_password_reset_missing_timestamp(self):
        self._set_token()
        User.objects.filter(id=self.user.id).update(token_created_at=None)

        response = self.client.post(
            self.url,
            {'token': 'reset-token', 'new_password': 'newpass123'},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.user.refresh_from_db()
        self.assertIsNone(self.user.password_reset_token)
        self.assertIsNone(self.user.token_created_at)

    def test_password_reset_handles_duplicate_tokens(self):
        token_value = 'duplicate-token'
        self._set_token(token=token_value)

        other_user = User.objects.create_user(
            username='other-user',
            email='other@example.com',
            password='password123',
        )
        other_user.password_reset_token = token_value
        other_user.token_created_at = timezone.now()
        other_user.save(update_fields=['password_reset_token', 'token_created_at'])

        response = self.client.post(
            self.url,
            {'token': token_value, 'new_password': 'newpass123'},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.user.refresh_from_db()
        other_user.refresh_from_db()
        self.assertIsNone(self.user.password_reset_token)
        self.assertIsNone(other_user.password_reset_token)
