import logging
from typing import Optional
from fastapi import APIRouter, Request
from pydantic import BaseModel
import pandas as pd
from sqlalchemy import create_engine, text
from .utils import df_summary, save_to_session, redact_password

router = APIRouter()
log = logging.getLogger(__name__)

class PostgreSQLRequest(BaseModel):
    host: str
    port: int = 5432
    db_name: str
    username: str
    password: str
    query: str
    ssl_mode: str = "disable" # disable / require / verify-full

def fetch_postgresql_data(req: PostgreSQLRequest) -> pd.DataFrame:
    conn_str = f"postgresql+psycopg2://{req.username}:{req.password}@{req.host}:{req.port}/{req.db_name}?sslmode={req.ssl_mode}"
    
    engine = create_engine(conn_str)
    with engine.connect() as conn:
        df = pd.read_sql(text(req.query), conn)
    return df

@router.post("/test")
async def test_postgresql(req: PostgreSQLRequest):
    try:
        # Wrap query in subquery with limit 1
        safe_query = req.query.strip().rstrip(";")
        test_query = f"SELECT * FROM ({safe_query}) AS t LIMIT 1"
        req.query = test_query
        df = fetch_postgresql_data(req)
        return {"success": True, "message": "Connection successful!"}
    except Exception as e:
        log.error(f"PostgreSQL test failed: {e}")
        return {"success": False, "error": str(e)}

@router.post("/connect")
async def connect_postgresql(req: PostgreSQLRequest, request: Request):
    try:
        session_id = request.headers.get("X-Session-ID", "default_session")
        df = fetch_postgresql_data(req)
        
        dataset_name = f"PostgreSQL_{req.db_name}"
        save_to_session(session_id, df, dataset_name)
        
        log.info(f"[PostgreSQL] Loaded {len(df)} rows from {req.host}.")
        return df_summary(df, dataset_name)
    except Exception as e:
        log.error(f"PostgreSQL connect failed: {e}")
        return {"success": False, "error": str(e)}
