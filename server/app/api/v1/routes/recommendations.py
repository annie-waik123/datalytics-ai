"""
Recommendations router with optional AI generation support.
"""
from __future__ import annotations

import logging
from typing import Optional

from fastapi import APIRouter, Header, HTTPException, Query
from fastapi.responses import JSONResponse
from pydantic import BaseModel

log = logging.getLogger(__name__)

from app.state.session_store import store
from app.services.insight_generation_service import (
    build_generate_options,
    generate_mode_response_from_session,
    normalize_mode,
    resolve_context_dataframe,
)
from app.services.recommendation_service import (
    get_ai_insights,
    get_business_insights,
    get_data_quality_score,
    get_statistical_insights,
)

router = APIRouter()


class InsightGenerateRequest(BaseModel):
    mode: Optional[str] = None
    prompt: Optional[str] = None
    generate: bool = True


def _session_dataset_frame(session):
    if session.df is not None:
        return session.df
    return resolve_context_dataframe(session)


def _session_has_dataset(session) -> bool:
    return bool(
        session.df is not None
        or session.dataset_path
        or session.dataset_snapshot
        or session.dataset_columns
    )


def _recommendation_payload(session) -> dict:
    frame = _session_dataset_frame(session)
    if frame is None or frame.empty:
        raise HTTPException(status_code=404, detail="No dataset uploaded.")

    return {
        "quality_score": get_data_quality_score(frame),
        "statistical_insights": get_statistical_insights(frame),
        "business_insights": get_business_insights(frame),
    }


def _ai_insight_payload(session) -> dict:
    frame = _session_dataset_frame(session)
    if frame is None or frame.empty:
        raise HTTPException(status_code=404, detail="No dataset uploaded.")

    results = session.model_results or []
    task_type = session.task_type or "Classification"
    best_model_name = session.best_model_name or ""
    feature_columns = session.feature_columns or []

    return get_ai_insights(
        df=frame,
        results=results,
        task_type=task_type,
        best_model_name=best_model_name,
        feature_columns=feature_columns,
        best_model=session.best_model,
        X_test=session.X_test,
        y_test=session.y_test,
    )


def _payload_or_empty(session, endpoint_name: str) -> dict:
    if endpoint_name == "recommendations":
        if not _session_has_dataset(session):
            return {
                "quality_score": None,
                "statistical_insights": [],
                "business_insights": [],
            }
        return _recommendation_payload(session)

    if not _session_has_dataset(session):
        return {
            "quality_score": None,
            "statistical_insights": [],
            "model_recommendations": [],
            "business_insights": [],
            "feature_importance": [],
            "best_model_name": "",
            "best_metrics": {},
            "task_type": session.task_type or "",
            "total_models_trained": len(session.model_results or []),
        }
    return _ai_insight_payload(session)


def _build_response(
    *,
    session,
    endpoint_name: str,
    generate: bool,
    mode: Optional[str],
    prompt: Optional[str],
) -> dict:
    payload = _payload_or_empty(session, endpoint_name)
    payload["generate_options"] = build_generate_options(endpoint_name)

    if generate:
        default_mode = payload["generate_options"]["default_mode"]
        resolved_mode = normalize_mode(mode, default_mode)
        payload["generated_response"] = generate_mode_response_from_session(
            mode=resolved_mode,
            user_prompt=prompt,
            session=session,
            supporting_payload=payload,
        )

    return payload


@router.get("/recommendations")
async def recommendations(
    generate: bool = Query(False),
    mode: Optional[str] = Query(None),
    prompt: Optional[str] = Query(None),
    x_session_id: str = Header(..., alias="X-Session-ID"),
):
    session = store.get(x_session_id)
    if not _session_has_dataset(session) and not generate:
        raise HTTPException(status_code=404, detail="No dataset uploaded.")
    return JSONResponse(
        _build_response(
            session=session,
            endpoint_name="recommendations",
            generate=generate,
            mode=mode,
            prompt=prompt,
        )
    )


@router.post("/recommendations/generate")
async def recommendations_generate(
    body: InsightGenerateRequest,
    x_session_id: str = Header(..., alias="X-Session-ID"),
):
    session = store.get(x_session_id)
    try:
        result = _build_response(
            session=session,
            endpoint_name="recommendations",
            generate=body.generate,
            mode=body.mode,
            prompt=body.prompt,
        )
    except HTTPException:
        raise
    except Exception as exc:
        log.error("recommendations_generate: error: %s", exc)
        result = {
            "error": "Recommendations generation failed. Please retry.",
            "generated_response": {"content": "Unable to generate recommendations at this time. Please try again.", "mode": "recommendation_insights", "source": "error"},
        }
    return JSONResponse(result)


@router.get("/ai-insights")
async def ai_insights(
    generate: bool = Query(False),
    mode: Optional[str] = Query(None),
    prompt: Optional[str] = Query(None),
    x_session_id: str = Header(..., alias="X-Session-ID"),
):
    session = store.get(x_session_id)
    if not _session_has_dataset(session) and not generate:
        raise HTTPException(status_code=404, detail="No dataset uploaded.")
    return JSONResponse(
        _build_response(
            session=session,
            endpoint_name="ai-insights",
            generate=generate,
            mode=mode,
            prompt=prompt,
        )
    )


@router.post("/ai-insights/generate")
async def ai_insights_generate(
    body: InsightGenerateRequest,
    x_session_id: str = Header(..., alias="X-Session-ID"),
):
    session = store.get(x_session_id)
    try:
        result = _build_response(
            session=session,
            endpoint_name="ai-insights",
            generate=body.generate,
            mode=body.mode,
            prompt=body.prompt,
        )
    except HTTPException:
        raise
    except Exception as exc:
        log.error("ai_insights_generate: error: %s", exc)
        result = {
            "error": "AI Insights generation failed. Please retry.",
            "generated_response": {"content": "Unable to generate AI insights at this time. Please try again.", "mode": "ai_insights", "source": "error"},
        }
    return JSONResponse(result)
