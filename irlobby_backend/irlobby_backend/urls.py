"""
URL configuration for irlobby_backend project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/5.2/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import path, include, re_path
from django.http import JsonResponse, HttpResponse
from django.shortcuts import render
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
)
from users.views import logout_view, request_password_reset, reset_password

def home(request):
    return HttpResponse("IRLobby Backend API")

def react_app(request):
    return render(request, 'index.html')

def health_check(request):
    return JsonResponse({'status': 'ok'})

urlpatterns = [
    path('', home, name='home'),
    path('admin/', admin.site.urls),
    path('api/health/', health_check, name='health'),
    path('api/auth/token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/auth/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    # path('api/auth/twitter/', include('users.oauth_urls')),  # Temporarily commented out
    path('api/auth/request-password-reset/', request_password_reset, name='request-password-reset'),
    path('api/auth/reset-password/', reset_password, name='reset-password'),
    # Temporary test path - moved before users include
    path('api/test-users/', lambda request: HttpResponse('Test working'), name='test-users'),
    path('api/users/', include('users.urls')),
    path('api/activities/', include('activities.urls')),
    path('api/swipes/', include('swipes.urls')),
    path('api/matches/', include('matches.urls')),
    path('api/messages/', include('chat.urls')),
    path('api/reviews/', include('reviews.urls')),
    path('api/logout/', logout_view, name='logout'),
    re_path(r'^(?!api|admin).*$', react_app),  # Serve React for non-API routes
]
