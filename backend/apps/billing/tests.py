"""Tests for billing app: plans, subscriptions, checkout flow, webhook processing."""
from unittest.mock import patch, MagicMock
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from apps.billing.models import Feature, Plan, PlanFeature, Subscription, Payment, WebhookEvent

User = get_user_model()


def make_user(email='test@example.com', password='testpass123'):
    return User.objects.create_user(email=email, password=password, full_name='Test User')


def make_plans():
    free = Plan.objects.create(
        name='Free', slug='free', price_monthly='0.00', price_yearly='0.00',
        display_order=0, is_active=True,
    )
    pro = Plan.objects.create(
        name='Pro', slug='pro', price_monthly='0.50', price_yearly='5.00',
        display_order=1, is_active=True,
    )
    feat = Feature.objects.create(code='ranking_access', name='Ranking')
    PlanFeature.objects.create(plan=free, feature=feat, limit=None)
    PlanFeature.objects.create(plan=pro, feature=feat, limit=None)
    return free, pro, feat


class PlansListTestCase(TestCase):
    def setUp(self):
        self.client = APIClient()
        make_plans()

    def test_plans_list_public(self):
        res = self.client.get('/api/billing/plans/')
        self.assertEqual(res.status_code, 200)
        slugs = [p['slug'] for p in res.data]
        self.assertIn('free', slugs)
        self.assertIn('pro', slugs)

    def test_plans_include_features(self):
        res = self.client.get('/api/billing/plans/')
        self.assertEqual(res.status_code, 200)
        pro = next(p for p in res.data if p['slug'] == 'pro')
        self.assertTrue(len(pro['features']) > 0)


class SubscriptionCheckoutTestCase(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = make_user()
        self.free, self.pro, _ = make_plans()
        self.client.force_authenticate(user=self.user)

    def test_checkout_free_plan_activates_immediately(self):
        res = self.client.post('/api/billing/subscription/checkout/', {
            'plan_slug': 'free',
            'billing_period': 'monthly',
            'payment_method': 'pix',
        }, format='json')
        # 201 on create, 200 on update (user already had auto-created free sub)
        self.assertIn(res.status_code, [200, 201])
        self.assertEqual(res.data['status'], 'active')
        self.assertEqual(res.data['plan_slug'], 'free')

    @override_settings(ASAAS_API_KEY='')
    def test_checkout_paid_plan_without_asaas_stays_pending(self):
        res = self.client.post('/api/billing/subscription/checkout/', {
            'plan_slug': 'pro',
            'billing_period': 'monthly',
            'payment_method': 'pix',
        }, format='json')
        self.assertEqual(res.status_code, 201)
        self.assertEqual(res.data['status'], 'active')
        self.assertEqual(res.data['plan_slug'], 'free')
        self.assertEqual(res.data['pending_plan'], self.pro.id)
        self.assertEqual(res.data['pending_billing_period'], 'monthly')

        subscription = Subscription.objects.get(user=self.user)
        self.assertEqual(subscription.status, Subscription.STATUS_ACTIVE)
        self.assertEqual(subscription.plan, self.free)
        self.assertEqual(subscription.pending_plan, self.pro)
        self.assertEqual(subscription.pending_billing_period, 'monthly')

    def test_checkout_requires_auth(self):
        anon = APIClient()
        res = anon.post('/api/billing/subscription/checkout/', {
            'plan_slug': 'free', 'billing_period': 'monthly', 'payment_method': 'pix'
        }, format='json')
        self.assertEqual(res.status_code, 401)

    def test_checkout_invalid_plan_returns_404(self):
        res = self.client.post('/api/billing/subscription/checkout/', {
            'plan_slug': 'invalid', 'billing_period': 'monthly', 'payment_method': 'pix'
        }, format='json')
        self.assertIn(res.status_code, [400, 404])

    def test_subscription_detail_creates_free_if_none(self):
        res = self.client.get('/api/billing/subscription/')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data['plan_slug'], 'free')
        self.assertEqual(res.data['status'], 'active')

    def test_cancel_subscription(self):
        # Create a subscription first
        self.client.post('/api/billing/subscription/checkout/', {
            'plan_slug': 'free', 'billing_period': 'monthly', 'payment_method': 'pix'
        }, format='json')
        res = self.client.post('/api/billing/subscription/cancel/', {'immediate': True}, format='json')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data['status'], 'canceled')

    def test_cannot_cancel_already_canceled(self):
        Subscription.objects.create(
            user=self.user, plan=self.free,
            status=Subscription.STATUS_CANCELED,
        )
        res = self.client.post('/api/billing/subscription/cancel/', {'immediate': True}, format='json')
        self.assertEqual(res.status_code, 400)


