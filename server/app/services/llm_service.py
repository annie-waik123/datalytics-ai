"""
LLM service using OpenAI-compatible chat APIs.

Supports OpenAI (https://api.openai.com/v1) and Groq
(https://api.groq.com/openai/v1) through the same ``openai`` SDK.
Centralizes chat-compatible generation for chat, recommendations,
AI insights, reports, and decision making.
"""
from __future__ import annotations

import json
import logging
import os
from typing import Any

import openai
from dotenv import load_dotenv

_ENV_PATH = os.path.join(os.path.dirname(__file__), "..", "..", ".env")
load_dotenv(dotenv_path=_ENV_PATH, override=True)

log = logging.getLogger(__name__)

# ---- Provider selection ------------------------------------------------------
# LLM_PROVIDER: "groq" | "openai" | "auto" (default). Groq exposes an
# OpenAI-compatible API, so the same openai SDK is reused for both.
PROVIDER_CHOICE = os.getenv("LLM_PROVIDER", "").strip().lower()

OPEN_AI_KEY = (
    os.getenv("OPENAI_API_KEY", "").strip()
    or os.getenv("OPEN_AI_KEY", "").strip()
)
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "").strip()

if PROVIDER_CHOICE == "groq":
    LLM_PROVIDER = "groq"
elif PROVIDER_CHOICE == "openai":
    LLM_PROVIDER = "openai"
else:  # auto — prefer Groq when its key is configured
    LLM_PROVIDER = "groq" if GROQ_API_KEY else "openai"

if LLM_PROVIDER == "groq":
    API_KEY = GROQ_API_KEY
    BASE_URL = "https://api.groq.com/openai/v1"
    MODEL = os.getenv("GROQ_MODEL", "").strip() or "llama-3.3-70b-versatile"
else:
    API_KEY = OPEN_AI_KEY
    BASE_URL = os.getenv("OPENAI_BASE_URL", "").strip() or "https://api.openai.com/v1"
    MODEL = (
        os.getenv("OPENAI_MODEL", "").strip()
        or os.getenv("OPEN_AI_MODEL", "").strip()
        or "gpt-4o-mini"
    )

try:
    client = openai.OpenAI(api_key=API_KEY, base_url=BASE_URL) if API_KEY else None
    if not API_KEY:
        log.warning(
            "WARNING: No %s API key found in .env — AI features will be limited",
            LLM_PROVIDER.upper(),
        )
except Exception as e:
    log.warning(f"Could not initialize {LLM_PROVIDER} LLM client: {e}")
    client = None


def _completion_token_param(model_name: str) -> str:
    """Newer reasoning models reject max_tokens and expect max_completion_tokens."""
    normalized = str(model_name or "").lower()
    if normalized.startswith(("gpt-5", "o1", "o3", "o4")):
        return "max_completion_tokens"
    return "max_tokens"


def _create_chat_completion(
    *,
    model_name: str,
    messages: list[dict[str, Any]],
    max_tokens: int | None,
    temperature: float | None,
):
    if not client:
        raise RuntimeError("OpenAI client is not initialized")

    kwargs: dict[str, Any] = {
        "model": model_name,
        "messages": messages,
        _completion_token_param(model_name): max_tokens or 2500,
    }
    if temperature is not None:
        kwargs["temperature"] = temperature

    try:
        return client.chat.completions.create(**kwargs)
    except Exception as exc:
        message = str(exc)
        # Some OpenAI models reject sampling controls or the legacy token
        # parameter. Retry once with the compatible shape before surfacing.
        if "Unsupported parameter" in message and "max_tokens" in message:
            kwargs.pop("max_tokens", None)
            kwargs["max_completion_tokens"] = max_tokens or 2500
            return client.chat.completions.create(**kwargs)
        if "Unsupported value" in message and "temperature" in message:
            kwargs.pop("temperature", None)
            return client.chat.completions.create(**kwargs)
        raise


def get_active_llm_summary() -> dict[str, Any]:
    return {
        "configured": bool(API_KEY),
        "provider": LLM_PROVIDER,
        "model": MODEL,
        "base_url": BASE_URL,
    }


def has_groq_config() -> bool:
    """Compatibility alias — returns True when an LLM API key is configured."""
    return bool(API_KEY)


def has_llm_config() -> bool:
    return bool(API_KEY)


