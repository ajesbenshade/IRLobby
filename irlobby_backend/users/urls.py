from django.urls import path
from . import views

urlpatterns = [
    path('profile/', views.UserProfileView.as_view(), name='user-profile'),
    path('onboarding/', views.user_onboarding, name='user-onboarding'),
    path('profile/delete/', views.delete_profile, name='delete-profile'),
    path('profile/export/', views.export_user_data, name='export-user-data'),
    path('invites/', views.InviteListCreateView.as_view(), name='invite-list-create'),
    path('invites/resolve/<uuid:token>/', views.resolve_invite, name='invite-resolve'),
    path('invites/accept/', views.accept_invite, name='invite-accept'),
    path('auth/status/', views.auth_status, name='auth-status'),
    path('register/', views.register, name='user-register'),
    path('register', views.register, name='user-register-no-slash'),
    path('login/', views.login, name='user-login'),
    path('login', views.login, name='user-login-no-slash'),
]
