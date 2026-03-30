from __future__ import annotations

from fastapi import APIRouter, Header, HTTPException, Query
from fastapi.responses import JSONResponse

from models.schemas import VisualizationRequest
from services.ml_service import build_dataset_snapshot, create_visualization, explore_dataset
from state.session_store import store

router = APIRouter()


@router.get("/get-data")
async def get_data(
    x_session_id: str = Header(..., alias="X-Session-ID"),
):
    session = store.get(x_session_id)
    if session.df is None:
        raise HTTPException(status_code=404, detail="No dataset uploaded. Please upload a CSV first.")
    return JSONResponse(build_dataset_snapshot(session.df))


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
        payload = create_visualization(
            session.df,
            viz_type=body.viz_type,
            selected_columns=body.selected_columns,
            color_column=body.color_column,
            x_column=body.x_column,
            y_column=body.y_column,
            column=body.column,
            bins=body.bins,
            group_column=body.group_column,
        )
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"Visualization failed: {exc}")
    return JSONResponse(payload)
