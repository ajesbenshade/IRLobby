#!/usr/bin/env python3
"""
IRLobby Authentication Test Suite
Tests the complete authentication flow including X.com OAuth
"""

import requests
import json
import sys
import time

def test_health():
    """Test health endpoint"""
    print("🔍 Testing Health Endpoint...")
    try:
        response = requests.get('http://127.0.0.1:8000/api/health/', timeout=5)
        if response.status_code == 200:
            print("✅ Health check passed:", response.json())
            return True
        else:
            print("❌ Health check failed:", response.status_code)
            return False
    except Exception as e:
        print("❌ Health check error:", str(e))
        return False

def test_oauth_url():
    """Test OAuth URL generation"""
    print("\n🔍 Testing X.com OAuth URL Generation...")
    try:
        response = requests.get('http://127.0.0.1:8000/api/auth/twitter/url/', timeout=5)
        if response.status_code == 200:
            data = response.json()
            if 'auth_url' in data:
                print("✅ OAuth URL generated successfully")
                print("   URL preview:", data['auth_url'][:80] + "...")
                return True
            else:
                print("❌ OAuth URL missing in response")
                return False
        elif response.status_code == 500:
            data = response.json()
            print("❌ OAuth configuration error:", data.get('error', 'Unknown'))
            return False
        else:
            print("❌ OAuth URL endpoint error:", response.status_code)
            return False
    except Exception as e:
        print("❌ OAuth URL request error:", str(e))
        return False

def test_user_registration():
    """Test user registration"""
    print("\n🔍 Testing User Registration...")
    try:
        # Generate unique username/email
        timestamp = str(int(time.time()))
        user_data = {
            'username': f'testuser_{timestamp}',
            'email': f'test_{timestamp}@example.com',
            'password': 'testpass123!',
            'password_confirm': 'testpass123!',
            'first_name': 'Test',
            'last_name': 'User'
        }
        response = requests.post('http://127.0.0.1:8000/api/users/register/',
                               json=user_data, timeout=10)
        if response.status_code == 201:
            data = response.json()
            print("✅ User registration successful")
            print("   Username:", data['user']['username'])
            return data.get('tokens', {}).get('access'), user_data
        else:
            print("❌ Registration failed:", response.status_code)
            print("   Error:", response.text[:200])
            return None, None
    except Exception as e:
        print("❌ Registration request error:", str(e))
        return None, None

def test_user_login(user_data):
    """Test user login"""
    print("\n🔍 Testing User Login...")
    try:
        login_data = {
            'username': user_data['email'],
            'password': user_data['password']
        }
        response = requests.post('http://127.0.0.1:8000/api/users/login/',
                               json=login_data, timeout=10)
        if response.status_code == 200:
            data = response.json()
            print("✅ User login successful")
            print("   Welcome:", data['user']['username'])
            return data.get('access')
        else:
            print("❌ Login failed:", response.status_code)
            print("   Error:", response.text[:200])
            return None
    except Exception as e:
        print("❌ Login request error:", str(e))
        return None

def test_protected_endpoint(access_token):
    """Test protected endpoint access"""
    print("\n🔍 Testing Protected Endpoint Access...")
    try:
        headers = {'Authorization': f'Bearer {access_token}'}
        response = requests.get('http://127.0.0.1:8000/api/users/profile/',
                              headers=headers, timeout=10)
        if response.status_code == 200:
            data = response.json()
            print("✅ Profile access successful")
            print("   User:", data['username'])
            return True
        else:
            print("❌ Profile access failed:", response.status_code)
            print("   Error:", response.text[:200])
            return False
    except Exception as e:
        print("❌ Profile request error:", str(e))
        return False

def main():
    """Run all authentication tests"""
    print("🚀 IRLobby Authentication Testing Suite")
    print("=" * 50)

    # Test 1: Health Check
    if not test_health():
        print("\n❌ Backend server not responding. Please start the server first.")
        sys.exit(1)

    # Test 2: OAuth URL Generation
    oauth_working = test_oauth_url()

    # Test 3: User Registration
    access_token, user_data = test_user_registration()
    if not access_token:
        print("\n❌ User registration failed. Cannot continue testing.")
        sys.exit(1)

    # Test 4: User Login
    login_token = test_user_login(user_data)
    if login_token:
        access_token = login_token

    # Test 5: Protected Endpoint
    if access_token:
        test_protected_endpoint(access_token)

    print("\n" + "=" * 50)
    print("🎉 Authentication Testing Complete!")
    print("🌐 Frontend: http://localhost:5173/")
    print("🔧 Backend: http://127.0.0.1:8000/")

    if oauth_working:
        print("✅ X.com OAuth: Configured and ready")
    else:
        print("⚠️  X.com OAuth: Configuration needed (check .env file)")

    print("\n📝 Ready for manual testing in browser!")
    print("   1. Open http://localhost:5173/")
    print("   2. Try registering a new account")
    print("   3. Try logging in with email/password")
    print("   4. Try 'Continue with X (Twitter)' (if configured)")

if __name__ == "__main__":
    main()