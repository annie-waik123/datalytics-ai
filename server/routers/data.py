from __future__ import annotations

import hashlib
import json

from fastapi import APIRouter, Header, HTTPException, Query
from fastapi.responses import JSONResponse

from database import get_dataset
from models.schemas import (
    DashboardSaveRequest,
    DashboardSuggestRequest,
    DashboardWidgetRequest,
    VisualizationBatchRequest,
    VisualizationRequest,
    VisualizationSyncRequest,
)
from services.analytics_service import dataset_signature, load_analysis_frame
from services.cache_service import cache
from services.data_engine_service import build_dataset_json_payload, has_live_dataset, restore_live_dataset
from services.ml_service import build_dataset_snapshot, explore_dataset
from services.dataset_service import page_dataset, store_dataframe_in_session
from services.dashboard_service import build_dashboard_metadata, render_dashboard_widget, suggest_dashboard_widget
from services.visualization_service import (
    build_visualization_metadata,
    render_visualization_batch,
    render_visualization_chart,
    sync_visualization_dataset,
)
from state.session_store import store

router = APIRouter()


def _dashboard_cache_key(session_id: str, session, scope: str, payload: dict | None = None) -> str:
    version = dataset_signature(session)
    if not payload:
        return f"dashboard:{session_id}:{scope}:{version}"
    token = hashlib.sha1(json.dumps(payload, sort_keys=True, default=str).encode("utf-8")).hexdigest()[:16]
    return f"dashboard:{session_id}:{scope}:{version}:{token}"


def _dashboard_columns(payload: dict) -> list[str] | None:
    mapping = payload.get("mapping") or {}
    columns = []
    for key in ("x_axis", "y_axis", "legend", "size", "color", "details"):
        value = mapping.get(key)
        if value:
            columns.append(str(value))
    for key in ("values", "tooltip", "rows", "columns"):
        columns.extend(str(value) for value in mapping.get(key, []) if value)
    columns.extend(str(item.get("column")) for item in payload.get("filters", []) if item.get("column"))
    if payload.get("drill_column"):
        columns.append(str(payload["drill_column"]))
    deduped = []
    for column in columns:
        if column and column not in deduped:
            deduped.append(column)
    return deduped or None


def _reset_downstream_state(session) -> None:
    session.df_processed = None
    session.target_col = None
    session.task_type = None
    session.X_train = None
    session.X_test = None
    session.y_train = None
    session.y_test = None
    session.trained_models = {}
    session.model_results = None
    session.best_model_name = None
    session.best_model = None
    session.cluster_results = None
    session.cluster_pca_data = None
    session.feature_columns = None
    session.scaler = None
    session.label_encoders = {}
    session.preprocess_meta = {}
    session.training_meta = {}
    session.cluster_meta = {}
    session.dashboard_builder = {}
    session.preprocessing_done = False
    session.supervised_done = False
    session.unsupervised_done = False
    session.prediction_history = []


@router.get("/get-data")
async def get_data(
    x_session_id: str = Header(..., alias="X-Session-ID"),
):
    session = store.get(x_session_id)
    if session.df is None and not session.dataset_snapshot:
        raise HTTPException(status_code=404, detail="No dataset uploaded. Please upload a CSV first.")
    return JSONResponse(session.dataset_snapshot or build_dataset_snapshot(session.df))


@router.get("/dataset/json")
async def dataset_json(
    limit: int = Query(default=5_000, ge=1, le=50_000),
    x_session_id: str = Header(..., alias="X-Session-ID"),
):
    session = store.get(x_session_id)
    if not has_live_dataset(session):
        document = await get_dataset(x_session_id)
        if document is not None:
            restore_live_dataset(session, x_session_id, document)
    if not has_live_dataset(session):
        raise HTTPException(status_code=404, detail="No dataset uploaded. Please upload a dataset first.")
    return JSONResponse(build_dataset_json_payload(session, row_limit=limit))


@router.get("/dataset/page")
async def dataset_page(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=500),
    x_session_id: str = Header(..., alias="X-Session-ID"),
):
    session = store.get(x_session_id)
    if session.df is None and not session.dataset_snapshot:
        raise HTTPException(status_code=404, detail="No dataset uploaded. Please upload a dataset first.")
    return JSONResponse(page_dataset(session=session, session_id=x_session_id, page=page, page_size=page_size))


@router.get("/explore-data")
async def explore_data(
    categorical_column: str | None = Query(default=None),
    target_column: str | None = Query(default=None),
    x_session_id: str = Header(..., alias="X-Session-ID"),
):
    session = store.get(x_session_id)
    if session.df is None:
        raise HTTPException(status_code=404, detail="No dataset uploaded. Please upload a CSV first.")
    try:
        payload = explore_dataset(
            session.df,
            categorical_column=categorical_column,
            target_column=target_column,
        )
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"Exploration failed: {exc}")
    return JSONResponse(payload)


@router.post("/visualize")
async def visualize(
    body: VisualizationRequest,
    x_session_id: str = Header(..., alias="X-Session-ID"),
):
    session = store.get(x_session_id)
    if session.df is None:
        raise HTTPException(status_code=404, detail="No dataset uploaded. Please upload a CSV first.")
    try:
        payload = render_visualization_chart(session.df, body.model_dump())
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"Visualization failed: {exc}")
    return JSONResponse(payload)


