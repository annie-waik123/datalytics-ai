"""
In-memory session store keyed by session UUID.
Replaces st.session_state for the API-based architecture.
"""
from __future__ import annotations
import threading
from dataclasses import dataclass, field
from typing import Any, Optional


@dataclass
class SessionData:
    df: Any = None
    df_processed: Any = None
    target_col: Optional[str] = None
    task_type: Optional[str] = None
    X_train: Any = None
    X_test: Any = None
    y_train: Any = None
    y_test: Any = None
    trained_models: dict = field(default_factory=dict)
    model_results: Any = None
    best_model_name: Optional[str] = None
    best_model: Any = None
    cluster_results: Any = None
    cluster_pca_data: Any = None
    feature_columns: Optional[list] = None
    scaler: Any = None
    label_encoders: dict = field(default_factory=dict)
    preprocess_meta: dict = field(default_factory=dict)
    training_meta: dict = field(default_factory=dict)
    cluster_meta: dict = field(default_factory=dict)
    preprocessing_done: bool = False
    supervised_done: bool = False
    unsupervised_done: bool = False
    prediction_history: list = field(default_factory=list)


class SessionStore:
    def __init__(self):
        self._store: dict[str, SessionData] = {}
        self._lock = threading.Lock()

    def get(self, session_id: str) -> SessionData:
        with self._lock:
            if session_id not in self._store:
                self._store[session_id] = SessionData()
            return self._store[session_id]

    def delete(self, session_id: str):
        with self._lock:
            self._store.pop(session_id, None)


# Global singleton
store = SessionStore()
