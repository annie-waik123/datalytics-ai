from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, status
from pymongo.database import Database

from app.core.config import get_settings
from app.core.security import generate_otp, hash_secret, verify_secret


def create_otp(db: Database, email: str, purpose: str) -> tuple[str, datetime]:
    settings = get_settings()
    otp_code = generate_otp()
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=settings.otp_expiry_minutes)

    db.otps.update_many(
        {"email": email, "purpose": purpose, "consumed": False},
        {"$set": {"consumed": True}},
    )

    db.otps.insert_one(
        {
            "email": email,
            "purpose": purpose,
            "otp_hash": hash_secret(otp_code),
            "expires_at": expires_at,
            "attempts": 0,
            "consumed": False,
            "created_at": datetime.now(timezone.utc),
        }
    )
    return otp_code, expires_at


def verify_otp(db: Database, email: str, purpose: str, otp_value: str) -> None:
    settings = get_settings()

    otp_doc = db.otps.find_one(
        {"email": email, "purpose": purpose, "consumed": False},
        sort=[("created_at", -1)],
    )

    if not otp_doc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No active OTP found.")

    now = datetime.now(timezone.utc)
    if otp_doc["expires_at"] < now:
        db.otps.update_one({"_id": otp_doc["_id"]}, {"$set": {"consumed": True}})
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="OTP expired. Request a new one.")

    if otp_doc["attempts"] >= settings.otp_max_attempts:
        db.otps.update_one({"_id": otp_doc["_id"]}, {"$set": {"consumed": True}})
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many invalid attempts. Request a new OTP.",
        )

    if not verify_secret(otp_value, otp_doc["otp_hash"]):
        db.otps.update_one({"_id": otp_doc["_id"]}, {"$inc": {"attempts": 1}})
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid OTP.")

    db.otps.update_one({"_id": otp_doc["_id"]}, {"$set": {"consumed": True}})

