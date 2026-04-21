"""Celery tasks orchestrating ingestion."""
import logging
from datetime import timedelta

from celery import shared_task
from django.utils import timezone

from apps.sources.models import DataSource
from apps.tournaments.models import TournamentEdition, TournamentChangeEvent
from .connectors.base import get_connector, ConnectorError
from .connectors import cbt as _cbt  # noqa: F401
from .connectors import fct as _fct  # noqa: F401
from .connectors import fpt as _fpt  # noqa: F401
from .models import IngestionRun
from .persistence import TournamentPersister

logger = logging.getLogger('apps.ingestion.tasks')


@shared_task(bind=True, max_retries=2, default_retry_delay=300)
def run_source(self, data_source_id: int):
    try:
        source = DataSource.objects.select_related('organization').get(pk=data_source_id)
    except DataSource.DoesNotExist:
        logger.error('DataSource %s not found', data_source_id)
        return {'error': 'not_found'}

    if not source.enabled:
        return {'skipped': True, 'reason': 'disabled'}

    connector_cls = get_connector(source.connector_key)
    if not connector_cls:
        logger.error('No connector registered for key %s', source.connector_key)
        source.last_run_status = 'failed_no_connector'
        source.save(update_fields=['last_run_status', 'updated_at'])
        return {'error': 'no_connector'}

    run = IngestionRun.objects.create(
        data_source=source, triggered_by='celery',
    )
    TournamentPersister.invalidate_category_cache()
    persister = TournamentPersister(source, run)

    created_n = 0
    updated_n = 0
    fetched_n = 0
    changes_n = 0
    errors = []

    try:
        connector = connector_cls(data_source=source)
        for item in connector.extract():
            fetched_n += 1
            try:
                ed, created, changes = persister.upsert(item)
                if created:
                    created_n += 1
                else:
                    updated_n += 1
                if changes:
                    changes_n += 1
                    last_event = ed.change_events.order_by('-detected_at').first()
                    if last_event:
                        from apps.alerts.tasks import dispatch_change_alert
                        dispatch_change_alert.delay(ed.id, last_event.id)
            except Exception as exc:
                logger.exception('persist failed for item')
                errors.append(f'persist:{exc}')

        status = IngestionRun.STATUS_SUCCESS if not errors else IngestionRun.STATUS_PARTIAL
    except ConnectorError as exc:
        errors.append(str(exc))
        status = IngestionRun.STATUS_FAILED
    except Exception as exc:
        errors.append(str(exc))
        status = IngestionRun.STATUS_FAILED
        logger.exception('unhandled ingestion error')

    run.finished_at = timezone.now()
    run.status = status
    run.items_fetched = fetched_n
    run.items_created = created_n
    run.items_updated = updated_n
    run.changes_detected = changes_n
    run.error_summary = '\n'.join(errors)[:4000]
    run.metrics = {
        'fetched': fetched_n, 'created': created_n,
        'updated': updated_n, 'changes': changes_n,
        'errors': len(errors),
    }
    run.save()

    source.last_run_at = run.finished_at
    source.last_run_status = status
    source.save(update_fields=['last_run_at', 'last_run_status', 'updated_at'])

    return {
        'status': status, 'run_id': run.id,
        'fetched': fetched_n, 'created': created_n,
        'updated': updated_n, 'changes': changes_n,
        'errors': errors[:5],
    }


@shared_task
def run_all_active_sources():
    ids = list(DataSource.objects.filter(enabled=True).values_list('id', flat=True))
    for sid in ids:
        run_source.delay(sid)
    return {'dispatched': len(ids)}


@shared_task
def detect_tournament_changes():
    now = timezone.now()
    soon = now + timedelta(days=3)
    qs = TournamentEdition.objects.filter(
        entry_close_at__isnull=False,
        entry_close_at__gt=now,
        entry_close_at__lte=soon,
    ).exclude(status=TournamentEdition.STATUS_CLOSING_SOON).exclude(
        status__in=[TournamentEdition.STATUS_CANCELED, TournamentEdition.STATUS_FINISHED]
    )
    n = 0
    for ed in qs:
        prev = ed.status
        ed.status = TournamentEdition.STATUS_CLOSING_SOON
        ed.save(update_fields=['status', 'updated_at'])
        TournamentChangeEvent.objects.create(
            edition=ed, event_type=TournamentChangeEvent.EVENT_STATUS,
            field_changes={'status': {'old': prev, 'new': ed.status}},
        )
        n += 1

    qs2 = TournamentEdition.objects.filter(
        entry_close_at__isnull=False, entry_close_at__lte=now,
        status__in=[
            TournamentEdition.STATUS_OPEN,
            TournamentEdition.STATUS_CLOSING_SOON,
            TournamentEdition.STATUS_ANNOUNCED,
        ],
    )
    closed_n = 0
    for ed in qs2:
        prev = ed.status
        ed.status = TournamentEdition.STATUS_CLOSED
        ed.save(update_fields=['status', 'updated_at'])
        TournamentChangeEvent.objects.create(
            edition=ed, event_type=TournamentChangeEvent.EVENT_STATUS,
            field_changes={'status': {'old': prev, 'new': ed.status}},
        )
        closed_n += 1
    return {'closing_soon': n, 'closed': closed_n}
