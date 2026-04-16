"""
MongoDB async connection using motor.
"""
from __future__ import annotations

import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv()

MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
MONGODB_DB  = os.getenv("MONGODB_DB", "datalytics")

_client: AsyncIOMotorClient | None = None


def get_client() -> AsyncIOMotorClient:
    global _client
    if _client is None:
        _client = AsyncIOMotorClient(MONGODB_URI, serverSelectionTimeoutMS=5000)
    return _client


def get_db():
    return get_client()[MONGODB_DB]


async def save_dataset(session_id: str, filename: str, json_data: list, meta: dict) -> str:
    """Save dataset JSON to MongoDB. Returns inserted document id."""
    db = get_db()
    doc = {
        "session_id": session_id,
        "filename": filename,
        "data": json_data,        # list of row dicts
        "meta": meta,             # rows, cols, columns_info, etc.
    }
    result = await db["datasets"].replace_one(
        {"session_id": session_id},
        doc,
        upsert=True,
    )
    return str(result.upserted_id or session_id)


async def get_dataset(session_id: str) -> dict | None:
    """Retrieve dataset document for a session."""
    db = get_db()
    doc = await db["datasets"].find_one({"session_id": session_id})
    return doc


async def save_chat_message(session_id: str, role: str, content: str):
    """Append a chat message to the session's history."""
    db = get_db()
    await db["chats"].insert_one({
        "session_id": session_id,
        "role": role,
        "content": content,
    })


async def get_chat_history(session_id: str, limit: int = 20) -> list[dict]:
    """Get last N chat messages for a session."""
    db = get_db()
    cursor = db["chats"].find(
        {"session_id": session_id},
        {"_id": 0, "role": 1, "content": 1},
    ).sort("_id", -1).limit(limit)
    messages = await cursor.to_list(length=limit)
    return list(reversed(messages))


async def ping_db() -> bool:
    """Test MongoDB connectivity."""
    try:
        await get_client().admin.command("ping")
        return True
    except Exception:
        return False
