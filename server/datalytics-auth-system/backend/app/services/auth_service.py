from datetime import datetime, timezone

from bson import ObjectId
from fastapi import HTTPException, status
from pymongo.database import Database

from app.core.security import create_access_token, hash_secret, verify_secret


def public_user_dict(user_doc: dict) -> dict:
    return {
        "id": str(user_doc["_id"]),
        "email": user_doc["email"],
        "is_verified": bool(user_doc.get("is_verified", False)),
        "provider": user_doc.get("provider", "local"),
    }


def get_user_by_email(db: Database, email: str) -> dict | None:
    return db.users.find_one({"email": email.lower()})


def create_or_update_signup_user(db: Database, email: str, password: str) -> dict:
    normalized_email = email.lower()
    existing = get_user_by_email(db, normalized_email)

    if existing and existing.get("is_verified"):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Account already exists.")

    payload = {
        "email": normalized_email,
        "password_hash": hash_secret(password),
        "provider": "local",
        "is_verified": False,
        "updated_at": datetime.now(timezone.utc),
    }

    if existing:
        db.users.update_one({"_id": existing["_id"]}, {"$set": payload})
        return get_user_by_email(db, normalized_email) or existing

    payload["created_at"] = datetime.now(timezone.utc)
    inserted = db.users.insert_one(payload)
    return db.users.find_one({"_id": ObjectId(inserted.inserted_id)})


def validate_login_credentials(db: Database, email: str, password: str) -> dict:
    user = get_user_by_email(db, email)
    if not user or not user.get("password_hash"):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials.")

    if not verify_secret(password, user["password_hash"]):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials.")

    if not user.get("is_verified"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account not verified. Complete signup OTP verification first.",
        )
    return user


def mark_user_verified(db: Database, email: str) -> dict:
    user = get_user_by_email(db, email)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")

    db.users.update_one(
        {"_id": user["_id"]},
        {"$set": {"is_verified": True, "updated_at": datetime.now(timezone.utc)}},
    )
    return get_user_by_email(db, email) or user


def create_login_token(email: str) -> str:
    return create_access_token(subject=email.lower())

