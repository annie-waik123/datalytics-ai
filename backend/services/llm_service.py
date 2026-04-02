from __future__ import annotations

import json
import os
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from dotenv import load_dotenv

load_dotenv()

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY", "").strip()
OPENROUTER_ENDPOINT = os.getenv("OPENROUTER_ENDPOINT", "https://openrouter.ai/api/v1/chat/completions").strip()
OPENROUTER_MODEL = os.getenv("OPENROUTER_MODEL", "qwen/qwen3.6-plus-preview:free").strip()
OPENROUTER_MAX_TOKENS = int(os.getenv("OPENROUTER_MAX_TOKENS", "900"))
OPENROUTER_TEMPERATURE = float(os.getenv("OPENROUTER_TEMPERATURE", "0.2"))
OPENROUTER_APP_NAME = os.getenv("OPENROUTER_APP_NAME", "Datalytics").strip()
OPENROUTER_APP_URL = os.getenv("OPENROUTER_APP_URL", "http://localhost:5000").strip()


def has_openrouter_config() -> bool:
    return bool(OPENROUTER_API_KEY and OPENROUTER_MODEL and OPENROUTER_ENDPOINT)


def _request_headers() -> dict[str, str]:
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
    }
    if OPENROUTER_APP_URL:
        headers["HTTP-Referer"] = OPENROUTER_APP_URL
    if OPENROUTER_APP_NAME:
        headers["X-Title"] = OPENROUTER_APP_NAME
    return headers


def _parse_error_body(raw: bytes) -> str:
    try:
        payload = json.loads(raw.decode("utf-8"))
    except Exception:
        return raw.decode("utf-8", errors="ignore") or "OpenRouter request failed."

    if isinstance(payload, dict):
        error = payload.get("error")
        if isinstance(error, dict):
            return str(error.get("message") or error)
        if error:
            return str(error)
    return "OpenRouter request failed."


def openrouter_chat(
    messages: list[dict[str, Any]],
    *,
    max_tokens: int | None = None,
    temperature: float | None = None,
) -> str:
    if not has_openrouter_config():
        return ""

    payload = {
        "model": OPENROUTER_MODEL,
        "messages": messages,
        "max_tokens": int(max_tokens or OPENROUTER_MAX_TOKENS),
        "temperature": float(OPENROUTER_TEMPERATURE if temperature is None else temperature),
    }

    request = Request(
        OPENROUTER_ENDPOINT,
        data=json.dumps(payload).encode("utf-8"),
        headers=_request_headers(),
        method="POST",
    )

    try:
        with urlopen(request, timeout=90) as response:
            raw = response.read()
    except HTTPError as exc:
        detail = _parse_error_body(exc.read())
        raise RuntimeError(detail) from exc
    except URLError as exc:
        raise RuntimeError(str(exc.reason or "OpenRouter connection failed.")) from exc
    except Exception as exc:
        raise RuntimeError(str(exc) or "OpenRouter request failed.") from exc

    try:
        data = json.loads(raw.decode("utf-8"))
    except Exception as exc:
        raise RuntimeError("OpenRouter returned unreadable JSON.") from exc

    content = (
        data.get("choices", [{}])[0]
        .get("message", {})
        .get("content", "")
    )
    return str(content or "").strip()
