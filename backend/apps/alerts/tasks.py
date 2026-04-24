import logging
from datetime import timedelta

from celery import shared_task
from django.conf import settings
from django.core.mail import send_mail
from django.template.loader import render_to_string
from django.utils import timezone
from django.utils.html import strip_tags

from .models import Alert, PushSubscription, UserAlertPreference
from apps.watchlist.models import WatchlistItem
from apps.tournaments.models import TournamentEdition, TournamentChangeEvent

logger = logging.getLogger('apps.alerts')


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def send_email_alert(self, alert_id: int):
    try:
        alert = Alert.objects.select_related('user', 'edition').get(pk=alert_id)
    except Alert.DoesNotExist:
        logger.warning('Alert %s not found', alert_id)
        return

    if not alert.user.email:
        alert.status = Alert.STATUS_FAILED
        alert.error = 'no_email'
        alert.save(update_fields=['status', 'error', 'updated_at'])
        return

    ctx = {
        'user': alert.user,
        'alert': alert,
        'edition': alert.edition,
        'frontend_url': getattr(settings, 'FRONTEND_URL', ''),
    }

    try:
        html_body = render_to_string('alerts/email_alert.html', ctx)
    except Exception:
        html_body = f'<h2>{alert.title}</h2><p>{alert.body}</p>'
    text_body = strip_tags(html_body)

    try:
        send_mail(
            subject=f'[Tournament Hub] {alert.title}',
            message=text_body,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[alert.user.email],
            html_message=html_body,
            fail_silently=False,
        )
        alert.status = Alert.STATUS_SENT
        alert.dispatched_at = timezone.now()
        alert.save(update_fields=['status', 'dispatched_at', 'updated_at'])
    except Exception as exc:
        logger.exception('Failed to send email alert %s', alert_id)
        alert.status = Alert.STATUS_FAILED
        alert.error = str(exc)[:300]
        alert.save(update_fields=['status', 'error', 'updated_at'])
        raise self.retry(exc=exc)


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def send_push_alert(self, alert_id: int):
    """Send a Web Push notification for an Alert using pywebpush."""
    try:
        alert = Alert.objects.select_related('user').get(pk=alert_id)
    except Alert.DoesNotExist:
        logger.warning('Alert %s not found', alert_id)
        return

    subscriptions = PushSubscription.objects.filter(user=alert.user)
    if not subscriptions.exists():
        alert.status = Alert.STATUS_FAILED
        alert.error = 'no_push_subscription'
        alert.save(update_fields=['status', 'error', 'updated_at'])
        return

    vapid_private_key = getattr(settings, 'VAPID_PRIVATE_KEY', '')
    vapid_claims_email = getattr(settings, 'VAPID_CLAIMS_EMAIL', settings.DEFAULT_FROM_EMAIL)
    if not vapid_private_key:
        alert.status = Alert.STATUS_FAILED
        alert.error = 'no_vapid_key'
        alert.save(update_fields=['status', 'error', 'updated_at'])
        logger.warning('VAPID_PRIVATE_KEY not configured — push notifications disabled')
        return

    try:
        from pywebpush import webpush, WebPushException
        import json as _json
        notification_payload = _json.dumps({
            'title': alert.title,
            'body': alert.body,
            'data': {'alert_id': alert.id, 'kind': alert.kind},
        })
    except ImportError:
        alert.status = Alert.STATUS_FAILED
        alert.error = 'pywebpush_not_installed'
        alert.save(update_fields=['status', 'error', 'updated_at'])
        return

    sent = 0
    errors = []
    for sub in subscriptions:
        try:
            webpush(
                subscription_info={
                    'endpoint': sub.endpoint,
                    'keys': {'p256dh': sub.p256dh, 'auth': sub.auth},
                },
                data=notification_payload,
                vapid_private_key=vapid_private_key,
                vapid_claims={'sub': f'mailto:{vapid_claims_email}'},
            )
            sent += 1
        except Exception as exc:
            errors.append(str(exc)[:100])
            logger.warning('Push send failed for sub %s: %s', sub.id, exc)
            # 410 Gone means the subscription is expired — clean it up
            if '410' in str(exc):
                sub.delete()

    if sent > 0:
        alert.status = Alert.STATUS_SENT
        alert.dispatched_at = timezone.now()
        alert.save(update_fields=['status', 'dispatched_at', 'updated_at'])
    else:
        alert.status = Alert.STATUS_FAILED
        alert.error = '; '.join(errors)[:300]
        alert.save(update_fields=['status', 'error', 'updated_at'])
        if errors:
            raise self.retry(exc=Exception(alert.error))


def _create_alert(user, edition, kind, channel, title, body='', payload=None, dedup_key=''):
    if dedup_key and Alert.objects.filter(user=user, dedup_key=dedup_key).exists():
        return None
    alert = Alert.objects.create(
        user=user,
        edition=edition,
        kind=kind,
        channel=channel,
        title=title,
        body=body,
        payload=payload or {},
        dedup_key=dedup_key,
    )
    if channel == Alert.CHANNEL_EMAIL:
        send_email_alert.delay(alert.id)
    elif channel == Alert.CHANNEL_PUSH:
        send_push_alert.delay(alert.id)
    else:
        alert.status = Alert.STATUS_SENT
        alert.dispatched_at = timezone.now()
        alert.save(update_fields=['status', 'dispatched_at', 'updated_at'])
    return alert