def groq_chat(
    messages: list[dict[str, Any]],
    *,
    max_tokens: int | None = None,
    temperature: float | None = None,
    model: str | None = None,
    retries: int | None = None,
) -> str:
    """Chat completion against the configured provider.

    Function name ``groq_chat`` is retained as a compatibility shim for
    existing callers; the active provider is chosen by LLM_PROVIDER
    ("openai" or "groq") in the environment.
    """
    if not client:
        log.warning("%s client is not initialized — key missing.", LLM_PROVIDER.title())
        return ""

    effective_model = model or MODEL
    effective_max_tokens = max_tokens or 2500

    try:
        response = _create_chat_completion(
            model_name=effective_model,
            messages=messages,
            temperature=temperature if temperature is not None else 0.3,
            max_tokens=effective_max_tokens,
        )
        result = response.choices[0].message.content or ""
        if result:
            log.info(f"{LLM_PROVIDER.title()} [{effective_model}] responded OK ({len(result)} chars).")
        return result
    except openai.RateLimitError:
        log.error("%s rate limit hit", LLM_PROVIDER.title())
        raise
    except openai.AuthenticationError:
        log.error(
            "%s authentication failed — check the %s API key in .env",
            LLM_PROVIDER.title(),
            LLM_PROVIDER.upper(),
        )
        raise
    except Exception as exc:
        log.error(f"{LLM_PROVIDER.title()} chat.completions failed [{effective_model}]: {exc}")
        raise


def groq_stream_chat(
    messages: list[dict[str, Any]],
    *,
    max_tokens: int | None = None,
    temperature: float | None = None,
    model: str | None = None,
) -> str:
    """
    Streaming-compatible wrapper.
    Function name retained to avoid breaking UI code.
    """
    try:
        return groq_chat(messages, max_tokens=max_tokens, temperature=temperature, model=model)
    except Exception as exc:
        log.warning("groq_stream_chat: failed (%s).", exc)
        return ""


def generate_recommendations_with_ai(df) -> dict:
    """
    Generate rich structured recommendations using OpenAI.
    Falls back gracefully if API is unavailable.
    """
    if not client:
        raise RuntimeError(
            f"{LLM_PROVIDER.title()} client not initialised — check the API key in .env"
        )

    import pandas as pd
    numeric_cols = df.select_dtypes(include="number").columns.tolist()
    categorical_cols = df.select_dtypes(include="object").columns.tolist()

    stats = {
        col: {
            "mean": round(float(df[col].mean()), 2),
            "min": round(float(df[col].min()), 2),
            "max": round(float(df[col].max()), 2),
            "std": round(float(df[col].std()), 2),
            "nulls": int(df[col].isnull().sum()),
        }
        for col in numeric_cols[:8]
    }
    cat_summary = {
        col: {str(k): int(v) for k, v in df[col].value_counts().head(5).items()}
        for col in categorical_cols[:5]
    }

    prompt = f"""You are a senior data analyst and business intelligence expert.

DATASET: {len(df)} rows, {len(df.columns)} columns
Numeric columns: {numeric_cols}
Categorical columns: {categorical_cols}
Missing values total: {int(df.isnull().sum().sum())}
Stats: {json.dumps(stats, indent=2)}
Categorical distributions: {json.dumps(cat_summary, indent=2)}

Return ONLY valid JSON, no markdown, no explanation:
{{
  "executive_summary": "3-4 sentence strategic summary with specific numbers from data",
  "ai_insights": [
    {{"type": "Finding|Problem|Opportunity|Risk", "title": "short title", "description": "specific insight referencing actual column names and values"}}
  ],
  "actionable_recommendations": [
    {{"type": "Strategic Recommendation|Operational Action|Quick Win", "title": "short title", "description": "specific actionable recommendation with measurable outcome", "priority": "High|Medium|Low", "impact": "expected business impact"}}
  ],
  "kpi_alerts": [
    {{"metric": "column name", "current_value": "actual value", "status": "Good|Warning|Critical", "message": "specific alert message"}}
  ],
  "data_quality_score": {{"score": 0, "issues": ["specific issues"], "suggestions": ["specific fixes"]}}
}}
Rules: minimum 6 ai_insights, minimum 4 actionable_recommendations. Always reference actual column names and specific numbers. Sound like a McKinsey analyst. No generic phrases."""

    def _parse_response(raw: str) -> dict:
        if raw.startswith("```"):
            parts = raw.split("```")
            raw = parts[1] if len(parts) > 1 else raw
            if raw.startswith("json"):
                raw = raw[4:]
        return json.loads(raw.strip())

    try:
        response = _create_chat_completion(
            model_name=MODEL,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.3,
            max_tokens=2500,
        )
        raw = response.choices[0].message.content.strip()
        try:
            return _parse_response(raw)
        except json.JSONDecodeError:
            # Retry once with stricter instruction
            retry_prompt = prompt + "\n\nCRITICAL: Return ONLY raw JSON. No backticks. No markdown. No explanation."
            retry_resp = _create_chat_completion(
                model_name=MODEL,
                messages=[{"role": "user", "content": retry_prompt}],
                temperature=0.1,
                max_tokens=2500,
            )
            return _parse_response(retry_resp.choices[0].message.content.strip())
    except openai.RateLimitError:
        from fastapi import HTTPException
        raise HTTPException(status_code=429, detail="AI rate limit hit, retry in 30 seconds")
    except openai.AuthenticationError:
        from fastapi import HTTPException
        raise HTTPException(status_code=401, detail="Invalid LLM API key in .env")
    except Exception as e:
        from fastapi import HTTPException
        raise HTTPException(status_code=500, detail=f"AI generation failed: {str(e)}")


