"""Celery tasks for the accounts app — email dispatch with retry and HTML templates."""
import logging

from celery import shared_task
from django.conf import settings
from django.core.mail import EmailMultiAlternatives

logger = logging.getLogger('apps.accounts')

APP_NAME = 'Tennis Hub'
BRAND_COLOR = '#39ff14'
BG_COLOR = '#0F0F0F'
CARD_COLOR = '#1A1A1A'
TEXT_COLOR = '#F9FAFB'
MUTED_COLOR = '#9CA3AF'
FRONTEND_URL = 'https://tennis.app.br'


def _base_html(title: str, body_html: str) -> str:
    return f"""<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>{title}</title>
  <style>
    body {{ margin:0; padding:0; background:{BG_COLOR}; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; }}
    .wrapper {{ max-width:560px; margin:0 auto; padding:32px 16px; }}
    .logo {{ text-align:center; margin-bottom:32px; }}
    .logo span {{ font-size:22px; font-weight:800; color:{BRAND_COLOR}; letter-spacing:-0.5px; }}
    .card {{ background:{CARD_COLOR}; border-radius:16px; padding:32px; border:1px solid #2D2D2D; }}
    h1 {{ color:{TEXT_COLOR}; font-size:20px; font-weight:700; margin:0 0 8px; }}
    p {{ color:{MUTED_COLOR}; font-size:15px; line-height:1.6; margin:12px 0; }}
    .code-block {{ background:{BG_COLOR}; border:1px solid {BRAND_COLOR}44; border-radius:12px; padding:24px; text-align:center; margin:24px 0; }}
    .code {{ font-size:40px; font-weight:800; color:{BRAND_COLOR}; letter-spacing:12px; font-family:monospace; }}
    .code-hint {{ color:{MUTED_COLOR}; font-size:12px; margin-top:8px; }}
    .btn {{ display:inline-block; background:{BRAND_COLOR}; color:{BG_COLOR}; font-weight:700; font-size:15px; padding:14px 32px; border-radius:12px; text-decoration:none; margin:24px 0; }}
    .footer {{ text-align:center; margin-top:32px; color:#4B5563; font-size:12px; line-height:1.6; }}
    .footer a {{ color:#6B7280; text-decoration:underline; }}
    .divider {{ border:none; border-top:1px solid #2D2D2D; margin:24px 0; }}
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="logo">
      <span>🎾 {APP_NAME}</span>
    </div>
    <div class="card">
      {body_html}
    </div>
    <div class="footer">
      <p>© {APP_NAME} · <a href="{FRONTEND_URL}">tennis.app.br</a></p>
      <p>Você recebe este e-mail pois possui uma conta no Tennis Hub.<br/>
      Se não reconhece esta ação, ignore este e-mail com segurança.</p>
    </div>
  </div>
</body>
</html>"""


def _send_html_email(subject: str, to: str, text_body: str, html_body: str, from_email: str = None):
    """Send a multi-part email with plain-text fallback."""
    msg = EmailMultiAlternatives(
        subject=subject,
        body=text_body,
        from_email=from_email or settings.DEFAULT_FROM_EMAIL,
        to=[to],
    )
    msg.attach_alternative(html_body, 'text/html')
    msg.send(fail_silently=False)


@shared_task(bind=True, max_retries=3, default_retry_delay=60, acks_late=True)
def send_otp_email(self, user_id: int, email: str, full_name: str, code: str, subject_key: str = 'verify'):
    """Send OTP verification email with branded HTML template."""
    name = (full_name or email.split('@')[0]).split(' ')[0]

    subjects = {
        'verify': f'[{APP_NAME}] Verifique seu e-mail',
        'resend': f'[{APP_NAME}] Seu novo código de verificação',
        'reset':  f'[{APP_NAME}] Código de redefinição de senha',
    }
    subject = subjects.get(subject_key, subjects['verify'])

    intro = {
        'verify': 'Quase lá! Use o código abaixo para verificar seu endereço de e-mail e ativar sua conta.',
        'resend': 'Você solicitou um novo código de verificação. Use-o abaixo para confirmar seu e-mail.',
        'reset':  'Você solicitou a redefinição de senha. Use o código abaixo para continuar.',
    }.get(subject_key, '')

    html_body = _base_html(subject, f"""
      <h1>Olá, {name}! 👋</h1>
      <p>{intro}</p>
      <div class="code-block">
        <div class="code">{code}</div>
        <div class="code-hint">Válido por <strong>10 minutos</strong> · Não compartilhe com ninguém</div>
      </div>
      <hr class="divider"/>
      <p style="font-size:13px;">Se você não solicitou este código, pode ignorar este e-mail com segurança. Sua conta continua protegida.</p>
    """)

    text_body = (
        f'Olá {name},\n\n'
        f'{intro}\n\n'
        f'Seu código: {code}\n\n'
        f'Válido por 10 minutos. Não compartilhe com ninguém.\n\n'
        f'Se não foi você, ignore este e-mail.\n\n'
        f'— {APP_NAME}'
    )

    try:
        _send_html_email(subject, email, text_body, html_body)
        logger.info('OTP email dispatched to user %s', user_id)
    except Exception as exc:
        logger.warning('OTP email failed for user %s (attempt %d): %s', user_id, self.request.retries + 1, exc)
        raise self.retry(exc=exc)


@shared_task(bind=True, max_retries=3, default_retry_delay=60, acks_late=True)
def send_password_reset_email(self, user_id: int, email: str, full_name: str, reset_url: str):
    """Send password reset email with branded HTML template. reset_url never logged."""
    name = (full_name or email.split('@')[0]).split(' ')[0]
    subject = f'[{APP_NAME}] Redefinição de senha'

    html_body = _base_html(subject, f"""
      <h1>Redefinir senha 🔐</h1>
      <p>Olá, <strong>{name}</strong>! Recebemos uma solicitação para redefinir a senha da sua conta no {APP_NAME}.</p>
      <p>Clique no botão abaixo para criar uma nova senha. Este link é válido por <strong>24 horas</strong>.</p>
      <div style="text-align:center;">
        <a href="{reset_url}" class="btn">Redefinir minha senha</a>
      </div>
      <hr class="divider"/>
      <p style="font-size:13px;">Se você não solicitou a redefinição, pode ignorar este e-mail com segurança. Sua senha atual continua a mesma.</p>
      <p style="font-size:12px; color:#4B5563;">Se o botão não funcionar, copie e cole este link no seu navegador:<br/>{reset_url}</p>
    """)

    text_body = (
        f'Olá {name},\n\n'
        f'Recebemos uma solicitação para redefinir a senha da sua conta no {APP_NAME}.\n\n'
        f'Acesse o link abaixo para criar uma nova senha (válido por 24h):\n\n'
        f'{reset_url}\n\n'
        f'Se não foi você, ignore este e-mail. Sua senha não será alterada.\n\n'
        f'— {APP_NAME}'
    )

    try:
        _send_html_email(subject, email, text_body, html_body)
        logger.info('Password reset email dispatched for user %s', user_id)
    except Exception as exc:
        logger.warning('Password reset email failed for user %s (attempt %d): %s', user_id, self.request.retries + 1, exc)
        raise self.retry(exc=exc)
