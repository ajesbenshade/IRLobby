from django.urls import path

from .google_auth import google_auth_status, google_sign_in

urlpatterns = [
    path("signin/", google_sign_in, name="google_sign_in"),
    path("status/", google_auth_status, name="google_auth_status"),
]
