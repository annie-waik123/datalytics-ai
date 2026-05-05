from __future__ import annotations

import io

from fastapi import APIRouter, Header, HTTPException
from fastapi.responses import HTMLResponse, JSONResponse, StreamingResponse

from app.models.schemas import EDAActionRequest, EDAChartRequest, EDASyncRequest
from app.services.dataset_service import store_dataframe_in_session
from app.services.eda_service import (
    apply_eda_action,
    build_dataset_payload,
    build_eda_report_html,
    build_eda_summary,
    create_eda_chart,
    dataframe_from_payload,
)
from app.state.session_store import store

router = APIRouter()


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
    session.preprocessing_done = False
    session.supervised_done = False
    session.unsupervised_done = False
    session.prediction_history = []


def _require_dataset(session):
    if session.df is None:
        raise HTTPException(status_code=404, detail="No dataset is available for EDA. Upload or sync a dataset first.")


@router.get("/eda/summary")
async def eda_summary(
    x_session_id: str = Header(..., alias="X-Session-ID"),
):
    session = store.get(x_session_id)
    _require_dataset(session)
    return JSONResponse(build_eda_summary(session.df))


@router.post("/eda/sync")
async def eda_sync(
    body: EDASyncRequest,
    x_session_id: str = Header(..., alias="X-Session-ID"),
):
    if not body.rows and not body.columns:
        raise HTTPException(status_code=422, detail="Sync payload is empty.")

    try:
        df = dataframe_from_payload(body.rows, body.columns)
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"Could not sync dataset: {exc}")

    session = store.get(x_session_id)
    session.dataset_name = body.name or session.dataset_name or "Dataset"
    store_dataframe_in_session(session, df, name=session.dataset_name, session_id=x_session_id)
    _reset_downstream_state(session)

    return JSONResponse(
        {
            "message": "Dataset synced to the EDA backend session.",
            "dataset": build_dataset_payload(session.df, session.dataset_name or "Dataset"),
            "summary": build_eda_summary(session.df),
        }
    )


@router.post("/eda/action")
async def eda_action(
    body: EDAActionRequest,
    x_session_id: str = Header(..., alias="X-Session-ID"),
):
    session = store.get(x_session_id)
    _require_dataset(session)

    try:
        result = apply_eda_action(
            session.df,
            body.action,
            body.options or {},
            df_original=session.df_original,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"EDA action failed: {exc}")

    store_dataframe_in_session(
        session,
        result["df"],
        name=session.dataset_name or "Dataset",
        session_id=x_session_id,
    )
    _reset_downstream_state(session)

    return JSONResponse(
        {
            "message": result["message"],
            "changed_count": result.get("changed_count", 0),
            "dataset": build_dataset_payload(session.df, session.dataset_name or "Dataset"),
            "summary": build_eda_summary(session.df),
        }
    )


@router.post("/eda/chart")
async def eda_chart(
    body: EDAChartRequest,
    x_session_id: str = Header(..., alias="X-Session-ID"),
):
    session = store.get(x_session_id)
    _require_dataset(session)

    try:
        payload = create_eda_chart(
            session.df,
            chart_type=body.chart_type,
            x_column=body.x_column,
            y_column=body.y_column,
            color_column=body.color_column,
            z_column=body.z_column,
            bins=body.bins,
            aggregation=body.aggregation,
            rolling_window=body.rolling_window,
            theme=body.theme,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Could not build EDA chart: {exc}")

    return JSONResponse(payload)


@router.get("/eda/report/json")
async def eda_report_json(
    x_session_id: str = Header(..., alias="X-Session-ID"),
):
    session = store.get(x_session_id)
    _require_dataset(session)
    return JSONResponse(build_eda_summary(session.df))


@router.get("/eda/report/html")
async def eda_report_html(
    x_session_id: str = Header(..., alias="X-Session-ID"),
):
    session = store.get(x_session_id)
    _require_dataset(session)
    return HTMLResponse(content=build_eda_report_html(session.df), media_type="text/html")


@router.get("/eda/download-csv")
async def eda_download_csv(
    x_session_id: str = Header(..., alias="X-Session-ID"),
):
    session = store.get(x_session_id)
    _require_dataset(session)

    buffer = io.StringIO()
    session.df.to_csv(buffer, index=False)
    buffer.seek(0)

    filename = (session.dataset_name or "eda_dataset").rsplit(".", 1)[0] + "_cleaned.csv"
    return StreamingResponse(
        iter([buffer.getvalue().encode("utf-8")]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
