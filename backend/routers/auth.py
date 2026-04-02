from __future__ import annotations

import os
import re
import secrets
import smtplib
import ssl
from datetime import datetime, timedelta, timezone
from email.message import EmailMessage
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from database import get_db, ping_db

router = APIRouter()

EMAIL_REGEX = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
OTP_EXPIRY_MINUTES = int(os.getenv("AUTH_OTP_EXPIRY_MINUTES", "10"))
ALLOW_OTP_PREVIEW = os.getenv("AUTH_ALLOW_OTP_PREVIEW", "true").lower() == "true"
SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USERNAME = os.getenv("SMTP_USERNAME", "DatalyticsOfficial@gmail.com")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD") or os.getenv("SMTP_APP_PASSWORD", "")
AUTH_EMAIL_FROM = os.getenv("AUTH_EMAIL_FROM", "DatalyticsOfficial@gmail.com")

_memory_otps: dict[str, dict[str, Any]] = {}
_memory_users: dict[str, dict[str, Any]] = {}


class OTPRequest(BaseModel):
    uid: str
    name: str
    email: str
    role: str = "Data Analyst"
    provider: str = "password"


class OTPVerifyRequest(BaseModel):
    uid: str
    email: str
    otp: str
    name: str = ""
    role: str = "Data Analyst"


class WelcomeEmailRequest(BaseModel):
    uid: str
    name: str
    email: str
    role: str = "Data Analyst"
    provider: str = "google"
    firstTime: bool = False


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def normalize_email(email: str) -> str:
    return (email or "").strip().lower()


def validate_email_or_raise(email: str) -> str:
    normalized = normalize_email(email)
    if not EMAIL_REGEX.match(normalized):
        raise HTTPException(status_code=400, detail="Invalid email address.")
    return normalized


def generate_otp() -> str:
    return f"{secrets.randbelow(1_000_000):06d}"


def otp_key(uid: str, email: str) -> str:
    return f"{uid}:{normalize_email(email)}"


async def db_available() -> bool:
    return await ping_db()


async def get_user_record(uid: str, email: str) -> dict[str, Any] | None:
    if await db_available():
        db = get_db()
        record = await db["auth_users"].find_one(
            {"$or": [{"uid": uid}, {"email": normalize_email(email)}]},
            {"_id": 0},
        )
        return record

    return _memory_users.get(uid) or _memory_users.get(normalize_email(email))


async def save_user_record(payload: dict[str, Any]) -> dict[str, Any]:
    email = normalize_email(payload["email"])
    record = {
        "uid": payload["uid"],
        "name": payload.get("name") or "Datalytics User",
        "email": email,
        "role": payload.get("role") or "Data Analyst",
        "provider": payload.get("provider") or "password",
        "verified": bool(payload.get("verified")),
        "welcome_email_sent": bool(payload.get("welcome_email_sent")),
        "updated_at": utcnow(),
    }

    if await db_available():
        db = get_db()
        existing = await db["auth_users"].find_one(
            {"$or": [{"uid": record["uid"]}, {"email": email}]},
            {"_id": 0},
        ) or {}
        merged = {**existing, **record}
        merged.setdefault("created_at", existing.get("created_at", utcnow()))
        await db["auth_users"].update_one(
            {"uid": record["uid"]},
            {"$set": merged, "$setOnInsert": {"created_at": utcnow()}},
            upsert=True,
        )
        return merged

    existing = _memory_users.get(record["uid"]) or _memory_users.get(email) or {}
    merged = {**existing, **record}
    merged.setdefault("created_at", existing.get("created_at", utcnow()))
    _memory_users[record["uid"]] = merged
    _memory_users[email] = merged
    return merged


async def save_otp_record(payload: dict[str, Any]) -> None:
    email = normalize_email(payload["email"])
    record = {
        "uid": payload["uid"],
        "email": email,
        "name": payload.get("name") or "Datalytics User",
        "role": payload.get("role") or "Data Analyst",
        "provider": payload.get("provider") or "password",
        "code": payload["code"],
        "expires_at": payload["expires_at"],
        "used": False,
        "created_at": utcnow(),
    }

    if await db_available():
        db = get_db()
        await db["auth_otps"].update_many(
            {"uid": record["uid"], "email": email, "used": False},
            {"$set": {"used": True}},
        )
        await db["auth_otps"].insert_one(record)
        return

    _memory_otps[otp_key(record["uid"], email)] = record


