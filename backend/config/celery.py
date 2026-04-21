import os
from celery import Celery
from celery.schedules import crontab

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

app = Celery('tournament_hub')
app.config_from_object('django.conf:settings', namespace='CELERY')
app.autodiscover_tasks()

# Periodic tasks
app.conf.beat_schedule = {
    'ingest-all-active-sources-hourly': {
        'task': 'apps.ingestion.tasks.run_all_active_sources',
        'schedule': crontab(minute=0),  # every hour at minute 0
    },
    'dispatch-deadline-alerts-hourly': {
        'task': 'apps.alerts.tasks.dispatch_deadline_alerts',
        'schedule': crontab(minute=15),
    },
    'detect-tournament-changes-every-2h': {
        'task': 'apps.ingestion.tasks.detect_tournament_changes',
        'schedule': crontab(minute=30, hour='*/2'),
    },
    'cleanup-old-logs-daily': {
        'task': 'apps.audit.tasks.cleanup_old_logs',
        'schedule': crontab(hour=3, minute=0),
    },
}


@app.task(bind=True)
def debug_task(self):
    print(f'Request: {self.request!r}')
