"""
Predict router — POST /predict, GET /download-model, GET /download-processed-data,
                 GET /download-predictions, GET /download-report, GET /feature-info
"""
from __future__ import annotations

import io
import pickle

import pandas as pd
from fastapi import APIRouter, Header, HTTPException
from fastapi.responses import JSONResponse, StreamingResponse

from models.schemas import PredictRequest
from services.ml_service import predict, get_feature_info
from state.session_store import store

router = APIRouter()


@router.get("/feature-info")
async def feature_info(
    x_session_id: str = Header(..., alias="X-Session-ID"),
):
    session = store.get(x_session_id)

    if not session.supervised_done or session.best_model is None:
        raise HTTPException(status_code=400, detail="Train models first.")

    info = get_feature_info(
        feature_columns=session.feature_columns,
        label_encoders=session.label_encoders,
        raw_df=session.df,
        X_train=session.X_train,
    )
    return JSONResponse(info)


@router.post("/predict")
async def make_prediction(
    body: PredictRequest,
    x_session_id: str = Header(..., alias="X-Session-ID"),
):
    session = store.get(x_session_id)

    if session.best_model is None:
        raise HTTPException(status_code=400, detail="No trained model found. Train models first.")

    try:
        prediction = predict(
            model=session.best_model,
            feature_values=body.feature_values,
            feature_columns=session.feature_columns,
            scaler=session.scaler,
            label_encoders=session.label_encoders,
            target_col=session.target_col,
            task_type=session.task_type,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Prediction failed: {e}")

    # Store in history
    record = {f: body.feature_values.get(f) for f in session.feature_columns}
    record["Prediction"] = str(prediction)
    session.prediction_history.append(record)

    return JSONResponse({
        "prediction": str(prediction),
        "model_used": session.best_model_name,
        "task_type": session.task_type,
    })


@router.get("/download-model")
async def download_model(
    x_session_id: str = Header(..., alias="X-Session-ID"),
):
    session = store.get(x_session_id)

    if session.best_model is None:
        raise HTTPException(status_code=400, detail="No trained model found.")

    model_bytes = pickle.dumps(session.best_model)
    filename = f"{session.best_model_name.replace(' ', '_')}_model.pkl"

    return StreamingResponse(
        io.BytesIO(model_bytes),
        media_type="application/octet-stream",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/download-processed-data")
async def download_processed_data(
    x_session_id: str = Header(..., alias="X-Session-ID"),
):
    session = store.get(x_session_id)

    if session.df_processed is None:
        raise HTTPException(status_code=400, detail="No processed dataset found.")

    csv_data = session.df_processed.to_csv(index=False)

    return StreamingResponse(
        io.StringIO(csv_data),
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="processed_dataset.csv"'},
    )


@router.get("/download-predictions")
async def download_predictions(
    x_session_id: str = Header(..., alias="X-Session-ID"),
):
    session = store.get(x_session_id)

    if not session.prediction_history:
        raise HTTPException(status_code=400, detail="No predictions found. Make some predictions first.")

    pred_df = pd.DataFrame(session.prediction_history)
    csv_data = pred_df.to_csv(index=False)

    return StreamingResponse(
        io.StringIO(csv_data),
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="prediction_results.csv"'},
    )


@router.get("/download-report")
async def download_report(
    x_session_id: str = Header(..., alias="X-Session-ID"),
):
    session = store.get(x_session_id)

    if session.model_results is None:
        raise HTTPException(status_code=400, detail="No model results found. Train models first.")

    csv_data = session.model_results.to_csv(index=False)

    return StreamingResponse(
        io.StringIO(csv_data),
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="model_comparison_report.csv"'},
    )


@router.get("/download-clustering-report")
async def download_clustering_report(
    x_session_id: str = Header(..., alias="X-Session-ID"),
):
    session = store.get(x_session_id)

    if not session.cluster_results:
        raise HTTPException(status_code=400, detail="No clustering results found.")

    cluster_df = pd.DataFrame(session.cluster_results)
    csv_data = cluster_df.to_csv(index=False)

    return StreamingResponse(
        io.StringIO(csv_data),
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="clustering_report.csv"'},
    )


@router.get("/session-status")
async def session_status(
    x_session_id: str = Header(..., alias="X-Session-ID"),
):
    """Return the workflow completion status for the session."""
    session = store.get(x_session_id)
    return JSONResponse({
        "has_data": session.df is not None,
        "preprocessing_done": session.preprocessing_done,
        "supervised_done": session.supervised_done,
        "unsupervised_done": session.unsupervised_done,
        "has_predictions": len(session.prediction_history) > 0,
        "download_ready": session.supervised_done or bool(session.prediction_history),
        "best_model_name": session.best_model_name,
        "task_type": session.task_type,
        "target_col": session.target_col,
        "feature_columns": session.feature_columns,
    })


@router.post("/reset-session")
async def reset_session(
    x_session_id: str = Header(..., alias="X-Session-ID"),
):
    store.delete(x_session_id)
    return JSONResponse({"status": "reset"})
