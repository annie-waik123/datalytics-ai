"""
LLM Service — Groq API client using llama-3.3-70b-versatile.
Production-grade: retry logic, exponential backoff, rate-limit detection,
timeout protection, and structured logging.
"""
from __future__ import annotations

import logging
import os
import time
from typing import Any

from dotenv import load_dotenv

load_dotenv()

log = logging.getLogger(__name__)

GROQ_MODEL = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile").strip()
GROQ_TEMPERATURE = float(os.getenv("GROQ_TEMPERATURE", "0.2"))
GROQ_MAX_TOKENS = int(os.getenv("GROQ_MAX_TOKENS", "900"))
GROQ_MAX_RETRIES = int(os.getenv("GROQ_MAX_RETRIES", "3"))
GROQ_RETRY_DELAY = float(os.getenv("GROQ_RETRY_DELAY", "1.0"))

# Valid Groq models (fallback-safe)
VALID_GROQ_MODELS = {
    "llama-3.3-70b-versatile",
    "llama-3.1-70b-versatile",
    "llama-3.1-8b-instant",
    "mixtral-8x7b-32768",
    "gemma2-9b-it",
}


def has_groq_config() -> bool:
    """Check if GROQ_API_KEY is set and non-empty."""
    return bool(os.getenv("GROQ_API_KEY", "").strip())


def _get_client():
    """Lazy-import Groq to avoid import errors if not installed."""
    try:
        from groq import Groq
    except ImportError as exc:
        raise ImportError("groq package is not installed. Run: pip install groq") from exc

    api_key = os.getenv("GROQ_API_KEY", "").strip()
    if not api_key:
        raise ValueError("GROQ_API_KEY is not configured in environment.")
    return Groq(api_key=api_key)


def _safe_model(model: str | None) -> str:
    """Return a validated model name, falling back to default if invalid."""
    candidate = (model or GROQ_MODEL).strip()
    if candidate not in VALID_GROQ_MODELS:
        log.warning(
            "Unknown Groq model '%s'. Falling back to '%s'.", candidate, GROQ_MODEL
        )
        return GROQ_MODEL
    return candidate


def groq_chat(
    messages: list[dict[str, Any]],
    *,
    max_tokens: int | None = None,
    temperature: float | None = None,
    model: str | None = None,
    retries: int | None = None,
) -> str:
    """
    Send a chat completion request to Groq with production-grade retry logic.

    Args:
        messages:    OpenAI-compatible messages list [{role, content}, ...]
        max_tokens:  Override default max tokens
        temperature: Override default temperature
        model:       Override default model (validated against known models)
        retries:     Number of retry attempts on transient failure

    Returns:
        Generated text content as a string. Returns empty string if API is
        not configured. Raises last exception if all retries are exhausted.
    """
    if not has_groq_config():
        log.warning("groq_chat: GROQ_API_KEY not set — skipping LLM call.")
        return ""

    effective_model = _safe_model(model)
    effective_temperature = float(temperature if temperature is not None else GROQ_TEMPERATURE)
    effective_max_tokens = int(max_tokens or GROQ_MAX_TOKENS)
    effective_retries = int(retries if retries is not None else GROQ_MAX_RETRIES)

    # Clamp values to safe ranges
    effective_temperature = max(0.0, min(2.0, effective_temperature))
    effective_max_tokens = max(1, min(32768, effective_max_tokens))

    last_error: Exception | None = None

    for attempt in range(effective_retries + 1):
        try:
            client = _get_client()
            completion = client.chat.completions.create(
                model=effective_model,
                messages=messages,
                temperature=effective_temperature,
                max_tokens=effective_max_tokens,
            )
            content = completion.choices[0].message.content
            result = str(content or "").strip()
            if result:
                log.debug(
                    "groq_chat: success on attempt %d/%d, model=%s, tokens=%d",
                    attempt + 1, effective_retries + 1, effective_model, effective_max_tokens,
                )
            return result

        except Exception as exc:
            last_error = exc
            err_str = str(exc).lower()

            # Non-retryable errors — fail immediately
            if any(kw in err_str for kw in ("invalid api key", "authentication", "401", "403")):
                log.error("groq_chat: authentication error — %s", exc)
                raise

            # Rate-limit — wait longer before retry
            is_rate_limit = any(kw in err_str for kw in ("rate_limit", "429", "too many"))
            delay = (5.0 if is_rate_limit else GROQ_RETRY_DELAY) * (2 ** attempt)

            if attempt < effective_retries:
                log.warning(
                    "groq_chat: attempt %d/%d failed (%s). Retrying in %.1fs…",
                    attempt + 1, effective_retries + 1, exc, delay,
                )
                time.sleep(delay)
            else:
                log.error(
                    "groq_chat: all %d attempts failed. Last error: %s",
                    effective_retries + 1, exc,
                )

    if last_error:
        raise last_error
    return ""


def groq_stream_chat(
    messages: list[dict[str, Any]],
    *,
    max_tokens: int | None = None,
    temperature: float | None = None,
    model: str | None = None,
) -> str:
    """
    Streaming Groq call — collects chunks and returns full content as string.
    Falls back gracefully if streaming is unavailable.
    """
    if not has_groq_config():
        return ""

    effective_model = _safe_model(model)

    try:
        client = _get_client()
        stream = client.chat.completions.create(
            model=effective_model,
            messages=messages,
            temperature=float(temperature if temperature is not None else GROQ_TEMPERATURE),
            max_tokens=int(max_tokens or GROQ_MAX_TOKENS),
            stream=True,
        )

        chunks: list[str] = []
        for chunk in stream:
            if chunk.choices and chunk.choices[0].delta.content:
                chunks.append(chunk.choices[0].delta.content)
        return "".join(chunks).strip()

    except Exception as exc:
        log.warning("groq_stream_chat: streaming failed (%s). Falling back to non-streaming.", exc)
        # Fall back to non-streaming
        return groq_chat(messages, max_tokens=max_tokens, temperature=temperature, model=model)
