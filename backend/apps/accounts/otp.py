"""OTP utilities: generate and verify 6-digit codes stored in Redis."""
import logging
import random
import string

from django.conf import settings
from django.core.cache import cache

logger = logging.getLogger('apps.accounts')

OTP_TTL = 600        # seconds (10 minutes)
MAX_ATTEMPTS = 5


def _code_key(user_id: int, otp_type: str) -> str:
    return f'otp:code:{otp_type}:{user_id}'


def _attempts_key(user_id: int, otp_type: str) -> str:
    return f'otp:attempts:{otp_type}:{user_id}'


def generate_and_store(user_id: int, otp_type: str) -> str:
    """Generate a 6-digit OTP, store in Redis and return the plain code."""
    code = ''.join(random.choices(string.digits, k=6))
    cache.set(_code_key(user_id, otp_type), code, OTP_TTL)
    cache.delete(_attempts_key(user_id, otp_type))
    return code


def verify(user_id: int, otp_type: str, code: str) -> bool:
    """
    Verify OTP. Returns True on match (deletes code).
    Returns False on mismatch or exceeded attempts.
    """
    attempts_key = _attempts_key(user_id, otp_type)
    attempts = cache.get(attempts_key, 0)
    if attempts >= MAX_ATTEMPTS:
        return False

    stored = cache.get(_code_key(user_id, otp_type))
    if stored is None:
        return False

    if stored == code.strip():
        cache.delete(_code_key(user_id, otp_type))
        cache.delete(attempts_key)
        return True

    cache.set(attempts_key, attempts + 1, OTP_TTL)
    return False


def send_sms(phone: str, message: str) -> None:
    """Send SMS via Twilio if configured, otherwise log (dev mode)."""
    sid = getattr(settings, 'TWILIO_ACCOUNT_SID', '')
    token = getattr(settings, 'TWILIO_AUTH_TOKEN', '')
    from_number = getattr(settings, 'TWILIO_FROM_NUMBER', '')

    if sid and token and from_number:
        try:
            from twilio.rest import Client  # optional dependency
            Client(sid, token).messages.create(body=message, from_=from_number, to=phone)
            logger.info('SMS sent to %s', phone)
        except ImportError:
            logger.error('twilio package not installed. pip install twilio')
        except Exception:
            logger.exception('SMS delivery failed to %s', phone)
    else:
        # Development fallback — print OTP so developers can test without Twilio
        logger.warning('[DEV] SMS to %s: %s', phone, message)
