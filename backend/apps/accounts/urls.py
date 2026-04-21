from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from .views import (
    RegisterView,
    CustomTokenObtainPairView,
    MeView,
    change_password,
    logout,
    delete_account,
    send_email_otp,
    verify_email_otp,
    send_phone_otp,
    verify_phone_otp,
    password_reset_request,
    password_reset_confirm,
)

urlpatterns = [
    path('register/', RegisterView.as_view(), name='register'),
    path('login/', CustomTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('logout/', logout, name='logout'),
    path('me/', MeView.as_view(), name='me'),
    path('change-password/', change_password, name='change_password'),
    path('delete-account/', delete_account, name='delete_account'),
    # OTP verification
    path('send-email-otp/', send_email_otp, name='send_email_otp'),
    path('verify-email/', verify_email_otp, name='verify_email_otp'),
    path('send-phone-otp/', send_phone_otp, name='send_phone_otp'),
    path('verify-phone/', verify_phone_otp, name='verify_phone_otp'),
    # Password reset
    path('password-reset/', password_reset_request, name='password_reset_request'),
    path('password-reset/confirm/', password_reset_confirm, name='password_reset_confirm'),
]
