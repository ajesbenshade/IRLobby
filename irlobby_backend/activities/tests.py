from datetime import timedelta

from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from users.models import User
from activities.models import Activity


class ActivityPermissionsTests(APITestCase):
    def setUp(self):
        self.host = User.objects.create_user(
            username='host-user',
            email='host@example.com',
            password='password123',
        )
        self.other = User.objects.create_user(
            username='other-user',
            email='other@example.com',
            password='password123',
        )
        self.activity = Activity.objects.create(
            host=self.host,
            title='Board Game Night',
            description='Play all the games.',
            location='Community Center',
            latitude=10.0,
            longitude=20.0,
            time=timezone.now() + timedelta(days=1),
            capacity=5,
            tags=[],
            images=[],
        )
        self.url = reverse('activity-detail', args=[self.activity.id])

    def test_host_can_update_activity(self):
        self.client.force_authenticate(self.host)
        response = self.client.patch(self.url, {'title': 'Updated Title'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.activity.refresh_from_db()
        self.assertEqual(self.activity.title, 'Updated Title')

    def test_non_host_cannot_update_activity(self):
        self.client.force_authenticate(self.other)
        response = self.client.patch(self.url, {'title': 'Hacked Title'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.activity.refresh_from_db()
        self.assertEqual(self.activity.title, 'Board Game Night')

    def test_non_host_cannot_delete_activity(self):
        self.client.force_authenticate(self.other)
        response = self.client.delete(self.url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertTrue(Activity.objects.filter(id=self.activity.id).exists())
