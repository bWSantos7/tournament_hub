"""
Asaas Payment Gateway Service
==============================
Stub implementation — all methods are fully structured and ready for production.
To activate: set ASAAS_API_KEY in environment variables.

Asaas docs: https://docs.asaas.com/reference/

Sandbox:    https://sandbox.asaas.com
Production: https://api.asaas.com
"""
import logging
from decimal import Decimal
from typing import Optional

import requests
from django.conf import settings

logger = logging.getLogger('apps.billing.asaas')


def _base_url() -> str:
    env = getattr(settings, 'ASAAS_ENVIRONMENT', 'sandbox')
    if env == 'production':
        return 'https://api.asaas.com/v3'
    return 'https://sandbox.asaas.com/api/v3'


def _headers() -> dict:
    api_key = getattr(settings, 'ASAAS_API_KEY', '')
    return {
        'access_token': api_key,
        'Content-Type': 'application/json',
        'User-Agent': 'TournamentHub/1.0',
    }


def _is_configured() -> bool:
    return bool(getattr(settings, 'ASAAS_API_KEY', ''))


def _request(method: str, path: str, **kwargs):
    """Generic HTTP call to Asaas API with error handling."""
    if not _is_configured():
        raise AsaasNotConfiguredError(
            'ASAAS_API_KEY not set. Configure the variable and set ASAAS_ENVIRONMENT=sandbox|production.'
        )
    url = f'{_base_url()}{path}'
    try:
        response = requests.request(
            method,
            url,
            headers=_headers(),
            timeout=30,
            **kwargs,
        )
        response.raise_for_status()
        return response.json()
    except requests.HTTPError as exc:
        body = {}
        try:
            body = exc.response.json()
        except Exception:
            pass
        logger.error('Asaas HTTP error %s %s: %s', method, path, body)
        raise AsaasAPIError(f'Asaas returned {exc.response.status_code}', body) from exc
    except requests.RequestException as exc:
        logger.exception('Asaas request failed: %s %s', method, path)
        raise AsaasAPIError(str(exc)) from exc


# ── Exceptions ─────────────────────────────────────────────────────────────────

class AsaasError(Exception):
    pass


class AsaasNotConfiguredError(AsaasError):
    """Raised when ASAAS_API_KEY is not configured."""
    pass


class AsaasAPIError(AsaasError):
    def __init__(self, message: str, body: dict = None):
        super().__init__(message)
        self.body = body or {}


# ── Customer ───────────────────────────────────────────────────────────────────

def create_customer(user) -> dict:
    """
    Create or retrieve an Asaas customer for the given user.
    https://docs.asaas.com/reference/criar-novo-cliente

    Returns the Asaas customer object dict.
    """
    payload = {
        'name': user.full_name or user.email,
        'email': user.email,
        'phone': user.phone or '',
        'externalReference': str(user.id),
    }
    logger.info('Creating Asaas customer for user %s', user.id)
    return _request('POST', '/customers', json=payload)


def get_or_create_customer(user) -> str:
    """
    Return existing asaas_customer_id from the user's subscription,
    or create a new customer and persist the ID.
    Returns the Asaas customer ID string.
    """
    from apps.billing.models import Subscription
    try:
        sub = user.subscription
        if sub.asaas_customer_id:
            return sub.asaas_customer_id
    except Subscription.DoesNotExist:
        pass

    customer = create_customer(user)
    cid = customer['id']

    # Persist immediately
    Subscription.objects.filter(user=user).update(asaas_customer_id=cid)
    logger.info('Asaas customer %s created for user %s', cid, user.id)
    return cid


# ── Subscriptions ──────────────────────────────────────────────────────────────

