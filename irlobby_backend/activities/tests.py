from datetime import timedelta

from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from users.models import User
from activities.models import Activity, ActivityParticipant


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
            is_approved=True,
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


class ActivityApprovalWorkflowTests(APITestCase):
    def setUp(self):
        self.host = User.objects.create_user(
            username='approval-host',
            email='approval-host@example.com',
            password='password123',
        )
        self.other = User.objects.create_user(
            username='approval-other',
            email='approval-other@example.com',
            password='password123',
        )

    def test_new_activity_requires_approval_by_default(self):
        self.client.force_authenticate(self.host)
        url = reverse('activity-list')
        payload = {
            'title': 'Pending Approval Event',
            'description': 'Needs approval first.',
            'location': 'Central Park',
            'latitude': 40.7812,
            'longitude': -73.9665,
            'time': (timezone.now() + timedelta(days=2)).isoformat(),
            'capacity': 10,
            'tags': [],
            'images': [],
        }

        response = self.client.post(url, payload, format='json')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        created = Activity.objects.get(id=response.data['id'])
        self.assertFalse(created.is_approved)

    def test_unapproved_activity_hidden_from_non_host(self):
        activity = Activity.objects.create(
            host=self.host,
            title='Hidden Pending Event',
            description='Pending moderation',
            location='Library',
            latitude=51.5,
            longitude=-0.1,
            time=timezone.now() + timedelta(days=1),
            capacity=4,
            tags=[],
            images=[],
        )

        self.client.force_authenticate(self.other)
        list_response = self.client.get(reverse('activity-list'))
        detail_response = self.client.get(reverse('activity-detail', args=[activity.id]))

        ids = [item['id'] for item in list_response.data]
        self.assertNotIn(activity.id, ids)
        self.assertEqual(detail_response.status_code, status.HTTP_404_NOT_FOUND)

    def test_cannot_create_activity_with_capacity_above_ten(self):
        self.client.force_authenticate(self.host)
        url = reverse('activity-list')
        payload = {
            'title': 'Too Large Event',
            'description': 'Should fail validation.',
            'location': 'Stadium',
            'latitude': 40.0,
            'longitude': -74.0,
            'time': (timezone.now() + timedelta(days=3)).isoformat(),
            'capacity': 11,
            'tags': [],
            'images': [],
        }

        response = self.client.post(url, payload, format='json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('capacity', response.data)

    def test_join_rejected_when_activity_full(self):
        activity = Activity.objects.create(
            host=self.host,
            is_approved=True,
            title='Full Event',
            description='Already at capacity',
            location='Cafe',
            latitude=35.0,
            longitude=-120.0,
            time=timezone.now() + timedelta(days=1),
            capacity=10,
            tags=[],
            images=[],
        )

        for index in range(10):
            participant_user = User.objects.create_user(
                username=f'confirmed-{index}',
                email=f'confirmed-{index}@example.com',
                password='password123',
            )
            ActivityParticipant.objects.create(
                activity=activity,
                user=participant_user,
                status='confirmed',
            )

        self.client.force_authenticate(self.other)
        response = self.client.post(reverse('join-activity', args=[activity.id]))

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data.get('message'), 'Activity is full')
