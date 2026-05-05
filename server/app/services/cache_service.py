from __future__ import annotations

import json
import os
import threading
import time
from typing import Any

try:
    import redis  # type: ignore
except Exception:  # pragma: no cover - optional dependency
    redis = None


class _InMemoryCache:
    def __init__(self) -> None:
        self._items: dict[str, tuple[float, str]] = {}
        self._lock = threading.Lock()

    def get(self, key: str) -> str | None:
        now = time.time()
        with self._lock:
            value = self._items.get(key)
            if not value:
                return None
            expires_at, payload = value
            if expires_at and expires_at < now:
                self._items.pop(key, None)
                return None
            return payload

    def set(self, key: str, payload: str, ttl_seconds: int) -> None:
        expires_at = time.time() + max(ttl_seconds, 1)
        with self._lock:
            self._items[key] = (expires_at, payload)

    def delete_prefix(self, prefix: str) -> None:
        with self._lock:
            keys = [key for key in self._items if key.startswith(prefix)]
            for key in keys:
                self._items.pop(key, None)


class CacheService:
    def __init__(self) -> None:
        self._fallback = _InMemoryCache()
        self._redis = None
        redis_url = os.getenv("REDIS_URL", "").strip()
        if redis and redis_url:
            try:
                self._redis = redis.Redis.from_url(redis_url, decode_responses=True)
                self._redis.ping()
            except Exception:
                self._redis = None

    def get_json(self, key: str) -> Any | None:
        raw = None
        if self._redis is not None:
            try:
                raw = self._redis.get(key)
            except Exception:
                raw = None
        if raw is None:
            raw = self._fallback.get(key)
        if raw is None:
            return None
        try:
            return json.loads(raw)
        except Exception:
            return None

    def set_json(self, key: str, value: Any, ttl_seconds: int = 300) -> None:
        try:
            payload = json.dumps(value)
        except Exception:
            return

        stored = False
        if self._redis is not None:
            try:
                self._redis.setex(key, ttl_seconds, payload)
                stored = True
            except Exception:
                stored = False
        if not stored:
            self._fallback.set(key, payload, ttl_seconds)

    def delete_prefix(self, prefix: str) -> None:
        if self._redis is not None:
            try:
                for key in self._redis.scan_iter(match=f"{prefix}*"):
                    self._redis.delete(key)
            except Exception:
                pass
        self._fallback.delete_prefix(prefix)


cache = CacheService()
