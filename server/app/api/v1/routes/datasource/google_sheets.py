import re
import io
import logging
from typing import Optional
from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel
import pandas as pd
from .utils import df_summary, save_to_session

router = APIRouter()
log = logging.getLogger(__name__)

class GoogleSheetsRequest(BaseModel):
    url: str
    sheet_name: Optional[str] = None
    has_header: bool = True

def extract_sheet_id(url: str) -> str:
    match = re.search(r'/d/([a-zA-Z0-9-_]+)', url)
    if not match:
        raise ValueError("Could not extract Sheet ID from URL.")
    return match.group(1)

def load_google_sheet(req: GoogleSheetsRequest) -> pd.DataFrame:
    sheet_id = extract_sheet_id(req.url)
    
    # Try public CSV export approach first
    export_url = f"https://docs.google.com/spreadsheets/d/{sheet_id}/gviz/tq?tqx=out:csv"
    if req.sheet_name:
        export_url += f"&sheet={req.sheet_name}"
    
    header_idx = 0 if req.has_header else None
    
    try:
        df = pd.read_csv(export_url, header=header_idx)
        return df
    except Exception as e:
        # If public approach fails, it might be private.
        # We can implement gspread + service account fallback here if GOOGLE_SA_JSON is provided.
        # For simplicity in this implementation, we throw error asking to make it public.
        raise RuntimeError(f"Failed to load Google Sheet (ensure it is accessible). Error: {str(e)}")

@router.post("/test")
async def test_google_sheet(req: GoogleSheetsRequest):
    try:
        df = load_google_sheet(req)
        # Fetch just 1 row to verify
        if len(df) == 0:
            pass # still valid connection
        return {"success": True, "message": "Connection successful!"}
    except Exception as e:
        log.error(f"Google Sheets test failed: {e}")
        return {"success": False, "error": str(e)}

@router.post("/connect")
async def connect_google_sheet(req: GoogleSheetsRequest, request: Request):
    try:
        session_id = request.headers.get("X-Session-ID", "default_session")
        df = load_google_sheet(req)
        
        dataset_name = req.sheet_name if req.sheet_name else "Google Sheet Data"
        save_to_session(session_id, df, dataset_name)
        
        log.info(f"[GoogleSheets] Loaded {len(df)} rows.")
        return df_summary(df, dataset_name)
    except Exception as e:
        log.error(f"Google Sheets connect failed: {e}")
        return {"success": False, "error": str(e)}