def generate_decisions_with_ai(df, recommendations: dict = None) -> dict:
    """
    Generate executive-level decisions using OpenAI.
    """
    if not client:
        raise RuntimeError(
            f"{LLM_PROVIDER.title()} client not initialised — check the API key in .env"
        )

    numeric_cols = df.select_dtypes(include="number").columns.tolist()
    stats = {
        col: {
            "mean": round(float(df[col].mean()), 2),
            "max": round(float(df[col].max()), 2),
            "min": round(float(df[col].min()), 2),
        }
        for col in numeric_cols[:8]
    }
    context = json.dumps(recommendations, indent=2) if recommendations else "Not available"

    prompt = f"""You are a C-suite business decision engine generating EXECUTIVE-LEVEL decisions from data.

DATASET: {len(df)} rows, {len(df.columns)} columns
Columns: {df.columns.tolist()}
Stats: {json.dumps(stats, indent=2)}
Prior recommendations context: {context}

Return ONLY valid JSON, no markdown:
{{
  "top_decisions": [
    {{"decision": "action-oriented statement starting with verb (Increase/Reduce/Pivot/Invest/Discontinue)", "priority": "Critical|High|Medium|Low", "reason": "data-driven reason with specific numbers", "impact": "quantified expected impact", "timeframe": "Immediate (0-30 days)|Short-term (1-3 months)|Long-term (3-12 months)", "confidence": "High|Medium|Low", "data_evidence": "specific column values or patterns supporting this"}}
  ],
  "smart_actions": [
    {{"action": "specific executable action", "owner": "Data Team|Business Team|Executive|Operations", "deadline": "timeframe", "success_metric": "how to measure success"}}
  ],
  "risk_matrix": [
    {{"risk": "specific risk from data", "probability": "High|Medium|Low", "severity": "High|Medium|Low", "mitigation": "specific mitigation strategy"}}
  ],
  "scenario_analysis": {{
    "best_case": "best outcome if top decisions are executed",
    "worst_case": "worst outcome if no action taken",
    "most_likely": "most probable outcome"
  }}
}}
Rules: minimum 4 top_decisions, minimum 5 smart_actions, minimum 3 risks. Reference actual column names and values. Sound like a McKinsey/BCG board report. No vague statements."""

    def _parse_response(raw: str) -> dict:
        if raw.startswith("```"):
            parts = raw.split("```")
            raw = parts[1] if len(parts) > 1 else raw
            if raw.startswith("json"):
                raw = raw[4:]
        return json.loads(raw.strip())

    try:
        response = _create_chat_completion(
            model_name=MODEL,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.2,
            max_tokens=2500,
        )
        raw = response.choices[0].message.content.strip()
        try:
            return _parse_response(raw)
        except json.JSONDecodeError:
            retry_prompt = prompt + "\n\nCRITICAL: Return ONLY raw JSON. No backticks. No markdown."
            retry_resp = _create_chat_completion(
                model_name=MODEL,
                messages=[{"role": "user", "content": retry_prompt}],
                temperature=0.1,
                max_tokens=2500,
            )
            return _parse_response(retry_resp.choices[0].message.content.strip())
    except openai.RateLimitError:
        from fastapi import HTTPException
        raise HTTPException(status_code=429, detail="AI rate limit hit, retry in 30 seconds")
    except openai.AuthenticationError:
        from fastapi import HTTPException
        raise HTTPException(status_code=401, detail="Invalid LLM API key in .env")
    except Exception as e:
        from fastapi import HTTPException
        raise HTTPException(status_code=500, detail=f"AI generation failed: {str(e)}")