class WebhookTestCase(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = make_user('webhook@example.com')
        free, self.pro, _ = make_plans()
        self.sub = Subscription.objects.create(
            user=self.user,
            plan=self.pro,
            status=Subscription.STATUS_PENDING,
            asaas_subscription_id='sub_test_123',
        )

    def _post_webhook(self, payload, token='test_token'):
        import os
        os.environ['ASAAS_WEBHOOK_TOKEN'] = token
        with patch.dict('django.conf.settings.__dict__', {'ASAAS_WEBHOOK_TOKEN': token}):
            res = self.client.post(
                '/api/billing/webhooks/asaas/',
                payload,
                format='json',
                HTTP_ASAAS_WEBHOOK_TOKEN=token,
            )
        return res

    def test_webhook_invalid_token_returns_401(self):
        with patch('apps.billing.services.asaas_service.validate_webhook_token', return_value=False):
            res = self.client.post('/api/billing/webhooks/asaas/', {}, format='json')
        self.assertEqual(res.status_code, 401)

    def test_webhook_payment_confirmed_activates_subscription(self):
        payload = {
            'event': 'PAYMENT_CONFIRMED',
            'payment': {
                'id': 'pay_001',
                'subscription': 'sub_test_123',
                'value': 0.50,
                'billingType': 'PIX',
                'description': 'Tennis Hub Pro',
                'externalReference': str(self.user.id),
            }
        }
        with patch('apps.billing.services.asaas_service.validate_webhook_token', return_value=True):
            res = self.client.post('/api/billing/webhooks/asaas/', payload, format='json')
        self.assertEqual(res.status_code, 200)
        self.sub.refresh_from_db()
        self.assertEqual(self.sub.status, Subscription.STATUS_ACTIVE)

    def test_webhook_payment_overdue_sets_unpaid(self):
        self.sub.status = Subscription.STATUS_ACTIVE
        self.sub.save()
        payload = {
            'event': 'PAYMENT_OVERDUE',
            'payment': {'id': 'pay_002', 'subscription': 'sub_test_123', 'value': 0.50, 'billingType': 'PIX'},
        }
        with patch('apps.billing.services.asaas_service.validate_webhook_token', return_value=True):
            res = self.client.post('/api/billing/webhooks/asaas/', payload, format='json')
        self.assertEqual(res.status_code, 200)
        self.sub.refresh_from_db()
        self.assertEqual(self.sub.status, Subscription.STATUS_UNPAID)

    def test_webhook_duplicate_event_skipped(self):
        """Idempotency: duplicate webhook event must be ignored."""
        WebhookEvent.objects.create(
            event_type='PAYMENT_CONFIRMED', asaas_id='pay_dup', payload={}, processed=True
        )
        payload = {
            'event': 'PAYMENT_CONFIRMED',
            'payment': {'id': 'pay_dup', 'subscription': 'sub_test_123', 'value': 0.50, 'billingType': 'PIX'},
        }
        with patch('apps.billing.services.asaas_service.validate_webhook_token', return_value=True):
            res = self.client.post('/api/billing/webhooks/asaas/', payload, format='json')
        self.assertEqual(res.status_code, 200)


class FeaturePermissionsTestCase(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = make_user('perms@example.com')
        self.free, self.pro, self.feat = make_plans()
        self.client.force_authenticate(user=self.user)

    def test_free_user_has_ranking_access(self):
        from apps.billing.permissions import user_has_feature
        self.assertTrue(user_has_feature(self.user, 'ranking_access'))

    def test_no_subscription_falls_back_to_free(self):
        from apps.billing.permissions import user_has_feature
        # User has no subscription — should fall back to free plan features
        self.assertTrue(user_has_feature(self.user, 'ranking_access'))

    def test_my_features_endpoint_returns_map(self):
        res = self.client.get('/api/billing/features/')
        self.assertEqual(res.status_code, 200)
        self.assertIn('ranking_access', res.data)
        self.assertIn('has_access', res.data['ranking_access'])
