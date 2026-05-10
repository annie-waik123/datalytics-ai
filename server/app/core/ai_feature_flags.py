"""
ai_feature_flags.py
Utility to check if AI features are enabled/disabled via admin kill switch.
"""
from __future__ import annotations

from fastapi import HTTPException
from app.core.database import get_db

DEFAULT_FLAGS = {
    "chatbot": True,
    "recommendations": True,
    "decision_making": True,
    "ai_insights": True,
}

DISABLED_MESSAGE = "This feature is currently disabled by the administrator."


async def get_ai_flags() -> dict:
    """Fetch current AI feature flags from MongoDB."""
    try:
        db = get_db()
        doc = await db.admin_settings.find_one({"_id": "ai_features"})
        if not doc:
            return DEFAULT_FLAGS
        return {k: doc.get(k, True) for k in DEFAULT_FLAGS}
    except Exception:
        # If DB is unavailable, default to all enabled
        return DEFAULT_FLAGS


async def require_ai_feature(feature: str) -> None:
    """
    Raises HTTP 503 if the given AI feature is disabled by admin.
    Use this as a guard at the start of AI-dependent endpoints.

    Usage:
        await require_ai_feature("chatbot")
    """
    flags = await get_ai_flags()
    if not flags.get(feature, True):
        raise HTTPException(
            status_code=503,
            detail=DISABLED_MESSAGE,
        )
