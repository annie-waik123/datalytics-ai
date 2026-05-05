from __future__ import annotations

from concurrent.futures import Future, ThreadPoolExecutor
from typing import Any, Callable

from celery_app import celery_app

_executor = ThreadPoolExecutor(max_workers=2)


def submit_background_task(func: Callable[..., Any], *args, **kwargs) -> Future:
    return _executor.submit(func, *args, **kwargs)


def has_distributed_queue() -> bool:
    return celery_app is not None
