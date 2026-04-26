"""Celery tasks for the accounts app — email dispatch with retry."""
import logging

from celery import shared_task
from django.conf import settings
from django.core.mail import send_mail

logger = logging.getLogger('apps.accounts')


@shared_task(
    bind=True,
    max_retries=3,
    default_retry_delay=60,  # 1 min between retries
    acks_late=True,
)
def send_otp_email(self, user_id: int, email: str, full_name: str, code: str, subject_key: str = 'verify'):
    """
    Send an OTP email with automatic retry on failure.
    subject_key: 'verify' | 'resend' | 'reset'
    """
    subjects = {
        'verify': '[Tennis Hub] Verifique seu e-mail',
        'resend': '[Tennis Hub] Código de verificação de e-mail',
        'reset':  '[Tennis Hub] Redefinição de senha',
    }
    subject = subjects.get(subject_key, subjects['verify'])
    name = full_name or email
    body = (
        f'Olá {name}!\n\n'
        f'Seu código de verificação é:\n\n'
        f'  {code}\n\n'
        f'Válido por 10 minutos. Não compartilhe com ninguém.'
    )
    try:
        send_mail(
            subject=subject,
            message=body,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[email],
            fail_silently=False,
        )
        logger.info('OTP email dispatched to user %s', user_id)
    except Exception as exc:
        logger.warning('OTP email failed for user %s (attempt %d): %s', user_id, self.request.retries + 1, exc)
        raise self.retry(exc=exc)


@shared_task(
    bind=True,
    max_retries=3,
    default_retry_delay=60,
    acks_late=True,
)
def send_password_reset_email(self, user_id: int, email: str, full_name: str, reset_url: str):
    """Send password reset email with retry. reset_url contains uid+token — never logged."""
    name = full_name or email
    try:
        send_mail(
            subject='[Tennis Hub] Redefinição de senha',
            message=(
                f'Olá {name},\n\n'
                f'Clique no link abaixo para redefinir sua senha (válido por 24h):\n\n'
                f'{reset_url}\n\n'
                f'Se não foi você, ignore este email.'
            ),
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[email],
            fail_silently=False,
        )
        logger.info('Password reset email dispatched for user %s', user_id)
    except Exception as exc:
        logger.warning('Password reset email failed for user %s (attempt %d): %s', user_id, self.request.retries + 1, exc)
        raise self.retry(exc=exc)
