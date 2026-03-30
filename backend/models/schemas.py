"""
Pydantic schemas for request/response models.
"""
from __future__ import annotations
from typing import Any, Dict, List, Optional
from pydantic import BaseModel


# ── Requests ─────────────────────────────────────────────────────────────────

class PreprocessRequest(BaseModel):
    target_col: str
    task_type: str                        # "Classification" | "Regression"
    missing_strategy: Optional[str] = None  # None means no missing values
    encode_method: Optional[str] = None   # "Label Encoding" | "One-Hot Encoding"
    scaling_method: str = "None"          # "None" | "StandardScaler" | "MinMaxScaler"
    test_size: float = 0.2
    random_state: int = 42


class ClusterRequest(BaseModel):
    n_clusters: int = 3
    eps: float = 0.5
    min_samples: int = 5


class PredictRequest(BaseModel):
    feature_values: Dict[str, Any]        # { feature_name: value }


class VisualizationRequest(BaseModel):
    viz_type: str
    selected_columns: List[str] = []
    color_column: Optional[str] = None
    x_column: Optional[str] = None
    y_column: Optional[str] = None
    column: Optional[str] = None
    bins: int = 30
    group_column: Optional[str] = None


# ── Responses ─────────────────────────────────────────────────────────────────

class ColumnInfo(BaseModel):
    column: str
    dtype: str
    non_null: int
    null: int
    null_pct: float
    unique: int


class UploadResponse(BaseModel):
    rows: int
    cols: int
    numeric_cols: int
    categorical_cols: int
    columns_info: List[ColumnInfo]
    preview: List[Dict[str, Any]]          # first 20 rows as list of dicts
    missing_total: int
    sampling_info: Dict[str, Any]
    all_columns: List[str]


class PreprocessResponse(BaseModel):
    total_size: int
    train_size: int
    test_size: int
    feature_columns: List[str]
    sampled: bool
    sample_size: int
    processed_preview: List[Dict[str, Any]]


class ModelMetrics(BaseModel):
    model: str
    metrics: Dict[str, Any]


class TrainResponse(BaseModel):
    task_type: str
    results: List[Dict[str, Any]]
    best_model_name: str
    best_metrics: Dict[str, Any]


class ClusterResult(BaseModel):
    model: str
    silhouette: float
    davies_bouldin: float
    clusters: int


class ClusterResponse(BaseModel):
    cluster_results: List[Dict[str, Any]]


class PredictResponse(BaseModel):
    prediction: Any
    model_used: str
    task_type: str


class FeatureInfo(BaseModel):
    feature_columns: List[str]
    label_encoded_feats: Dict[str, List[str]]  # feat → classes list
    ohe_groups: Dict[str, List[str]]           # orig_col → list of category values
    numeric_feats: List[str]
    feature_stats: Dict[str, Dict[str, float]] # feat → {min, max, median}
