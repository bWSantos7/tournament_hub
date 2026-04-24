"""OTP utilities: generate and verify 6-digit codes stored in Redis."""
import logging
import random
import string

from django.core.cache import cache

logger = logging.getLogger('apps.accounts')

OTP_TTL = 600        # seconds (10 minutes)
MAX_ATTEMPTS = 5

VALID_OTP_TYPES = frozenset({'email', 'phone', 'password_reset'})


def _code_key(user_id: int, otp_type: str) -> str:
    return f'otp:code:{otp_type}:{user_id}'


def _attempts_key(user_id: int, otp_type: str) -> str:
    return f'otp:attempts:{otp_type}:{user_id}'


def generate_and_store(user_id: int, otp_type: str) -> str:
    """Generate a 6-digit OTP, store in Redis and return the plain code."""
    if otp_type not in VALID_OTP_TYPES:
        raise ValueError(f'Invalid OTP type: {otp_type!r}. Must be one of {VALID_OTP_TYPES}')
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


