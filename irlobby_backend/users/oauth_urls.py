from django.urls import path
from .oauth_views import twitter_oauth_url, twitter_oauth_callback

urlpatterns = [
    path('url/', twitter_oauth_url, name='twitter_oauth_url'),
    path('callback/', twitter_oauth_callback, name='twitter_oauth_callback'),
]
