from django.urls import path
from . import views

urlpatterns = [
    path('profile/', views.UserProfileView.as_view(), name='user-profile'),
    path('profile/delete/', views.delete_profile, name='delete-profile'),
    path('profile/export/', views.export_user_data, name='export-user-data'),
    path('auth/status/', views.auth_status, name='auth-status'),
    path('auth/request-password-reset/', views.request_password_reset, name='request-password-reset'),
    path('register/', views.register, name='user-register'),
    path('register', views.register, name='user-register-no-slash'),
    path('login/', views.login, name='user-login'),
    path('login', views.login, name='user-login-no-slash'),
]
