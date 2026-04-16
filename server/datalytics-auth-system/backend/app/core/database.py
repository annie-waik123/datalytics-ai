from datetime import timezone

from pymongo import ASCENDING, DESCENDING, MongoClient
from pymongo.database import Database

from app.core.config import get_settings

_client: MongoClient | None = None
_db: Database | None = None


def init_db() -> Database:
    global _client, _db

    settings = get_settings()
    _client = MongoClient(settings.mongodb_uri, tz_aware=True, tzinfo=timezone.utc)
    _db = _client[settings.mongodb_db_name]

    _db.users.create_index([("email", ASCENDING)], unique=True)
    _db.otps.create_index([("email", ASCENDING), ("purpose", ASCENDING), ("created_at", DESCENDING)])
    _db.otps.create_index([("expires_at", ASCENDING)])

    return _db


def get_db() -> Database:
    global _db
    if _db is None:
        _db = init_db()
    return _db
