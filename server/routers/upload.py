"""
Upload router - streamed and chunked dataset ingestion.
"""
from __future__ import annotations

import os

import pandas as pd
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
    except Exception as exc:
        import traceback
        print(f"[PERSIST ERROR] {traceback.format_exc()}")
        # Log error but don't fail the entire upload if database persistence fails
        pass
    finally:
        import gc
        gc.collect()


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
        import traceback
        print(f"[UPLOAD ERROR] {traceback.format_exc()}")
        raise HTTPException(status_code=422, detail=f"Could not parse file: {exc}")

    await _persist_snapshot_to_db(session_id, filename, snapshot)
    
    # Final cleanup before sending response
    import gc
    gc.collect()
    
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


@router.post("/upload/connect")
async def upload_connect(
    payload: dict = Body(...),
    x_session_id: str = Header(..., alias="X-Session-ID"),
):
    source = payload.get("source")
    host = payload.get("host")
    port = payload.get("port")
    database = payload.get("database")
    table = payload.get("table")
    username = payload.get("username")
    password = payload.get("password")
    url = payload.get("url")

    import pandas as pd
    import math

    try:
        if source in ["mysql", "postgresql", "mssql"]:
            import sqlalchemy as sa
            if source == "mysql":
                if not port: port = 3306
                conn_str = f"mysql+pymysql://{username}:{password}@{host}:{port}/{database}"
            elif source == "postgresql":
                if not port: port = 5432
                conn_str = f"postgresql+psycopg2://{username}:{password}@{host}:{port}/{database}"
            elif source == "mssql":
                if not port: port = 1433
                conn_str = f"mssql+pymssql://{username}:{password}@{host}:{port}/{database}"
            
            engine = sa.create_engine(conn_str)
            if table:
                query = f"SELECT * FROM {table} LIMIT 10000"
            else:
                insp = sa.inspect(engine)
                tables = insp.get_table_names()
                if not tables:
                    raise Exception("No tables found in database.")
                query = f"SELECT * FROM {tables[0]} LIMIT 10000"
            df = pd.read_sql(query, engine)
        
        elif source == "mongodb":
            from pymongo import MongoClient
            if not port: port = 27017
            client = MongoClient(host=host, port=int(port), username=username, password=password)
            db = client[database]
            if table:
                collection = db[table]
            else:
                collections = db.list_collection_names()
                if not collections:
                    raise Exception("No collections found.")
                collection = db[collections[0]]
            cursor = collection.find().limit(10000)
            df = pd.DataFrame(list(cursor))
            if "_id" in df.columns:
                df["_id"] = df["_id"].astype(str)

        elif source == "json":
            import requests
            res = requests.get(url)
            res.raise_for_status()
            data = res.json()
            if isinstance(data, dict) and len(data.keys()) == 1:
                data = list(data.values())[0]
            df = pd.DataFrame(data)

        elif source == "googlesheets":
            import re
            import requests
            import io
            
            match = re.search(r'/d/([a-zA-Z0-9-_]+)', url)
            if match:
                sheet_id = match.group(1)
                # Using export?format=csv is the standard way to download a google sheet
                csv_url = f"https://docs.google.com/spreadsheets/d/{sheet_id}/export?format=csv"
            elif "/edit" in url:
                csv_url = url.replace("/edit", "/export?format=csv").split("#")[0]
            else:
                csv_url = url

            try:
                # Add User-Agent to prevent 403/401 errors from Google blocking bot traffic
                res = requests.get(csv_url, headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'})
                res.raise_for_status()
                # If Google returns HTML instead of CSV, it's likely a redirect to a login page
                if "text/html" in res.headers.get("Content-Type", ""):
                    raise Exception("Failed to fetch Google Sheet. The link requires authentication. Please ensure the sheet is truly public (Anyone with link -> Viewer).")
                df = pd.read_csv(io.StringIO(res.text))
            except requests.exceptions.HTTPError as e:
                if res.status_code in [401, 403, 404]:
                    raise Exception("Failed to fetch Google Sheet. Please ensure the sheet is truly public (Anyone with link -> Viewer).")
                raise Exception(f"HTTP Error while fetching Google Sheet: {res.status_code}")
            except Exception as e:
                if "Failed to fetch Google Sheet" in str(e):
                    raise e
                raise Exception(f"Failed to parse Google Sheet as CSV. Error: {str(e)}")
        if df.empty:
            raise Exception("The imported dataset is empty.")

        df = df.replace([float('inf'), float('-inf')], None)
        df = df.where(pd.notnull(df), None)

        for col in df.columns:
            if df[col].dtype == "object":
                df[col] = df[col].astype(str)

        rows = df.to_dict(orient="records")
        columns = list(df.columns)
        
        filename = f"{source.capitalize()} - {database or str(url)[:15]}"
        
        session = store.get(x_session_id)
        _reset_session_state(session)
        
        snapshot = {
            "name": filename,
            "rows": len(rows),
            "cols": len(columns),
            "all_columns": columns,
            "columns_info": [],
            "sample_rows": rows[:2000],
            "backend_managed": True,
            "storage_mode": "memory"
        }
        
        session.dataset_name = filename
        session.dataset_path = None
        session.dataset_format = source or "connected"
        session.dataset_storage_mode = "memory"
        session.dataset_file_size = 0
        session.dataset_row_count = int(len(df))
        session.dataset_column_count = int(len(columns))
        session.dataset_columns = columns
        session.dataset_snapshot = snapshot
        session.df = df.copy()
        session.df_original = df.copy()
        session.df_processed = df
        session.feature_columns = columns
        
        await _persist_snapshot_to_db(x_session_id, filename, snapshot)
        import gc
        gc.collect()
        
        return JSONResponse(snapshot)
    
    except Exception as e:
        import traceback
        print(f"[DB CONNECT ERROR] {traceback.format_exc()}")
        raise HTTPException(status_code=400, detail=str(e))
