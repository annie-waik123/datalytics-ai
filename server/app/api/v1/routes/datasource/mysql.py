import logging
from typing import Optional
from fastapi import APIRouter, Request
from pydantic import BaseModel
import pandas as pd
from sqlalchemy import create_engine, text
from .utils import df_summary, save_to_session, redact_password

router = APIRouter()
log = logging.getLogger(__name__)

class MySQLRequest(BaseModel):
    host: str
    port: int = 3306
    db_name: str
    username: str
    password: str
    query: str
    ssl: bool = False

def fetch_mysql_data(req: MySQLRequest) -> pd.DataFrame:
    conn_str = f"mysql+pymysql://{req.username}:{req.password}@{req.host}:{req.port}/{req.db_name}"
    
    engine_kwargs = {}
    if req.ssl:
        engine_kwargs["connect_args"] = {"ssl": {"ca": ""}} # simplified SSL requirement
        
    engine = create_engine(conn_str, **engine_kwargs)
    with engine.connect() as conn:
        df = pd.read_sql(text(req.query), conn)
    return df

@router.post("/test")
async def test_mysql(req: MySQLRequest):
    try:
        # Wrap query in subquery with limit 1
        safe_query = req.query.strip().rstrip(";")
        test_query = f"SELECT * FROM ({safe_query}) AS t LIMIT 1"
        req.query = test_query
        df = fetch_mysql_data(req)
        return {"success": True, "message": "Connection successful!"}
    except Exception as e:
        log.error(f"MySQL test failed: {e}")
        return {"success": False, "error": str(e)}

@router.post("/connect")
async def connect_mysql(req: MySQLRequest, request: Request):
    try:
        session_id = request.headers.get("X-Session-ID", "default_session")
        df = fetch_mysql_data(req)
        
        dataset_name = f"MySQL_{req.db_name}"
        save_to_session(session_id, df, dataset_name)
        
        log.info(f"[MySQL] Loaded {len(df)} rows from {req.host}.")
        return df_summary(df, dataset_name)
    except Exception as e:
        log.error(f"MySQL connect failed: {e}")
        return {"success": False, "error": str(e)}
