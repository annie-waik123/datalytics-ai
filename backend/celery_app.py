from __future__ import annotations

import os

try:
    from celery import Celery
except Exception:  # pragma: no cover - optional dependency
    Celery = None


def create_celery_app():
    if Celery is None:
        return None

    broker_url = os.getenv("CELERY_BROKER_URL") or os.getenv("REDIS_URL")
    result_backend = os.getenv("CELERY_RESULT_BACKEND") or os.getenv("REDIS_URL")
    if not broker_url or not result_backend:
        return None

    app = Celery("datalytics", broker=broker_url, backend=result_backend)
    app.conf.update(
        task_serializer="json",
        accept_content=["json"],
        result_serializer="json",
        task_track_started=True,
        worker_prefetch_multiplier=1,
        task_acks_late=True,
    )
    return app


celery_app = create_celery_app()
