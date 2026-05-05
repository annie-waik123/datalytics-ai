import pandas as pd

# Global in-memory storage for datasets (keyed by session_id)
# In production, this would be Redis or DB, but requirement says "use app.state or a global dict"
SESSION_DATASETS = {}

def df_summary(df: pd.DataFrame, dataset_name: str) -> dict:
    """Generate the standardized summary dict for a loaded DataFrame."""
    # Convert any problematic types (like object/datetime) for JSON serialization
    try:
        preview = df.head(5).fillna("").to_dict(orient="records")
    except Exception:
        preview = []
        
    num_cols = df.select_dtypes(include=['number']).columns.tolist()
    cat_cols = df.select_dtypes(exclude=['number']).columns.tolist()
    missing = df.isnull().sum().to_dict()
    
    # Try to calculate duplicate rows without crashing on unhashable types
    try:
        duplicates = int(df.duplicated().sum())
    except Exception:
        duplicates = 0
        
    return {
        "success": True,
        "dataset_name": dataset_name,
        "rows": len(df),
        "columns": len(df.columns),
        "preview": preview,
        "numeric_cols": num_cols,
        "categorical_cols": cat_cols,
        "missing_values": missing,
        "duplicate_rows": duplicates
    }

def save_to_session(session_id: str, df: pd.DataFrame, dataset_name: str):
    """Store the DataFrame in the global session dict."""
    if session_id not in SESSION_DATASETS:
        SESSION_DATASETS[session_id] = {}
    SESSION_DATASETS[session_id]["df"] = df
    SESSION_DATASETS[session_id]["name"] = dataset_name
    # Clean up column names (make string, remove invalid characters if needed)
    df.columns = df.columns.astype(str)

def redact_password(conn_str: str) -> str:
    """Utility to redact password from connection string for logging."""
    import re
    # naive redaction for connection strings looking like ...:password@...
    return re.sub(r':[^:]+@', ':***@', conn_str)
