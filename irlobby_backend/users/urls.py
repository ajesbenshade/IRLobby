from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from . import views

urlpatterns = [
    path('profile/', views.UserProfileView.as_view(), name='user-profile'),
    path('profile/delete/', views.delete_profile, name='delete-profile'),
    path('profile/export/', views.export_user_data, name='export-user-data'),
    path('register/', views.register, name='user-register'),
    path('login/', views.login, name='user-login'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token-refresh'),
]
