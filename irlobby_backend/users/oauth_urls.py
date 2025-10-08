from django.urls import path
from .oauth_views import twitter_oauth_url, twitter_oauth_callback, twitter_oauth_status

urlpatterns = [
    path('url/', twitter_oauth_url, name='twitter_oauth_url'),
    path('callback/', twitter_oauth_callback, name='twitter_oauth_callback'),
    path('status/', twitter_oauth_status, name='twitter_oauth_status'),
]
