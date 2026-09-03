"""
Pydantic schemas for request/response models.
"""
from __future__ import annotations
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


# ── Requests ─────────────────────────────────────────────────────────────────

class ManualEncodingRule(BaseModel):
    method: str  # "Label Encoding" | "One-Hot Encoding"
    columns: List[str]

class PreprocessRequest(BaseModel):
    target_col: str
    task_type: str                        # "Classification" | "Regression"
    missing_strategy: Optional[str] = None  # None means no missing values
    encode_method: Optional[str] = None   # "Label Encoding" | "One-Hot Encoding" | "Auto" | "Manual"
    manual_encoding_rules: Optional[List[ManualEncodingRule]] = []
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
    chart_key: Optional[str] = None
    chart_type: Optional[str] = None
    viz_type: Optional[str] = None
    columns: List[str] = []
    selected_columns: List[str] = []
    color_column: Optional[str] = None
    x_column: Optional[str] = None
    y_column: Optional[str] = None
    column: Optional[str] = None
    date_column: Optional[str] = None
    value_column: Optional[str] = None
    size_column: Optional[str] = None
    bins: int = 30
    group_column: Optional[str] = None
    rolling_window: int = 7
    theme: str = "dark"


class VisualizationBatchRequest(BaseModel):
    charts: List[VisualizationRequest]


class VisualizationSyncRequest(BaseModel):
    rows: List[Dict[str, Any]]
    columns: List[str] = []
    name: Optional[str] = None
    meta: Dict[str, Any] = {}
    replace_original: bool = False


class DashboardFilter(BaseModel):
    column: str
    value: Any


class DashboardFieldMapping(BaseModel):
    x_axis: Optional[str] = None
    y_axis: Optional[str] = None
    values: List[str] = Field(default_factory=list)
    legend: Optional[str] = None
    tooltip: List[str] = Field(default_factory=list)
    size: Optional[str] = None
    color: Optional[str] = None
    details: Optional[str] = None
    rows: List[str] = Field(default_factory=list)
    columns: List[str] = Field(default_factory=list)
    aggregation: str = "sum"
    title: Optional[str] = None


class DashboardWidgetRequest(BaseModel):
    widget_id: Optional[str] = None
    chart_type: str = "auto"
    mapping: DashboardFieldMapping = Field(default_factory=DashboardFieldMapping)
    filters: List[DashboardFilter] = Field(default_factory=list)
    drill_column: Optional[str] = None
    drill_value: Optional[Any] = None
    theme: str = "dark"


class DashboardSuggestRequest(BaseModel):
    chart_type: Optional[str] = "auto"
    selected_columns: List[str] = Field(default_factory=list)
    theme: str = "dark"


class DashboardSaveRequest(BaseModel):
    name: Optional[str] = None
    dataset_name: Optional[str] = None
    theme: str = "dark"
    widgets: List[Dict[str, Any]] = Field(default_factory=list)
    selected_widget_id: Optional[str] = None
    cross_filter: Dict[str, Any] = Field(default_factory=dict)


class EDAChartRequest(BaseModel):
    chart_type: str
    x_column: Optional[str] = None
    y_column: Optional[str] = None
    color_column: Optional[str] = None
    z_column: Optional[str] = None
    bins: int = 24
    aggregation: str = "mean"
    rolling_window: int = 7
    theme: str = "dark"


class EDAActionRequest(BaseModel):
    action: str
    options: Dict[str, Any] = {}


class EDASyncRequest(BaseModel):
    rows: List[Dict[str, Any]]
    columns: List[str] = []
    name: Optional[str] = None
    meta: Dict[str, Any] = {}
    replace_original: bool = False


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


# ── AI Analyst / Natural-Language Analytics ────────────────────────────────────

class AnalyticsIntent(BaseModel):
    """Validated, schema-resolved intent produced by the interpretation layer."""
    operation: str = "groupby"   # groupby | top | compare | time_series | scatter | correlation | distribution | missing | filter | trend_break
    dimension: Optional[str] = None
    metric: Optional[str] = None
    metric2: Optional[str] = None
    date_column: Optional[str] = None
    aggregation: str = "sum"     # sum | avg | min | max | count
    visualization: str = "auto"  # auto | bar | line | pie | scatter | histogram | heatmap | table
    limit: Optional[int] = 10
    filters: List[Dict[str, Any]] = Field(default_factory=list)
    note: Optional[str] = None


