import json
import logging
from typing import Optional
from fastapi import APIRouter, Request
from pydantic import BaseModel
import pandas as pd
import httpx
import jmespath
from .utils import df_summary, save_to_session

router = APIRouter()
log = logging.getLogger(__name__)

class JSONApiRequest(BaseModel):
    url: str
    method: str = "GET"
    headers: Optional[str] = "{}"
    body: Optional[str] = "{}"
    data_path: Optional[str] = None
    pagination: bool = False
    next_page_key: Optional[str] = None
    max_pages: Optional[int] = 5

def smart_json_to_df(data) -> pd.DataFrame:
    from pandas import json_normalize
    
    # Case 1: Already a list of dicts
    if isinstance(data, list):
        if len(data) == 0:
            raise ValueError("Empty array returned")
        df = json_normalize(data, sep='_')
        return df

    # Case 2: Dict — find the array inside
    if isinstance(data, dict):
        common_keys = ['data', 'results', 'items', 'records', 
                       'rows', 'list', 'content', 'payload',
                       'response', 'output', 'dataset']
        
        for key in common_keys:
            if key in data and isinstance(data[key], list):
                df = json_normalize(data[key], sep='_')
                return df
        
        for key, value in data.items():
            if isinstance(value, list) and len(value) > 0:
                df = json_normalize(value, sep='_')
                return df
        
        for key, value in data.items():
            if isinstance(value, dict):
                for nested_key, nested_val in value.items():
                    if isinstance(nested_val, list) and len(nested_val) > 0:
                        df = json_normalize(nested_val, sep='_')
                        return df
        
        df = json_normalize([data], sep='_')
        return df

    raise ValueError(f"Unsupported JSON format: {type(data)}")

def fetch_json_api(req: JSONApiRequest) -> pd.DataFrame:
    try:
        headers = json.loads(req.headers) if req.headers else {}
        body = json.loads(req.body) if req.body else {}
    except json.JSONDecodeError:
        raise ValueError("Invalid JSON in headers or body")
    
    all_data = []
    current_url = req.url
    pages_fetched = 0
    max_p = req.max_pages if req.pagination and req.max_pages else 1
    
    with httpx.Client(timeout=30.0) as client:
        while pages_fetched < max_p:
            if req.method.upper() == "GET":
                resp = client.get(current_url, headers=headers)
            else:
                resp = client.post(current_url, headers=headers, json=body)
                
            resp.raise_for_status()
            data = resp.json()
            
            # Extract data using jmespath or manual dot notation
            if req.data_path:
                extracted = jmespath.search(req.data_path, data)
                if extracted is None:
                    # fallback manual split
                    extracted = data
                    for part in req.data_path.split("."):
                        extracted = extracted.get(part, {}) if isinstance(extracted, dict) else extracted
            else:
                extracted = data
                
            if isinstance(extracted, list):
                all_data.extend(extracted)
            elif isinstance(extracted, dict):
                all_data.append(extracted)
            else:
                raise ValueError("Extracted data is neither a list nor a dictionary.")
                
            pages_fetched += 1
            
            if req.pagination and req.next_page_key:
                next_url = jmespath.search(req.next_page_key, data)
                if not next_url or not isinstance(next_url, str):
                    break
                current_url = next_url
            else:
                break
                
    if not all_data:
        return pd.DataFrame()
        
    df = smart_json_to_df(all_data)
    
    # Clean column names
    df.columns = [str(col).replace('.', '_').strip() for col in df.columns]
    
    return df

@router.post("/test")
async def test_json_api(req: JSONApiRequest):
    try:
        req.pagination = False # only fetch one page for test
        df = fetch_json_api(req)
        return {"success": True, "message": "Connection successful!"}
    except Exception as e:
        log.error(f"JSON API test failed: {e}")
        return {"success": False, "error": str(e)}

@router.post("/connect")
async def connect_json_api(req: JSONApiRequest, request: Request):
    try:
        session_id = request.headers.get("X-Session-ID", "default_session")
        df = fetch_json_api(req)
        
        dataset_name = "JSON_API_Data"
        save_to_session(session_id, df, dataset_name)
        
        log.info(f"[JSON API] Loaded {len(df)} rows from {req.url}.")
        return df_summary(df, dataset_name)
    except Exception as e:
        log.error(f"JSON API connect failed: {e}")
        return {"success": False, "error": str(e)}
