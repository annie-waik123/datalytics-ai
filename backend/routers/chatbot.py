"""
Chatbot router for structured dataset Q&A.
"""
from __future__ import annotations

import json

from fastapi import APIRouter, Header, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from database import get_chat_history, get_dataset, save_chat_message
from services.data_engine_service import build_query_response, has_live_dataset, restore_live_dataset
from services.llm_service import has_openrouter_config, openrouter_chat
from state.session_store import store

router = APIRouter()


class ChatRequest(BaseModel):
    message: str


def _unavailable_payload(document_found: bool) -> dict:
    answer = (
        "I found session metadata, but I need the original dataset loaded to run exact analytics. Please re-upload the file."
        if document_found
        else "Upload a dataset first."
    )
    return {
        "answer": answer,
        "insights": {},
        "chart": {},
    }


def _polish_answer_with_openrouter(message: str, payload: dict) -> dict:
    if not has_openrouter_config():
        return payload

    base_answer = str(payload.get("answer") or "").strip()
    if not base_answer:
        return payload

    messages = [
        {
            "role": "system",
            "content": (
                "You rewrite analytics answers only. "
                "Use the provided structured facts as the only source of truth. "
                "Do not add new numbers, columns, trends, or assumptions. "
                "Return one concise paragraph under 80 words."
            ),
        },
        {
            "role": "user",
            "content": json.dumps(
                {
                    "question": message,
                    "answer": base_answer,
                    "insights": payload.get("insights", {}),
                    "chart": payload.get("chart", {}),
                },
                default=str,
            ),
        },
    ]

    try:
        rewritten = openrouter_chat(messages, max_tokens=180, temperature=0.1)
    except Exception:
        return payload

    rewritten = str(rewritten or "").strip()
    if rewritten:
        payload["answer"] = rewritten
    return payload


async def _run_structured_chat(message: str, session_id: str) -> dict:
    session = store.get(session_id)
    document = await get_dataset(session_id)
    live_dataset = has_live_dataset(session)
    if not live_dataset and document is not None:
        live_dataset = restore_live_dataset(session, session_id, document)

    if not live_dataset:
        return _unavailable_payload(document_found=document is not None)

    payload = build_query_response(session, session_id, message)
    return _polish_answer_with_openrouter(message, payload)


@router.post("/chat")
async def chat(
    body: ChatRequest,
    x_session_id: str = Header(..., alias="X-Session-ID"),
):
    user_message = body.message.strip()
    if not user_message:
        raise HTTPException(status_code=400, detail="Message cannot be empty.")

    payload = await _run_structured_chat(user_message, x_session_id)

    try:
        await save_chat_message(x_session_id, "user", user_message)
        await save_chat_message(x_session_id, "assistant", str(payload.get("answer") or ""))
    except Exception:
        pass

    return JSONResponse(payload)


@router.post("/data-engine/query")
async def data_engine_query(
    body: ChatRequest,
    x_session_id: str = Header(..., alias="X-Session-ID"),
):
    user_message = body.message.strip()
    if not user_message:
        raise HTTPException(status_code=400, detail="Message cannot be empty.")
    return JSONResponse(await _run_structured_chat(user_message, x_session_id))


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
