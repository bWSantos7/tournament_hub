"""
Feature-gate permission system.

Usage in views:
    from apps.billing.permissions import requires_feature, user_has_feature

    @api_view(['GET'])
    @requires_feature('advanced_stats')
    def my_view(request):
        ...

    # Programmatic check:
    if user_has_feature(request.user, 'ranking_access'):
        ...
"""
import functools
import logging

from rest_framework import status
from rest_framework.response import Response

from .models import Feature, Subscription

logger = logging.getLogger('apps.billing')


def get_user_subscription(user) -> 'Subscription | None':
    """Return the user's active Subscription, or None."""
    try:
        return user.subscription
    except Subscription.DoesNotExist:
        return None


def user_has_feature(user, feature_code: str) -> bool:
    """
    Return True if the user's current subscription includes the feature.
    Free-tier users (no subscription) only have features included in the Free plan.
    """
    sub = get_user_subscription(user)
    if sub is None:
        # Assign the free plan implicitly
        from .models import Plan
        try:
            free_plan = Plan.objects.get(slug=Plan.SLUG_FREE)
            return free_plan.plan_features.filter(feature__code=feature_code).exists()
        except Plan.DoesNotExist:
            return False

    if not sub.is_active:
        # Downgraded / expired → fall back to free-plan features
        from .models import Plan
        try:
            free_plan = Plan.objects.get(slug=Plan.SLUG_FREE)
            return free_plan.plan_features.filter(feature__code=feature_code).exists()
        except Plan.DoesNotExist:
            return False

    return sub.has_feature(feature_code)


def user_feature_limit(user, feature_code: str):
    """
    Return usage limit for a feature (None = unlimited, 0 = no access).
    """
    sub = get_user_subscription(user)
    if sub is None or not sub.is_active:
        from .models import Plan
        try:
            free_plan = Plan.objects.get(slug=Plan.SLUG_FREE)
            pf = free_plan.plan_features.filter(feature__code=feature_code).first()
            if pf is None:
                return 0
            return pf.limit
        except Plan.DoesNotExist:
            return 0

    return sub.feature_limit(feature_code)


def requires_feature(feature_code: str):
    """
    Decorator for DRF api_view functions.
    Returns HTTP 403 with upgrade prompt if feature is not available.

    Usage:
        @api_view(['GET'])
        @requires_feature('advanced_stats')
        def my_view(request):
            ...
    """
    def decorator(view_func):
        @functools.wraps(view_func)
        def wrapper(request, *args, **kwargs):
            if not request.user or not request.user.is_authenticated:
                return Response(
                    {'detail': 'Autenticação necessária.'},
                    status=status.HTTP_401_UNAUTHORIZED,
                )
            if not user_has_feature(request.user, feature_code):
                sub = get_user_subscription(request.user)
                current_plan = sub.plan.name if sub else 'Free'
                return Response(
                    {
                        'detail': f'Recurso "{feature_code}" não está disponível no plano {current_plan}.',
                        'feature_code': feature_code,
                        'current_plan': current_plan,
                        'upgrade_required': True,
                    },
                    status=status.HTTP_403_FORBIDDEN,
                )
            return view_func(request, *args, **kwargs)
        return wrapper
    return decorator


class HasFeature:
    """
    DRF permission class for use in ViewSets:

        permission_classes = [IsAuthenticated, HasFeature('tournament_creation')]
    """
    def __init__(self, feature_code: str):
        self.feature_code = feature_code

    def has_permission(self, request, view) -> bool:
        if not request.user or not request.user.is_authenticated:
            return False
        return user_has_feature(request.user, self.feature_code)

    def __call__(self):
        return self