@shared_task(bind=True, max_retries=3, default_retry_delay=120)
def dispatch_deadline_alerts(self):
    """
    For every watchlist item whose user wants deadline alerts,
    send a notification when entry_close_at is within the configured D-N windows.
    """
    now = timezone.now()
    created = 0
    qs = (
        WatchlistItem.objects
        .select_related('user', 'edition', 'edition__tournament__organization')
        .filter(alert_on_deadline=True, edition__entry_close_at__isnull=False)
        .filter(edition__entry_close_at__gt=now)
    )
    for item in qs:
        prefs = UserAlertPreference.get_or_create_defaults(item.user)
        if not prefs.in_app_enabled and not prefs.email_enabled:
            continue
        days_list = prefs.deadline_days or [7, 2, 0]
        for d in days_list:
            window_start = now + timedelta(days=d)
            window_end = window_start + timedelta(hours=1)
            if not (window_start <= item.edition.entry_close_at <= window_end):
                continue
            dedup = f'deadline:{item.edition_id}:{d}'
            title = (
                f'{item.edition.title} — inscrições hoje!' if d == 0
                else f'{item.edition.title} — faltam {d} dias para o fechamento'
            )
            body = (
                f'O prazo de inscrição encerra em '
                f'{item.edition.entry_close_at.strftime("%d/%m/%Y %H:%M")} '
                f'(horário de Brasília). Link oficial: {item.edition.official_source_url or "-"}'
            )
            channel = Alert.CHANNEL_EMAIL if prefs.email_enabled else Alert.CHANNEL_IN_APP
            a = _create_alert(
                user=item.user, edition=item.edition,
                kind=Alert.KIND_DEADLINE, channel=channel,
                title=title, body=body,
                payload={'days_before': d},
                dedup_key=dedup,
            )
            if a:
                created += 1
            if channel == Alert.CHANNEL_EMAIL and prefs.in_app_enabled:
                _create_alert(
                    user=item.user, edition=item.edition,
                    kind=Alert.KIND_DEADLINE, channel=Alert.CHANNEL_IN_APP,
                    title=title, body=body,
                    payload={'days_before': d},
                    dedup_key=dedup + ':app',
                )
            if prefs.push_enabled:
                _create_alert(
                    user=item.user, edition=item.edition,
                    kind=Alert.KIND_DEADLINE, channel=Alert.CHANNEL_PUSH,
                    title=title, body=body,
                    payload={'days_before': d},
                    dedup_key=dedup + ':push',
                )
    logger.info('Dispatched %d deadline alerts', created)
    return created


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def dispatch_change_alert(self, edition_id: int, event_id: int):
    """Fan-out: notify every watcher of an edition when a change event is recorded."""
    try:
        edition = TournamentEdition.objects.get(pk=edition_id)
        event = TournamentChangeEvent.objects.get(pk=event_id)
    except (TournamentEdition.DoesNotExist, TournamentChangeEvent.DoesNotExist):
        return 0
    except Exception as exc:
        raise self.retry(exc=exc)

    created = 0
    watchers = WatchlistItem.objects.filter(edition=edition).select_related('user')
    for item in watchers:
        prefs = UserAlertPreference.get_or_create_defaults(item.user)
        if event.event_type == TournamentChangeEvent.EVENT_DRAWS:
            if not item.alert_on_draws or not prefs.draws_enabled:
                continue
            kind = Alert.KIND_DRAWS
            title = f'{edition.title} — chaves publicadas'
        elif event.event_type == TournamentChangeEvent.EVENT_CANCELED:
            kind = Alert.KIND_CANCELED
            title = f'{edition.title} — torneio cancelado'
        else:
            if not item.alert_on_changes or not prefs.changes_enabled:
                continue
            kind = Alert.KIND_CHANGE
            title = f'{edition.title} — dados alterados ({event.get_event_type_display()})'

        body_parts = []
        for field_name, change in (event.field_changes or {}).items():
            old = change.get('old') if isinstance(change, dict) else None
            new = change.get('new') if isinstance(change, dict) else change
            body_parts.append(f'{field_name}: {old} → {new}')
        body = '\n'.join(body_parts) or 'Mudanças detectadas na fonte oficial.'

        channel = Alert.CHANNEL_EMAIL if prefs.email_enabled else Alert.CHANNEL_IN_APP
        dedup = f'{kind}:{edition_id}:{event_id}'
        a = _create_alert(
            user=item.user, edition=edition,
            kind=kind, channel=channel,
            title=title, body=body,
            payload={'event_id': event_id, 'field_changes': event.field_changes},
            dedup_key=dedup,
        )
        if a:
            created += 1
        if channel == Alert.CHANNEL_EMAIL and prefs.in_app_enabled:
            _create_alert(
                user=item.user, edition=edition,
                kind=kind, channel=Alert.CHANNEL_IN_APP,
                title=title, body=body,
                payload={'event_id': event_id},
                dedup_key=dedup + ':app',
            )
    return created
