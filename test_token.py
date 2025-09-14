#!/usr/bin/env python3
"""
Test JWT token validation
"""

import os
import sys
import django

# Add the project directory to the Python path
sys.path.append('a:\\Development\\IRLobby\\irlobby_backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'irlobby_backend.settings')

# Setup Django
django.setup()

from rest_framework_simplejwt.tokens import RefreshToken
from users.models import User
import requests

def test_token_validation():
    print("🔍 Testing JWT Token Validation...")

    # Get or create test user
    user, created = User.objects.get_or_create(
        username='testuser123',
        defaults={
            'email': 'test@example.com',
            'first_name': 'Test',
            'last_name': 'User'
        }
    )

    if created:
        user.set_password('testpass123')
        user.save()
        print("✅ Test user created")

    # Generate tokens
    refresh = RefreshToken.for_user(user)
    access_token = str(refresh.access_token)
    refresh_token = str(refresh)

    print(f"✅ Tokens generated (access: {len(access_token)} chars)")

    # Test API endpoint
    headers = {'Authorization': f'Bearer {access_token}'}
    url = 'http://127.0.0.1:8000/api/users/profile/'

    try:
        print("🔍 Testing API endpoint...")
        response = requests.get(url, headers=headers, timeout=10)

        print(f"Status Code: {response.status_code}")

        if response.status_code == 200:
            print("✅ SUCCESS: Token validation working!")
            data = response.json()
            print(f"User: {data.get('username')}")
        elif response.status_code == 401:
            print("❌ FAILED: 401 Unauthorized")
            print("Response:", response.text[:200])
        else:
            print(f"❌ FAILED: Unexpected status {response.status_code}")
            print("Response:", response.text[:200])

    except requests.exceptions.ConnectionError:
        print("❌ FAILED: Cannot connect to server")
        print("Make sure Django server is running: python manage.py runserver")
    except Exception as e:
        print(f"❌ FAILED: {str(e)}")

if __name__ == "__main__":
    test_token_validation()