"""
Chatbot router — POST /api/chat
Uses Groq API (llama3-8b) with dataset context from MongoDB.
"""
from __future__ import annotations

import os
import json
import pandas as pd
from fastapi import APIRouter, Header, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from dotenv import load_dotenv
from groq import Groq

from database import get_dataset, save_chat_message, get_chat_history
from state.session_store import store

load_dotenv()

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
router = APIRouter()

groq_client = Groq(api_key=GROQ_API_KEY)


class ChatRequest(BaseModel):
    message: str


def _build_dataset_context(doc: dict) -> str:
    """Build a compact dataset summary to inject into the system prompt."""
    if not doc:
        return "No dataset is loaded yet."

    meta = doc.get("meta", {})
    data = doc.get("data", [])
    filename = meta.get("filename", "dataset.csv")
    rows = meta.get("rows", 0)
    cols = meta.get("cols", 0)
    columns = meta.get("columns", [])

    # Build column-level stats from stored JSON data
    if data:
        df = pd.DataFrame(data)
        stats_lines = []
        for col in df.columns:
            s = df[col]
            if pd.api.types.is_numeric_dtype(s):
                stats_lines.append(
                    f"  - {col} [numeric]: min={s.min()}, max={s.max()}, "
                    f"mean={round(float(s.mean()), 2)}, nulls={int(s.isnull().sum())}"
                )
            else:
                top = s.value_counts().head(3).to_dict()
                stats_lines.append(
                    f"  - {col} [categorical]: unique={s.nunique()}, "
                    f"top={top}, nulls={int(s.isnull().sum())}"
                )
        stats_text = "\n".join(stats_lines)
        sample_rows = json.dumps(data[:5], default=str)
    else:
        stats_text = "No data available."
        sample_rows = "[]"

    return f"""Dataset: {filename}
Shape: {rows} rows × {cols} columns
Columns: {', '.join(columns)}

Column Statistics:
{stats_text}

Sample rows (first 5):
{sample_rows}
"""


@router.post("/chat")
async def chat(
    body: ChatRequest,
    x_session_id: str = Header(..., alias="X-Session-ID"),
):
    if not GROQ_API_KEY:
        raise HTTPException(status_code=500, detail="GROQ_API_KEY not configured.")

    user_message = body.message.strip()
    if not user_message:
        raise HTTPException(status_code=400, detail="Message cannot be empty.")

    # 1. Get dataset context from MongoDB
    doc = await get_dataset(x_session_id)
    dataset_context = _build_dataset_context(doc)

    # 2. Get chat history for continuity
    history = await get_chat_history(x_session_id, limit=10)

    # 3. Build messages list
    system_prompt = f"""You are Datalytics AI — an expert data analyst assistant. 
You help users understand their dataset by answering specific questions about it.
Be concise, accurate, and friendly. Use numbers from the stats provided.
If the user asks about max/min/average/count — look at the Column Statistics below.

{dataset_context}

Rules:
- Always base answers on the dataset stats above.
- If dataset is not loaded, tell user to upload a CSV first.
- Format numbers nicely. 
- For complex analysis questions, explain step by step.
- Keep answers under 200 words unless user asks for details.
"""

    messages = [{"role": "system", "content": system_prompt}]
    for h in history:
        messages.append({"role": h["role"], "content": h["content"]})
    messages.append({"role": "user", "content": user_message})

    # 4. Call Groq API
    try:
        # Try primary model first
        try:
            response = groq_client.chat.completions.create(
                model="llama-3.1-8b-instant",
                messages=messages,
                max_tokens=512,
                temperature=0.3,
            )
        except Exception as primary_error:
            # Fallback to backup model if primary fails
            import logging
            logging.warning(f"Primary model failed, trying fallback model: {str(primary_error)}")
            response = groq_client.chat.completions.create(
                model="llama-3.1-70b-versatile",
                messages=messages,
                max_tokens=512,
                temperature=0.3,
            )
        assistant_reply = response.choices[0].message.content
    except Exception as e:
        # Enhanced error handling with specific error types
        error_msg = str(e)
        if "model_decommissioned" in error_msg:
            raise HTTPException(status_code=502, detail="Model is no longer available. Please contact support.")
        elif "rate_limit" in error_msg.lower():
            raise HTTPException(status_code=429, detail="Rate limit exceeded. Please try again later.")
        elif "api_key" in error_msg.lower():
            raise HTTPException(status_code=401, detail="Invalid API key. Please check your Groq API key.")
        elif "timeout" in error_msg.lower():
            raise HTTPException(status_code=504, detail="Request timeout. Please try again.")
        else:
            raise HTTPException(status_code=502, detail=f"Groq API error: {error_msg}")

    # 5. Save to MongoDB
    try:
        await save_chat_message(x_session_id, "user", user_message)
        await save_chat_message(x_session_id, "assistant", assistant_reply)
    except Exception:
        pass

    return JSONResponse({
        "reply": assistant_reply,
        "has_dataset": doc is not None,
    })


@router.get("/chat/history")
async def chat_history(
    x_session_id: str = Header(..., alias="X-Session-ID"),
):
    history = await get_chat_history(x_session_id, limit=50)
    return JSONResponse({"messages": history})


@router.delete("/chat/clear")
async def clear_chat(
    x_session_id: str = Header(..., alias="X-Session-ID"),
):
    from database import get_db
    db = get_db()
    await db["chats"].delete_many({"session_id": x_session_id})
    return JSONResponse({"message": "Chat history cleared."})
