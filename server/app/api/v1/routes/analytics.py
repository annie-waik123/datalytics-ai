"""
Natural-language analytics router (Feature 2).

POST /api/analytics/interpret   → show what the system understood (no execution)
POST /api/analytics/query       → interpret + validate + execute, return charts/tables/metrics
GET  /api/analytics/capabilities → supported operations & example prompts (drives UI)

Safety: the interpretation layer only returns intents that reference real columns
from the session dataset. Execution uses whitelisted operations only.
"""
from __future__ import annotations

import logging

from fastapi import APIRouter, Header, HTTPException
from fastapi.responses import JSONResponse

from app.models.schemas import NLInterpretRequest, NLInterpretResponse, NLQueryRequest, NLQueryResponse
from app.services.data_engine_service import ensure_live_dataset
from app.services.nl_analytics_service import handle_nl_query, interpret_only
from app.state.session_store import store

log = logging.getLogger(__name__)
router = APIRouter()

EXAMPLE_PROMPTS = [
    "Show monthly sales.",
    "Compare revenue by region.",
    "Which product has the highest growth?",
    "Plot age against income.",
    "Show me the top 10 categories by revenue.",
    "When did sales start declining?",
    "What is the correlation between two numeric columns?",
    "Which columns contain missing values?",
]

CAPABILITIES = {
    "operations": [
        {"id": "groupby", "label": "Break down by a category", "example": "Show revenue by region"},
        {"id": "top", "label": "Rank groups", "example": "Top 10 products by revenue"},
        {"id": "compare", "label": "Compare groups", "example": "Compare sales across segments"},
        {"id": "time_series", "label": "Trend over time", "example": "Show monthly sales"},
        {"id": "trend_break", "label": "Find when a trend changed", "example": "When did sales start declining?"},
        {"id": "scatter", "label": "Two numeric fields", "example": "Plot age against income"},
        {"id": "correlation", "label": "Correlations", "example": "Which features are correlated?"},
        {"id": "distribution", "label": "Distribution of a metric", "example": "Show the distribution of revenue"},
        {"id": "missing", "label": "Missing values", "example": "Which columns have missing values?"},
        {"id": "filter", "label": "Filter rows", "example": "Show orders where status = Shipped"},
    ],
    "aggregations": ["sum", "avg", "min", "max", "count"],
    "visualizations": ["auto", "bar", "line", "pie", "scatter", "histogram", "heatmap", "table"],
    "example_prompts": EXAMPLE_PROMPTS,
}


async def _prepare_session(x_session_id: str):
    session = store.get(x_session_id)
    ready = await ensure_live_dataset(session, x_session_id)
    if not ready:
        raise HTTPException(
            status_code=404,
            detail="No dataset is loaded. Upload a dataset first, then ask Datalytics anything about it.",
        )
    return session


@router.get("/analytics/capabilities")
async def analytics_capabilities():
    return JSONResponse(CAPABILITIES)


@router.post("/analytics/interpret", response_model=NLInterpretResponse)
async def analytics_interpret(
    body: NLInterpretRequest,
    x_session_id: str = Header(..., alias="X-Session-ID"),
):
    query = str(body.query or "").strip()
    if not query:
        raise HTTPException(status_code=400, detail="Query cannot be empty.")
    session = await _prepare_session(x_session_id)
    try:
        payload = interpret_only(session, x_session_id, query)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except Exception as exc:
        log.error("analytics_interpret: %s", exc)
        raise HTTPException(status_code=500, detail=f"Interpretation failed: {exc}")
    return JSONResponse(payload)


@router.post("/analytics/query", response_model=NLQueryResponse)
async def analytics_query(
    body: NLQueryRequest,
    x_session_id: str = Header(..., alias="X-Session-ID"),
):
    query = str(body.query or "").strip()
    if not query:
        raise HTTPException(status_code=400, detail="Query cannot be empty.")
    session = await _prepare_session(x_session_id)
    try:
        payload = handle_nl_query(
            session,
            x_session_id,
            query,
            mode=body.mode or "auto",
            include_explanation=body.include_explanation,
        )
    except ValueError as exc:
        message = str(exc)
        status_code = 422 if "empty" in message.lower() else 404
        raise HTTPException(status_code=status_code, detail=message)
    except Exception as exc:
        log.error("analytics_query: %s", exc)
        raise HTTPException(status_code=500, detail=f"Query execution failed: {exc}")
    return JSONResponse(payload)