@router.post("/visualization/sync")
async def visualization_sync(
    body: VisualizationSyncRequest,
    x_session_id: str = Header(..., alias="X-Session-ID"),
):
    if not body.rows and not body.columns:
        raise HTTPException(status_code=422, detail="Sync payload is empty.")

    try:
        frame, payload = sync_visualization_dataset(body.rows, body.columns, body.name)
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"Could not sync dataset: {exc}")

    session = store.get(x_session_id)
    session.dataset_name = body.name or session.dataset_name or "Dataset"
    store_dataframe_in_session(session, frame, name=session.dataset_name, session_id=x_session_id)
    _reset_downstream_state(session)

    return JSONResponse(
        {
            "message": "Dataset synced to the visualization workspace.",
            **payload,
            "metadata": build_visualization_metadata(session.df),
        }
    )


@router.post("/data/sync")
async def data_sync(
    body: VisualizationSyncRequest,
    x_session_id: str = Header(..., alias="X-Session-ID"),
):
    return await visualization_sync(body=body, x_session_id=x_session_id)


@router.get("/visualization/metadata")
async def visualization_metadata(
    x_session_id: str = Header(..., alias="X-Session-ID"),
):
    session = store.get(x_session_id)
    if session.df is None:
        raise HTTPException(status_code=404, detail="No dataset uploaded. Please upload or sync a dataset first.")
    return JSONResponse(build_visualization_metadata(session.df))


@router.post("/visualization/chart")
async def visualization_chart(
    body: VisualizationRequest,
    x_session_id: str = Header(..., alias="X-Session-ID"),
):
    session = store.get(x_session_id)
    if session.df is None:
        raise HTTPException(status_code=404, detail="No dataset uploaded. Please upload or sync a dataset first.")
    try:
        payload = render_visualization_chart(session.df, body.model_dump())
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"Visualization failed: {exc}")
    return JSONResponse(payload)


@router.post("/visualization/batch")
async def visualization_batch(
    body: VisualizationBatchRequest,
    x_session_id: str = Header(..., alias="X-Session-ID"),
):
    session = store.get(x_session_id)
    if session.df is None:
        raise HTTPException(status_code=404, detail="No dataset uploaded. Please upload or sync a dataset first.")
    try:
        payload = render_visualization_batch(session.df, [chart.model_dump() for chart in body.charts])
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"Visualization batch failed: {exc}")
    return JSONResponse(payload)


@router.post("/visualization/geo")
async def visualization_geo(
    body: dict,
    x_session_id: str = Header(..., alias="X-Session-ID"),
):
    from services.geo_visualization_service import render_geo_map
    session = store.get(x_session_id)
    if session.df is None:
        raise HTTPException(status_code=404, detail="No dataset uploaded.")
    try:
        payload = render_geo_map(session.df, body)
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"Geo map failed: {exc}")
    return JSONResponse(payload)


@router.get("/dashboard/metadata")
async def dashboard_metadata(
    x_session_id: str = Header(..., alias="X-Session-ID"),
):
    session = store.get(x_session_id)
    if session.df is None:
        raise HTTPException(status_code=404, detail="No dataset uploaded. Please upload or sync a dataset first.")
    cache_key = _dashboard_cache_key(x_session_id, session, "metadata")
    cached = cache.get_json(cache_key)
    if cached is not None:
        return JSONResponse(cached)
    payload = build_dashboard_metadata(load_analysis_frame(session, sample_size=8_000))
    cache.set_json(cache_key, payload, ttl_seconds=300)
    return JSONResponse(payload)


@router.post("/dashboard/suggest")
async def dashboard_suggest(
    body: DashboardSuggestRequest,
    x_session_id: str = Header(..., alias="X-Session-ID"),
):
    session = store.get(x_session_id)
    if session.df is None:
        raise HTTPException(status_code=404, detail="No dataset uploaded. Please upload or sync a dataset first.")
    try:
        raw_payload = body.model_dump()
        cache_key = _dashboard_cache_key(x_session_id, session, "suggest", raw_payload)
        cached = cache.get_json(cache_key)
        if cached is not None:
            return JSONResponse(cached)
        frame = load_analysis_frame(session, columns=raw_payload.get("selected_columns") or None, sample_size=6_000)
        payload = suggest_dashboard_widget(frame, raw_payload)
        cache.set_json(cache_key, payload, ttl_seconds=300)
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"Dashboard suggestion failed: {exc}")
    return JSONResponse(payload)


@router.post("/dashboard/render")
async def dashboard_render(
    body: DashboardWidgetRequest,
    x_session_id: str = Header(..., alias="X-Session-ID"),
):
    session = store.get(x_session_id)
    if session.df is None:
        raise HTTPException(status_code=404, detail="No dataset uploaded. Please upload or sync a dataset first.")
    try:
        raw_payload = body.model_dump()
        cache_key = _dashboard_cache_key(x_session_id, session, "render", raw_payload)
        cached = cache.get_json(cache_key)
        if cached is not None:
            return JSONResponse(cached)
        frame = load_analysis_frame(
            session,
            columns=_dashboard_columns(raw_payload),
            filters=raw_payload.get("filters") or None,
            sample_size=12_000,
        )
        payload = render_dashboard_widget(frame, raw_payload)
        cache.set_json(cache_key, payload, ttl_seconds=300)
    except Exception as exc:
        log.exception(f"Dashboard render failed for widget {raw_payload.get('widget_id')}")
        raise HTTPException(status_code=422, detail=f"Dashboard render failed: {exc}")
    return JSONResponse(payload)


@router.post("/dashboard/save")
async def dashboard_save(
    body: DashboardSaveRequest,
    x_session_id: str = Header(..., alias="X-Session-ID"),
):
    session = store.get(x_session_id)
    session.dashboard_builder = body.model_dump()
    return JSONResponse({"message": "Dashboard saved successfully.", "dashboard": session.dashboard_builder})


@router.get("/dashboard/load")
async def dashboard_load(
    x_session_id: str = Header(..., alias="X-Session-ID"),
):
    session = store.get(x_session_id)
    return JSONResponse({"dashboard": session.dashboard_builder or {}})
