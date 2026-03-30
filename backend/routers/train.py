"""
Train router — POST /train (supervised) and POST /cluster (unsupervised)
"""
from __future__ import annotations

from fastapi import APIRouter, Header, HTTPException
from fastapi.responses import JSONResponse

from models.schemas import ClusterRequest
from services.ml_service import (
    build_best_model_summary,
    sanitize_for_json,
    train_clustering,
    train_supervised,
)
from state.session_store import store

router = APIRouter()


def _serialize_best_metrics(best_metrics: dict) -> dict:
    return sanitize_for_json(best_metrics)


async def _train_models(
    x_session_id: str = Header(..., alias="X-Session-ID"),
):
    session = store.get(x_session_id)

    if not session.preprocessing_done:
        raise HTTPException(status_code=400, detail="Preprocessing not done. Run /preprocess first.")

    try:
        result = train_supervised(
            X_train=session.X_train,
            y_train=session.y_train,
            X_test=session.X_test,
            y_test=session.y_test,
            task_type=session.task_type,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Training failed: {e}")

    session.trained_models = result["trained_models"]
    session.model_results = result["model_results"]
    session.best_model_name = result["best_model_name"]
    session.best_model = result["best_model"]
    session.training_meta = {
        "large_dataset_mode": result["large_dataset_mode"],
        "cv_enabled": result["cv_enabled"],
        "train_rows_used": result["train_rows_used"],
        "test_rows_used": result["test_rows_used"],
        "models_considered": result["models_considered"],
    }
    session.supervised_done = True

    return JSONResponse(sanitize_for_json({
        "task_type": session.task_type,
        "results": result["results"],
        "best_model_name": result["best_model_name"],
        "best_metrics": _serialize_best_metrics(result["best_metrics"]),
        "primary_metric": result["primary_metric"],
        "errors": result["errors"],
        "large_dataset_mode": result["large_dataset_mode"],
        "cv_enabled": result["cv_enabled"],
        "train_rows_used": result["train_rows_used"],
        "test_rows_used": result["test_rows_used"],
        "models_considered": result["models_considered"],
    }))


@router.post("/train")
async def train_models(
    x_session_id: str = Header(..., alias="X-Session-ID"),
):
    return await _train_models(x_session_id=x_session_id)


@router.post("/train-model")
async def train_models_alias(
    x_session_id: str = Header(..., alias="X-Session-ID"),
):
    return await _train_models(x_session_id=x_session_id)


@router.post("/cluster")
async def run_clustering(
    body: ClusterRequest,
    x_session_id: str = Header(..., alias="X-Session-ID"),
):
    session = store.get(x_session_id)

    if not session.preprocessing_done:
        raise HTTPException(status_code=400, detail="Preprocessing not done. Run /preprocess first.")

    try:
        result = train_clustering(
            X_train=session.X_train,
            X_test=session.X_test,
            n_clusters=body.n_clusters,
            eps=body.eps,
            min_samples=body.min_samples,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Clustering failed: {e}")

    session.cluster_results = result["cluster_results"]
    session.cluster_pca_data = result["pca_data"]
    session.cluster_meta = {
        "large_dataset_mode": result["large_dataset_mode"],
        "cluster_rows_used": result["cluster_rows_used"],
        "sampled_cluster": result["sampled_cluster"],
    }
    session.unsupervised_done = True

    return JSONResponse(sanitize_for_json({
        "cluster_results": result["cluster_results"],
        "pca_data": result["pca_data"],
        "sampled_cluster": result["sampled_cluster"],
        "errors": result["errors"],
        "large_dataset_mode": result["large_dataset_mode"],
        "cluster_rows_used": result["cluster_rows_used"],
    }))


@router.get("/train-results")
async def train_results(
    x_session_id: str = Header(..., alias="X-Session-ID"),
):
    session = store.get(x_session_id)
    if not session.supervised_done or session.model_results is None or session.best_model is None:
        raise HTTPException(status_code=404, detail="Train models first.")

    best_row = session.model_results[session.model_results["Model"] == session.best_model_name].iloc[0].to_dict()
    primary_metric = "Accuracy" if session.task_type == "Classification" else "R2 Score"
    return JSONResponse(sanitize_for_json({
        "task_type": session.task_type,
        "results": session.model_results.to_dict(orient="records"),
        "best_model_name": session.best_model_name,
        "best_metrics": _serialize_best_metrics(best_row),
        "primary_metric": primary_metric,
        "errors": [],
        "large_dataset_mode": session.training_meta.get("large_dataset_mode", False),
        "cv_enabled": session.training_meta.get("cv_enabled", True),
        "train_rows_used": session.training_meta.get("train_rows_used"),
        "test_rows_used": session.training_meta.get("test_rows_used"),
        "models_considered": session.training_meta.get("models_considered", []),
    }))


@router.get("/cluster-results")
async def cluster_results(
    x_session_id: str = Header(..., alias="X-Session-ID"),
):
    session = store.get(x_session_id)
    if not session.unsupervised_done or session.cluster_results is None:
        raise HTTPException(status_code=404, detail="Run clustering first.")
    return JSONResponse(sanitize_for_json({
        "cluster_results": session.cluster_results,
        "pca_data": session.cluster_pca_data,
        "errors": [],
        "sampled_cluster": session.cluster_meta.get("sampled_cluster", False),
        "large_dataset_mode": session.cluster_meta.get("large_dataset_mode", False),
        "cluster_rows_used": session.cluster_meta.get("cluster_rows_used"),
    }))


@router.get("/best-model-summary")
async def best_model_summary(
    x_session_id: str = Header(..., alias="X-Session-ID"),
):
    session = store.get(x_session_id)
    if not session.supervised_done or session.best_model is None or session.model_results is None:
        raise HTTPException(status_code=404, detail="Train supervised models first.")

    payload = build_best_model_summary(
        best_model=session.best_model,
        best_model_name=session.best_model_name,
        model_results=session.model_results,
        task_type=session.task_type,
        X_train=session.X_train,
        X_test=session.X_test,
        y_train=session.y_train,
        y_test=session.y_test,
        cluster_results=session.cluster_results,
    )
    return JSONResponse(sanitize_for_json(payload))
