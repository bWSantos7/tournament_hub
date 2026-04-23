import logging
from django.conf import settings
from django.core.mail.backends.base import BaseEmailBackend

logger = logging.getLogger(__name__)


class ResendEmailBackend(BaseEmailBackend):
    def __init__(self, api_key=None, **kwargs):
        super().__init__(**kwargs)
        self.api_key = api_key or getattr(settings, 'RESEND_API_KEY', '')

    def open(self):
        return True

    def close(self):
        pass

    def send_messages(self, email_messages):
        import resend

        resend.api_key = self.api_key
        if not resend.api_key:
            logger.error('RESEND_API_KEY not configured')
            return 0

        sent = 0
        for message in email_messages:
            try:
                params = {
                    'from': message.from_email or settings.DEFAULT_FROM_EMAIL,
                    'to': message.to,
                    'subject': message.subject,
                }

                if message.content_subtype == 'html':
                    params['html'] = message.body
                else:
                    params['text'] = message.body

                for content, mimetype in (message.alternatives if hasattr(message, 'alternatives') else []):
                    if mimetype == 'text/html':
                        params['html'] = content
                    elif mimetype == 'text/plain':
                        params['text'] = content

                if message.cc:
                    params['cc'] = message.cc
                if message.bcc:
                    params['bcc'] = message.bcc
                if message.reply_to:
                    params['reply_to'] = list(message.reply_to)

                resend.Emails.send(params)
                sent += 1
            except Exception as exc:
                logger.exception('Resend failed to send email to %s: %s', message.to, exc)
                if not self.fail_silently:
                    raise
        return sent
