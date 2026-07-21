from django.urls import path

from .apple_auth import apple_auth_status, apple_sign_in

urlpatterns = [
    path("signin/", apple_sign_in, name="apple_sign_in"),
    path("status/", apple_auth_status, name="apple_auth_status"),
]
