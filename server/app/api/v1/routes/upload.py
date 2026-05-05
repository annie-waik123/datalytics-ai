"""
Upload router - streamed and chunked dataset ingestion.
"""
from __future__ import annotations

import os

import pandas as pd
from fastapi import APIRouter, Body, File, Form, Header, HTTPException, UploadFile
from fastapi.responses import JSONResponse

from app.core.database import save_dataset
from app.services.dataset_service import (
    ALLOWED_EXTENSIONS,
    append_chunk,
    create_session_upload_path,
    finalize_chunked_upload,
    prepare_uploaded_dataset,
    start_chunked_upload,
    stream_upload_to_path,
)
from app.state.session_store import store

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


import re
import io
import requests

def fetch_google_sheet(sheet_url: str, sheet_name: str = "") -> pd.DataFrame:
    # Extract Sheet ID
    match = re.search(r'/spreadsheets/d/([a-zA-Z0-9-_]+)', sheet_url)
    if not match:
        raise HTTPException(400, "Invalid Google Sheets URL. Could not extract Sheet ID.")
    
    sheet_id = match.group(1)
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "text/csv,application/csv,text/plain,*/*"
    }
    errors = []

    # Strategy 1: /export?format=csv
    try:
        url = f"https://docs.google.com/spreadsheets/d/{sheet_id}/export?format=csv&gid=0"
        r = requests.get(url, headers=headers, timeout=15, allow_redirects=True)
        if r.status_code == 200 and 'text/html' not in r.headers.get('Content-Type', ''):
            df = pd.read_csv(io.StringIO(r.text))
            if not df.empty:
                return df
    except Exception as e:
        errors.append(f"Strategy 1 failed: {str(e)}")

    # Strategy 2: gviz/tq
    try:
        base = f"https://docs.google.com/spreadsheets/d/{sheet_id}/gviz/tq?tqx=out:csv"
        url = f"{base}&sheet={sheet_name}" if sheet_name else base
        r = requests.get(url, headers=headers, timeout=15, allow_redirects=True)
        if r.status_code == 200 and 'text/html' not in r.headers.get('Content-Type', ''):
            df = pd.read_csv(io.StringIO(r.text))
            if not df.empty:
                return df
    except Exception as e:
        errors.append(f"Strategy 2 failed: {str(e)}")

    # Strategy 3: gspread anonymous
    try:
        import gspread
        gc = gspread.Client(auth=None)
        gc.session = requests.Session()
        sh = gc.open_by_key(sheet_id)
        ws = sh.worksheet(sheet_name) if sheet_name else sh.sheet1
        df = pd.DataFrame(ws.get_all_records())
        if not df.empty:
            return df
    except Exception as e:
        errors.append(f"Strategy 3 failed: {str(e)}")

    # All failed
    raise HTTPException(400, 
        f"Failed to fetch Google Sheet. Ensure sheet is public "
        f"(Anyone with link → Viewer). Errors: {'; '.join(errors)}"
    )

def smart_json_to_df(data):
    from pandas import json_normalize
    if isinstance(data, list):
        if len(data) == 0:
            raise ValueError("Empty array returned")
        return json_normalize(data, sep='_')

    if isinstance(data, dict):
        common_keys = ['data', 'results', 'items', 'records', 
                       'rows', 'list', 'content', 'payload',
                       'response', 'output', 'dataset']
        for key in common_keys:
            if key in data and isinstance(data[key], list):
                return json_normalize(data[key], sep='_')
        
        for key, value in data.items():
            if isinstance(value, list) and len(value) > 0:
                return json_normalize(value, sep='_')
        
        for key, value in data.items():
            if isinstance(value, dict):
                for nested_key, nested_val in value.items():
                    if isinstance(nested_val, list) and len(nested_val) > 0:
                        return json_normalize(nested_val, sep='_')
        
        return json_normalize([data], sep='_')

    raise ValueError(f"Unsupported JSON format: {type(data)}")

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
        

        elif source == "json":
            import requests
            res = requests.get(url, headers={"User-Agent": "Mozilla/5.0", "Accept": "application/json"}, timeout=15)
            res.raise_for_status()
            data = res.json()
            df = smart_json_to_df(data)
            df.columns = [str(col).replace('.', '_').strip() for col in df.columns]

        elif source == "googlesheets":
            # Call the new multi-strategy fetch function
            df = fetch_google_sheet(url, sheet_name=table or "")
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