async def get_active_otp(uid: str, email: str) -> dict[str, Any] | None:
    normalized_email = normalize_email(email)

    if await db_available():
        db = get_db()
        record = await db["auth_otps"].find_one(
            {
                "uid": uid,
                "email": normalized_email,
                "used": False,
                "expires_at": {"$gt": utcnow()},
            },
            sort=[("created_at", -1)],
        )
        if record:
            record.pop("_id", None)
        return record

    record = _memory_otps.get(otp_key(uid, normalized_email))
    if not record:
        return None
    if record["used"] or record["expires_at"] <= utcnow():
        return None
    return record


async def mark_otp_used(uid: str, email: str) -> None:
    normalized_email = normalize_email(email)

    if await db_available():
        db = get_db()
        await db["auth_otps"].update_many(
            {"uid": uid, "email": normalized_email, "used": False},
            {"$set": {"used": True}},
        )
        return

    record = _memory_otps.get(otp_key(uid, normalized_email))
    if record:
        record["used"] = True


def build_verification_email(name: str, otp: str) -> tuple[str, str, str]:
    subject = "Verify your account"
    text = (
        f"Hi {name},\n\n"
        f"Your Datalytics verification code is {otp}. It expires in {OTP_EXPIRY_MINUTES} minutes.\n\n"
        "Use this one-time password to finish creating your account."
    )
    html = f"""
    <div style="font-family:Arial,sans-serif;background:#060b18;padding:32px;color:#f8fafc">
      <div style="max-width:560px;margin:0 auto;background:linear-gradient(160deg,#0b1324,#111c33);border:1px solid rgba(255,255,255,0.08);border-radius:24px;padding:32px">
        <p style="margin:0 0 10px;font-size:12px;letter-spacing:0.3em;text-transform:uppercase;color:#7dd3fc">Datalytics</p>
        <h1 style="margin:0 0 14px;font-size:30px;line-height:1.1;color:#ffffff">Verify your account</h1>
        <p style="margin:0 0 18px;color:#cbd5e1;line-height:1.7">Hi {name}, your secure one-time password is below.</p>
        <div style="margin:24px 0;padding:18px 20px;border-radius:18px;background:rgba(255,255,255,0.05);border:1px solid rgba(125,211,252,0.18);text-align:center">
          <div style="font-size:34px;font-weight:700;letter-spacing:0.35em;color:#ffffff">{otp}</div>
          <div style="margin-top:10px;font-size:13px;color:#94a3b8">Expires in {OTP_EXPIRY_MINUTES} minutes</div>
        </div>
        <p style="margin:0;color:#94a3b8;line-height:1.7">If you did not request this account, you can safely ignore this email.</p>
      </div>
    </div>
    """
    return subject, text, html


def build_welcome_email(name: str, role: str) -> tuple[str, str, str]:
    subject = "Welcome to our AI Platform 🚀"
    text = (
        f"Hi {name},\n\n"
        "Welcome to Datalytics.\n"
        f"Your workspace is ready and your profile role is set to {role}.\n\n"
        "You can now explore dashboards, AI insights, and model workflows."
    )
    html = f"""
    <div style="font-family:Arial,sans-serif;background:#060b18;padding:32px;color:#f8fafc">
      <div style="max-width:560px;margin:0 auto;background:linear-gradient(160deg,#0b1324,#111c33);border:1px solid rgba(255,255,255,0.08);border-radius:24px;padding:32px">
        <p style="margin:0 0 10px;font-size:12px;letter-spacing:0.3em;text-transform:uppercase;color:#fbbf24">Datalytics</p>
        <h1 style="margin:0 0 14px;font-size:30px;line-height:1.1;color:#ffffff">Welcome to our AI Platform 🚀</h1>
        <p style="margin:0 0 18px;color:#cbd5e1;line-height:1.8">Hi {name}, your account is ready and your workspace role is set to <strong>{role}</strong>.</p>
        <div style="padding:18px 20px;border-radius:18px;background:rgba(255,255,255,0.05);border:1px solid rgba(249,115,22,0.22)">
          <p style="margin:0 0 8px;color:#ffffff;font-weight:600">What you can do next</p>
          <p style="margin:0;color:#94a3b8;line-height:1.7">Launch dashboards, upload datasets, explore AI insights, and move through your analytics pipeline with a premium onboarding flow.</p>
        </div>
      </div>
    </div>
    """
    return subject, text, html


