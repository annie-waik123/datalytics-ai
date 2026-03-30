"""
Preprocessing router — POST /preprocess
"""
from __future__ import annotations

import pandas as pd
from fastapi import APIRouter, Header, HTTPException
from fastapi.responses import JSONResponse

from models.schemas import PreprocessRequest
from services.ml_service import preprocess
from state.session_store import store

router = APIRouter()


async def _run_preprocess(
    body: PreprocessRequest,
    x_session_id: str = Header(..., alias="X-Session-ID"),
):
    session = store.get(x_session_id)

    if session.df is None:
        raise HTTPException(status_code=400, detail="No dataset uploaded. Please upload a CSV first.")

    try:
        result = preprocess(
            df=session.df,
            target_col=body.target_col,
            task_type=body.task_type,
            missing_strategy=body.missing_strategy,
            encode_method=body.encode_method,
            scaling_method=body.scaling_method,
            test_size=body.test_size,
            random_state=body.random_state,
        )
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Preprocessing failed: {e}")

    # Store in session
    session.target_col = body.target_col
    session.task_type = body.task_type
    session.df_processed = result["df_processed"]
    session.feature_columns = result["feature_columns"]
    session.X_train = result["X_train"]
    session.X_test = result["X_test"]
    session.y_train = result["y_train"]
    session.y_test = result["y_test"]
    session.scaler = result["scaler"]
    session.label_encoders = result["label_encoders"]
    session.preprocess_meta = {
        "sampled": result["sampled"],
        "sample_size": result["sample_size"],
        "large_dataset_mode": result["large_dataset_mode"],
    }
    session.training_meta = {}
    session.cluster_meta = {}
    session.preprocessing_done = True
    # Reset downstream state
    session.trained_models = {}
    session.model_results = None
    session.best_model = session.best_model_name = None
    session.cluster_results = None
    session.cluster_pca_data = None
    session.supervised_done = False
    session.unsupervised_done = False
    session.prediction_history = []

    # Preview of processed data
    prev_df = result["df_processed"].head(10).copy()
    for col in prev_df.select_dtypes(include="category").columns:
        prev_df[col] = prev_df[col].astype(str)
    processed_preview = prev_df.where(pd.notnull(prev_df), None).to_dict(orient="records")

    return JSONResponse({
        "total_size": len(result["df_processed"]),
        "train_size": len(result["X_train"]),
        "test_size": len(result["X_test"]),
        "feature_columns": result["feature_columns"],
        "sampled": result["sampled"],
        "sample_size": result["sample_size"],
        "processed_preview": processed_preview,
        "encoding_warnings": result["encoding_warnings"],
        "target_col": body.target_col,
        "task_type": body.task_type,
        "large_dataset_mode": result["large_dataset_mode"],
    })


@router.post("/preprocess")
async def run_preprocess(
    body: PreprocessRequest,
    x_session_id: str = Header(..., alias="X-Session-ID"),
):
    return await _run_preprocess(body=body, x_session_id=x_session_id)


@router.post("/preprocess-data")
async def run_preprocess_alias(
    body: PreprocessRequest,
    x_session_id: str = Header(..., alias="X-Session-ID"),
):
    return await _run_preprocess(body=body, x_session_id=x_session_id)


@router.get("/preprocess-summary")
async def preprocess_summary(
    x_session_id: str = Header(..., alias="X-Session-ID"),
):
    session = store.get(x_session_id)
    if not session.preprocessing_done or session.df_processed is None:
        raise HTTPException(status_code=404, detail="Preprocessing has not been completed yet.")

    prev_df = session.df_processed.head(10).copy()
    for col in prev_df.select_dtypes(include="category").columns:
        prev_df[col] = prev_df[col].astype(str)
    processed_preview = prev_df.where(pd.notnull(prev_df), None).to_dict(orient="records")

    return JSONResponse({
        "total_size": len(session.df_processed),
        "train_size": len(session.X_train) if session.X_train is not None else 0,
        "test_size": len(session.X_test) if session.X_test is not None else 0,
        "feature_columns": session.feature_columns or [],
        "processed_preview": processed_preview,
        "target_col": session.target_col,
        "task_type": session.task_type,
        "sampled": session.preprocess_meta.get("sampled", False),
        "sample_size": session.preprocess_meta.get("sample_size"),
        "large_dataset_mode": session.preprocess_meta.get("large_dataset_mode", False),
    })
