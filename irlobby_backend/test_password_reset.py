import urllib.request
import json

# Test health endpoint
url = 'http://127.0.0.1:8000/api/health/'
try:
    with urllib.request.urlopen(url) as response:
        print('Health check response:', response.read().decode())
except Exception as e:
    print('Health check error:', e)

# Test password reset endpoint
url = 'http://127.0.0.1:8000/api/auth/request-password-reset/'
data = json.dumps({'email': 'test@example.com'}).encode('utf-8')
headers = {'Content-Type': 'application/json'}

try:
    req = urllib.request.Request(url, data=data, headers=headers, method='POST')
    with urllib.request.urlopen(req) as response:
        print('Password reset status:', response.status)
        print('Password reset response:', response.read().decode())
except Exception as e:
    print('Password reset error:', e)