def send_email(recipient: str, subject: str, text: str, html: str) -> dict[str, Any]:
    if not SMTP_PASSWORD:
        return {"sent": False, "mode": "preview"}

    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = AUTH_EMAIL_FROM
    message["To"] = recipient
    message.set_content(text)
    message.add_alternative(html, subtype="html")

    context = ssl.create_default_context()
    with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=20) as server:
        server.starttls(context=context)
        server.login(SMTP_USERNAME, SMTP_PASSWORD)
        server.send_message(message)

    return {"sent": True, "mode": "smtp"}


def public_delivery(send_result: dict[str, Any], otp_code: str = "") -> dict[str, Any]:
    payload = {
        "delivery": send_result.get("mode", "preview"),
        "smtp_configured": bool(SMTP_PASSWORD),
    }

    if send_result.get("mode") == "preview" and ALLOW_OTP_PREVIEW and otp_code:
        payload["preview_code"] = otp_code

    return payload


@router.post("/auth/request-otp")
async def request_signup_otp(payload: OTPRequest):
    email = validate_email_or_raise(payload.email)
    code = generate_otp()
    expires_at = utcnow() + timedelta(minutes=OTP_EXPIRY_MINUTES)

    await save_user_record(
        {
            "uid": payload.uid,
            "name": payload.name,
            "email": email,
            "role": payload.role,
            "provider": payload.provider,
            "verified": False,
        }
    )
    await save_otp_record(
        {
            "uid": payload.uid,
            "name": payload.name,
            "email": email,
            "role": payload.role,
            "provider": payload.provider,
            "code": code,
            "expires_at": expires_at,
        }
    )

    subject, text, html = build_verification_email(payload.name, code)
    delivery = send_email(email, subject, text, html)

    return {
        "ok": True,
        "expires_in_seconds": OTP_EXPIRY_MINUTES * 60,
        **public_delivery(delivery, code),
    }


@router.post("/auth/resend-otp")
async def resend_signup_otp(payload: OTPRequest):
    return await request_signup_otp(payload)


@router.post("/auth/verify-otp")
async def verify_signup_otp(payload: OTPVerifyRequest):
    email = validate_email_or_raise(payload.email)
    active_otp = await get_active_otp(payload.uid, email)

    if not active_otp:
        raise HTTPException(status_code=400, detail="OTP expired or unavailable. Please request a new code.")

    if active_otp["code"] != payload.otp.strip():
        raise HTTPException(status_code=400, detail="OTP incorrect. Please try again.")

    await mark_otp_used(payload.uid, email)

    existing_user = await get_user_record(payload.uid, email) or {}
    should_send_welcome = not existing_user.get("welcome_email_sent")

    updated_user = await save_user_record(
        {
            "uid": payload.uid,
            "name": payload.name or existing_user.get("name") or active_otp.get("name"),
            "email": email,
            "role": payload.role or existing_user.get("role") or active_otp.get("role"),
            "provider": existing_user.get("provider", "password"),
            "verified": True,
            "welcome_email_sent": existing_user.get("welcome_email_sent", False),
        }
    )

    delivery = {"mode": "skipped", "sent": False}
    if should_send_welcome:
        subject, text, html = build_welcome_email(updated_user["name"], updated_user["role"])
        delivery = send_email(email, subject, text, html)
        updated_user = await save_user_record({**updated_user, "welcome_email_sent": True})

    return {
        "ok": True,
        "verified": True,
        **public_delivery(delivery),
    }


@router.post("/auth/welcome-email")
async def send_welcome_email(payload: WelcomeEmailRequest):
    email = validate_email_or_raise(payload.email)
    existing_user = await get_user_record(payload.uid, email) or {}

    if existing_user.get("welcome_email_sent"):
        return {
            "ok": True,
            "delivery": "skipped",
            "smtp_configured": bool(SMTP_PASSWORD),
        }

    updated_user = await save_user_record(
        {
            "uid": payload.uid,
            "name": payload.name,
            "email": email,
            "role": payload.role,
            "provider": payload.provider,
            "verified": True,
            "welcome_email_sent": existing_user.get("welcome_email_sent", False),
        }
    )

    subject, text, html = build_welcome_email(updated_user["name"], updated_user["role"])
    delivery = send_email(email, subject, text, html)
    await save_user_record({**updated_user, "welcome_email_sent": True, "verified": True})

    return {
        "ok": True,
        **public_delivery(delivery),
    }