def create_subscription(user, plan, billing_period: str, payment_method: str, card_token: str = '') -> dict:
    """
    Create an Asaas subscription (recorrência).
    https://docs.asaas.com/reference/criar-assinatura-com-cartao-de-credito

    Args:
        user: Django user instance
        plan: billing.Plan instance
        billing_period: 'monthly' or 'yearly'
        payment_method: 'CREDIT_CARD' | 'PIX' | 'BOLETO'
        card_token: tokenized card (required for CREDIT_CARD)

    Returns Asaas subscription response dict.
    """
    from datetime import date
    customer_id = get_or_create_customer(user)
    price = float(plan.price_for_period(billing_period))
    cycle = 'MONTHLY' if billing_period == 'monthly' else 'YEARLY'

    payload = {
        'customer': customer_id,
        'billingType': payment_method.upper(),
        'value': price,
        'nextDueDate': date.today().isoformat(),
        'cycle': cycle,
        'description': f'Tournament Hub — Plano {plan.name}',
        'externalReference': str(user.id),
    }
    if payment_method.upper() == 'CREDIT_CARD' and card_token:
        payload['creditCardToken'] = card_token

    logger.info('Creating Asaas subscription for user %s plan %s', user.id, plan.slug)
    return _request('POST', '/subscriptions', json=payload)


def cancel_subscription(asaas_subscription_id: str) -> dict:
    """
    Cancel an Asaas subscription immediately.
    https://docs.asaas.com/reference/remover-assinatura
    """
    logger.info('Canceling Asaas subscription %s', asaas_subscription_id)
    return _request('DELETE', f'/subscriptions/{asaas_subscription_id}')


def get_subscription(asaas_subscription_id: str) -> dict:
    """Retrieve subscription details from Asaas."""
    return _request('GET', f'/subscriptions/{asaas_subscription_id}')


def update_subscription(asaas_subscription_id: str, **fields) -> dict:
    """
    Update subscription (e.g. change plan, billing type).
    https://docs.asaas.com/reference/atualizar-assinatura-existente
    """
    logger.info('Updating Asaas subscription %s: %s', asaas_subscription_id, fields)
    return _request('POST', f'/subscriptions/{asaas_subscription_id}', json=fields)


# ── Payments ───────────────────────────────────────────────────────────────────

def get_payment(asaas_payment_id: str) -> dict:
    """Retrieve payment details from Asaas."""
    return _request('GET', f'/payments/{asaas_payment_id}')


def list_subscription_payments(asaas_subscription_id: str) -> list:
    """List all payments for a subscription."""
    data = _request('GET', f'/payments', params={'subscription': asaas_subscription_id})
    return data.get('data', [])


def create_pix_payment(user, amount: Decimal, description: str) -> dict:
    """
    Create a one-time Pix payment (for plan upgrade, etc.).
    https://docs.asaas.com/reference/criar-nova-cobranca
    """
    from datetime import date
    customer_id = get_or_create_customer(user)
    payload = {
        'customer': customer_id,
        'billingType': 'PIX',
        'value': float(amount),
        'dueDate': date.today().isoformat(),
        'description': description,
    }
    logger.info('Creating Pix payment for user %s R$%.2f', user.id, amount)
    result = _request('POST', '/payments', json=payload)
    return result


def get_pix_qr_code(asaas_payment_id: str) -> dict:
    """Retrieve Pix QR code and copia-e-cola string for a payment."""
    return _request('GET', f'/payments/{asaas_payment_id}/pixQrCode')


def refund_payment(asaas_payment_id: str) -> dict:
    """Refund a payment."""
    logger.info('Refunding Asaas payment %s', asaas_payment_id)
    return _request('POST', f'/payments/{asaas_payment_id}/refund')


# ── Webhook signature validation ───────────────────────────────────────────────

def validate_webhook_token(token: str) -> bool:
    """
    Asaas sends a token in the webhook header (asaas-webhook-token).
    Compare against ASAAS_WEBHOOK_TOKEN env var.

    SECURITY: If ASAAS_WEBHOOK_TOKEN is not configured we REJECT the request.
    Accepting unauthenticated webhooks would allow payload injection by anyone.
    Configure the token before enabling Asaas integration.
    """
    expected = getattr(settings, 'ASAAS_WEBHOOK_TOKEN', '')
    if not expected:
        logger.error(
            'ASAAS_WEBHOOK_TOKEN is not configured. '
            'All webhook requests will be rejected until the token is set. '
            'Set ASAAS_WEBHOOK_TOKEN in your environment variables.'
        )
        return False  # reject — never accept unauthenticated webhooks
    return token == expected
