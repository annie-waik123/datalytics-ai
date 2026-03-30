"""
Upload router — POST /upload  (CSV → JSON → MongoDB)
"""
from __future__ import annotations

from fastapi import APIRouter, Header, HTTPException, UploadFile, File
from fastapi.responses import JSONResponse

from services.ml_service import build_dataset_snapshot, load_csv, serialize_dataframe
from state.session_store import store
from database import save_dataset

router = APIRouter()


async def _handle_upload(
    file: UploadFile = File(...),
    x_session_id: str = Header(..., alias="X-Session-ID"),
):
    if not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only CSV files are supported.")

    try:
        file_bytes = await file.read()
        df = load_csv(file_bytes)
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Could not parse CSV: {e}")

    session = store.get(x_session_id)
    # Reset session state when a new file is uploaded
    session.df = df
    session.df_processed = None
    session.X_train = session.X_test = None
    session.y_train = session.y_test = None
    session.trained_models = {}
    session.model_results = None
    session.best_model = session.best_model_name = None
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

    snapshot = build_dataset_snapshot(df)

    # ── Save to MongoDB as JSON (fire-and-forget, don't block response) ──────
    try:
        json_rows = serialize_dataframe(df, limit=5000)   # up to 5000 rows stored
        await save_dataset(
            session_id=x_session_id,
            filename=file.filename,
            json_data=json_rows,
            meta={
                "rows": snapshot["rows"],
                "cols": snapshot["cols"],
                "columns": snapshot["all_columns"],
                "filename": file.filename,
            },
        )
    except Exception:
        pass  # Never block upload on DB errors

    return JSONResponse(snapshot)


@router.post("/upload")
async def upload_dataset(
    file: UploadFile = File(...),
    x_session_id: str = Header(..., alias="X-Session-ID"),
):
    return await _handle_upload(file=file, x_session_id=x_session_id)


@router.post("/upload-dataset")
async def upload_dataset_alias(
    file: UploadFile = File(...),
    x_session_id: str = Header(..., alias="X-Session-ID"),
):
    return await _handle_upload(file=file, x_session_id=x_session_id)
