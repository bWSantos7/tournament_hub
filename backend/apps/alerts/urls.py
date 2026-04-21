from django.urls import path
from rest_framework.routers import DefaultRouter
from .views import AlertViewSet, preferences

router = DefaultRouter()
router.register('', AlertViewSet, basename='alert')

urlpatterns = [
    path('preferences/', preferences, name='alert-preferences'),
] + router.urls
