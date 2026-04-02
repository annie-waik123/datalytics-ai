"""
Upload router - streamed and chunked dataset ingestion.
"""
from __future__ import annotations

import os

from fastapi import APIRouter, Body, File, Form, Header, HTTPException, UploadFile
from fastapi.responses import JSONResponse

from database import save_dataset
from services.dataset_service import (
    ALLOWED_EXTENSIONS,
    append_chunk,
    create_session_upload_path,
    finalize_chunked_upload,
    prepare_uploaded_dataset,
    start_chunked_upload,
    stream_upload_to_path,
)
from state.session_store import store

router = APIRouter()


def _reset_session_state(session) -> None:
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
    session.dashboard_builder = {}
    session.preprocessing_done = False
    session.supervised_done = False
    session.unsupervised_done = False
    session.prediction_history = []


async def _persist_snapshot_to_db(session_id: str, filename: str, snapshot: dict) -> None:
    try:
        await save_dataset(
            session_id=session_id,
            filename=filename,
            json_data=snapshot.get("sample_rows", []),
            meta={
                "rows": snapshot.get("rows", 0),
                "cols": snapshot.get("cols", 0),
                "columns": snapshot.get("all_columns", []),
                "columns_info": snapshot.get("columns_info", []),
                "filename": filename,
                "storage_mode": snapshot.get("storage_mode", "memory"),
            },
        )
    except Exception:
        pass


async def _handle_uploaded_file(
    *,
    session_id: str,
    filename: str,
    source_path,
    file_size: int,
):
    ext = os.path.splitext(filename or "")[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Only CSV, Excel, or JSON files are supported.")

    session = store.get(session_id)
    _reset_session_state(session)

    try:
        snapshot = prepare_uploaded_dataset(
            session=session,
            session_id=session_id,
            filename=filename or "Dataset",
            source_path=source_path,
            file_size=file_size,
        )
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"Could not parse file: {exc}")

    await _persist_snapshot_to_db(session_id, filename, snapshot)
    return JSONResponse(snapshot)


@router.post("/upload")
async def upload_dataset(
    file: UploadFile = File(...),
    x_session_id: str = Header(..., alias="X-Session-ID"),
):
    filename = file.filename or "dataset"
    ext = os.path.splitext(filename)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Only CSV, Excel, or JSON files are supported.")

    target_path = create_session_upload_path(x_session_id, filename)
    file_size = await stream_upload_to_path(file, target_path)
    return await _handle_uploaded_file(
        session_id=x_session_id,
        filename=filename,
        source_path=target_path,
        file_size=file_size,
    )


@router.post("/upload-dataset")
async def upload_dataset_alias(
    file: UploadFile = File(...),
    x_session_id: str = Header(..., alias="X-Session-ID"),
):
    return await upload_dataset(file=file, x_session_id=x_session_id)


@router.post("/upload/init")
async def upload_init(
    payload: dict = Body(...),
    x_session_id: str = Header(..., alias="X-Session-ID"),
):
    filename = str(payload.get("filename") or "dataset")
    total_size = int(payload.get("total_size") or 0)
    content_type = payload.get("content_type")
    chunk_size = int(payload.get("chunk_size") or (5 * 1024 * 1024))

    try:
        manifest = start_chunked_upload(
            session_id=x_session_id,
            filename=filename,
            total_size=total_size,
            content_type=content_type,
            chunk_size=chunk_size,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    return JSONResponse(manifest)


@router.post("/upload/chunk/{upload_id}")
async def upload_chunk(
    upload_id: str,
    chunk: UploadFile = File(...),
    index: int = Form(...),
    total_chunks: int = Form(...),
    x_session_id: str = Header(..., alias="X-Session-ID"),
):
    try:
        payload = append_chunk(
            upload_id=upload_id,
            index=index,
            total_chunks=total_chunks,
            chunk_bytes=await chunk.read(),
        )
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"Could not store upload chunk: {exc}")

    return JSONResponse(
        {
            **payload,
            "session_id": x_session_id,
        }
    )


@router.post("/upload/complete/{upload_id}")
async def upload_complete(
    upload_id: str,
    x_session_id: str = Header(..., alias="X-Session-ID"),
):
    session = store.get(x_session_id)
    _reset_session_state(session)

    try:
        source_path, snapshot = finalize_chunked_upload(upload_id, session=session, session_id=x_session_id)
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"Could not finalize upload: {exc}")

    await _persist_snapshot_to_db(x_session_id, session.dataset_name or source_path.name, snapshot)
    return JSONResponse(snapshot)
