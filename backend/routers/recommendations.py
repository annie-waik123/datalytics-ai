"""
Recommendations router — GET /api/recommendations & /api/ai-insights
"""
from __future__ import annotations

from fastapi import APIRouter, Header, HTTPException
from fastapi.responses import JSONResponse

from state.session_store import store
from services.recommendation_service import (
    get_data_quality_score,
    get_statistical_insights,
    get_business_insights,
    get_ai_insights,
)

router = APIRouter()


@router.get("/recommendations")
async def recommendations(
    x_session_id: str = Header(..., alias="X-Session-ID"),
):
    session = store.get(x_session_id)
    if session.df is None:
        raise HTTPException(status_code=404, detail="No dataset uploaded.")

    quality = get_data_quality_score(session.df)
    stat_insights = get_statistical_insights(session.df)
    biz_insights = get_business_insights(session.df)

    return JSONResponse({
        "quality_score": quality,
        "statistical_insights": stat_insights,
        "business_insights": biz_insights,
    })


@router.get("/ai-insights")
async def ai_insights(
    x_session_id: str = Header(..., alias="X-Session-ID"),
):
    session = store.get(x_session_id)
    if session.df is None:
        raise HTTPException(status_code=404, detail="No dataset uploaded.")

    results = session.model_results or []
    task_type = session.task_type or "Classification"
    best_model_name = session.best_model_name or ""
    feature_columns = session.feature_columns or []

    payload = get_ai_insights(
        df=session.df,
        results=results,
        task_type=task_type,
        best_model_name=best_model_name,
        feature_columns=feature_columns,
        best_model=session.best_model,
        X_test=session.X_test,
        y_test=session.y_test,
    )

    return JSONResponse(payload)