class NLQueryRequest(BaseModel):
    query: str
    mode: Optional[str] = "auto"  # auto | chart | table | metric
    include_explanation: bool = True


class NLInterpretRequest(BaseModel):
    query: str


class AnalystExecuteRequest(BaseModel):
    request: str
    mode: Optional[str] = "auto"          # auto | quick | deep
    include_ml: Optional[bool] = None     # force ML comparison on/off
    include_charts: Optional[bool] = None # force chart generation on/off
    max_charts: Optional[int] = 3
    context: Dict[str, Any] = Field(default_factory=dict)


# Generic structured report pieces (kept permissive so responses are forward-compatible).

class ReportFinding(BaseModel):
    title: str
    summary: str
    category: Optional[str] = None
    severity: Optional[str] = "info"       # info | success | warning | critical
    evidence: List[str] = Field(default_factory=list)
    chart_ids: List[str] = Field(default_factory=list)


class ReportRecommendation(BaseModel):
    action: str
    why: str = ""
    evidence: List[str] = Field(default_factory=list)
    priority: Optional[str] = "medium"     # high | medium | low


class ReportMetric(BaseModel):
    label: str
    value: Any = None
    formatted: Optional[str] = None
    hint: Optional[str] = None


class ReportAction(BaseModel):
    key: str
    label: str
    status: str              # done | skipped | error | running
    detail: Optional[str] = None
    duration_ms: Optional[float] = None
    error: Optional[str] = None


class ReportStep(BaseModel):
    key: str
    label: str


class ReportVisualization(BaseModel):
    id: str
    title: str
    chart_type: str
    figure: Dict[str, Any] = Field(default_factory=dict)
    insight: Optional[str] = None


class ReportTable(BaseModel):
    title: str
    columns: List[str]
    rows: List[Dict[str, Any]]


class AnalystReport(BaseModel):
    request: str
    mode: str = "agent"
    plan: List[ReportStep] = Field(default_factory=list)
    actions: List[ReportAction] = Field(default_factory=list)
    findings: List[ReportFinding] = Field(default_factory=list)
    recommendations: List[ReportRecommendation] = Field(default_factory=list)
    metrics: List[ReportMetric] = Field(default_factory=list)
    visualizations: List[ReportVisualization] = Field(default_factory=list)
    tables: List[ReportTable] = Field(default_factory=list)
    limitations: List[str] = Field(default_factory=list)
    dataset: Dict[str, Any] = Field(default_factory=dict)
    confidence: Optional[str] = "medium"   # high | medium | low
    narrative: Optional[str] = None
    llm_used: bool = False
    source: Optional[str] = "agent"
    error: Optional[str] = None
    duration_ms: Optional[float] = None


class NLQueryResponse(BaseModel):
    query: str
    intent: AnalyticsIntent = Field(default_factory=AnalyticsIntent)
    status: str = "ok"                     # ok | needs_clarification | unsupported | error
    charts: List[ReportVisualization] = Field(default_factory=list)
    tables: List[ReportTable] = Field(default_factory=list)
    metrics: List[ReportMetric] = Field(default_factory=list)
    explanation: Dict[str, Any] = Field(default_factory=dict)
    detected_columns: Dict[str, Any] = Field(default_factory=dict)
    filters: List[Dict[str, Any]] = Field(default_factory=list)
    warnings: List[str] = Field(default_factory=list)
    limitations: List[str] = Field(default_factory=list)
    dataset: Dict[str, Any] = Field(default_factory=dict)
    message: Optional[str] = None


class NLInterpretResponse(BaseModel):
    query: str
    intent: AnalyticsIntent = Field(default_factory=AnalyticsIntent)
    status: str = "ready"                  # ready | needs_clarification | unsupported
    corrections: List[str] = Field(default_factory=list)
    confidence: Optional[str] = "medium"
    source: Optional[str] = "rules"        # llm | rules
    available: Dict[str, Any] = Field(default_factory=dict)
    message: Optional[str] = None
