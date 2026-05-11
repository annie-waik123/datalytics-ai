from __future__ import annotations

import os
import html
from datetime import datetime, timedelta
from typing import Any

import bcrypt
import jwt
from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.concurrency import run_in_threadpool
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, EmailStr, Field

from app.core.database import get_db
from app.api.v1.routes.auth import send_email


router = APIRouter()

ADMIN_EMAIL = os.getenv("ADMIN_EMAIL", "singhsangam5400@gmail.com").strip().lower()
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "admin12345")
ADMIN_PASSWORD_HASH = os.getenv("ADMIN_PASSWORD_HASH", "").strip()
SECRET_KEY = os.getenv("JWT_SECRET", "super-secret-key-datalytics")
ALGORITHM = "HS256"
ADMIN_TOKEN_EXPIRE_MINUTES = int(os.getenv("ADMIN_TOKEN_EXPIRE_MINUTES", "720"))

security = HTTPBearer(auto_error=False)


class AdminLoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)


class RoleUpdateRequest(BaseModel):
    role: str


class StatusUpdateRequest(BaseModel):
    status: str


class ContentRequest(BaseModel):
    title: str = Field(min_length=2)
    category: str = "General"
    body: str = ""
    status: str = "draft"
    metadata: dict[str, Any] = Field(default_factory=dict)


class CategoryRequest(BaseModel):
    name: str = Field(min_length=2)
    description: str = ""
    status: str = "active"


class PlanRequest(BaseModel):
    name: str = Field(min_length=2)
    price: float = 0
    currency: str = "INR"
    features: list[str] = Field(default_factory=list)
    diamonds: int = 0
    status: str = "active"


class AdminEmailRequest(BaseModel):
    userIds: list[str]
    subject: str
    body: str
    type: str = "announcement"


class AdminProfileRequest(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    avatar_url: str = ""


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, hashed_password: str) -> bool:
    if not hashed_password:
        return False
    return bcrypt.checkpw(password.encode("utf-8"), hashed_password.encode("utf-8"))


def serialize_doc(doc: dict[str, Any] | None) -> dict[str, Any] | None:
    if not doc:
        return None
    result: dict[str, Any] = {}
    for key, value in doc.items():
        if isinstance(value, ObjectId):
            result[key] = str(value)
        elif isinstance(value, datetime):
            result[key] = value.isoformat() + "Z"
        elif isinstance(value, list):
            result[key] = [serialize_doc(item) if isinstance(item, dict) else item for item in value]
        elif isinstance(value, dict):
            result[key] = serialize_doc(value)
        else:
            result[key] = value
    return result


def public_user(user: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": str(user.get("_id", "")),
        "name": user.get("name") or user.get("fullName") or "Datalytics User",
        "email": user.get("email", ""),
        "role": user.get("role", "user"),
        "status": user.get("status", "active"),
        "provider": user.get("provider", "email"),
        "avatar_url": user.get("avatar_url") or user.get("photoURL") or user.get("picture") or "",
        "plan": user.get("plan", "None"),
        "diamonds": user.get("diamonds", 0),
        "verified": bool(user.get("verified", False)),
        "created_at": (user.get("created_at") or user.get("joined_at") or user.get("last_login")),
        "last_login": user.get("last_login"),
    }


def create_admin_token(admin: dict[str, Any]) -> str:
    expires_at = datetime.utcnow() + timedelta(minutes=ADMIN_TOKEN_EXPIRE_MINUTES)
    payload = {
        "sub": admin["email"],
        "role": "admin",
        "name": admin.get("name") or admin.get("fullName") or "Admin",
        "exp": expires_at,
        "scope": "admin",
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


async def ensure_admin_user(password: str | None = None) -> dict[str, Any]:
    db = get_db()
    admin = await db.users.find_one({"email": ADMIN_EMAIL})
    now = datetime.utcnow()

    desired_hash = ADMIN_PASSWORD_HASH or hash_password(password or ADMIN_PASSWORD)
    if not admin:
        admin_doc = {
            "name": "Sangam Singh",
            "fullName": "Sangam Singh",
            "email": ADMIN_EMAIL,
            "password": desired_hash,
            "role": "admin",
            "status": "active",
            "provider": "email",
            "verified": True,
            "created_at": now,
            "joined_at": now,
            "last_login": now,
        }
        result = await db.users.insert_one(admin_doc)
        admin_doc["_id"] = result.inserted_id
        return admin_doc

    update: dict[str, Any] = {"role": "admin", "status": admin.get("status", "active")}
    if password and not admin.get("password"):
        update["password"] = hash_password(password)
    await db.users.update_one({"_id": admin["_id"]}, {"$set": update})
    admin.update(update)
    return admin


async def ensure_default_plans() -> None:
    """Strictly ensure only Free, Basic, Pro plans exist. Wipe and re-seed if needed."""
    db = get_db()
    REQUIRED_NAMES = {"Free", "Basic", "Pro"}

    existing = await db.subscription_plans.find({}, {"name": 1}).to_list(length=50)
    existing_names = {p.get("name", "") for p in existing}

    # If the correct 3 plans already exist, do nothing
    if REQUIRED_NAMES.issubset(existing_names) and len(existing) == 3:
        return

    # Wipe all old plans and re-seed with correct 3
    await db.subscription_plans.delete_many({})
    now = datetime.utcnow()
    plans = [
        {
            "name": "Free",
            "price": 0,
            "currency": "INR",
            "diamonds": 200,
            "features": [
                "Core dataset upload and analytics dashboard",
                "Basic dataset profiling and summary reports",
                "Single dashboard workspace",
                "Community AI query support",
            ],
            "status": "active",
            "created_at": now,
            "updated_at": now,
        },
        {
            "name": "Basic",
            "price": 200,
            "currency": "INR",
            "diamonds": 300,
            "features": [
                "Expanded dataset and dashboard quotas",
                "Automated model training and forecasts",
                "Custom charts and export-ready reports",
                "Faster analytics processing",
            ],
            "status": "active",
            "created_at": now,
            "updated_at": now,
        },
        {
            "name": "Pro",
            "price": 500,
            "currency": "INR",
            "diamonds": 800,
            "features": [
                "Full AI workspace with advanced insights",
                "Priority model runs and forecasting",
                "Unlimited dashboards and reports",
                "Dedicated analytics support",
            ],
            "status": "active",
            "created_at": now,
            "updated_at": now,
        },
    ]
    await db.subscription_plans.insert_many(plans)


# ── Public endpoint — no auth needed ─────────────────────────────────────────
@router.get("/plans")
async def public_list_plans():
    """Public endpoint — returns all active subscription plans for the user-facing pricing page."""
    db = get_db()
    await ensure_default_plans()
    plans = await db.subscription_plans.find({"status": "active"}).sort("price", 1).to_list(length=20)
    return {"plans": [serialize_doc(plan) for plan in plans]}



async def require_admin(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict[str, Any]:
    if not credentials:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Admin token required")
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Admin token expired")
    except jwt.PyJWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid admin token")

    email = str(payload.get("sub", "")).lower()
    role = payload.get("role")
    if email != ADMIN_EMAIL and role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")

    db = get_db()
    user = await db.users.find_one({"email": email})
    if not user or user.get("status", "active") == "banned":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin account disabled")
    if email != ADMIN_EMAIL and user.get("role") != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return user


@router.post("/admin/login")
async def admin_login(req: AdminLoginRequest):
    email = req.email.lower()
    if email != ADMIN_EMAIL:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="This email is not allowed for admin login")

    admin = await ensure_admin_user(req.password)
    if admin.get("status", "active") == "banned":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin account disabled")

    stored_hash = admin.get("password") or ADMIN_PASSWORD_HASH
    env_password_ok = not stored_hash and req.password == ADMIN_PASSWORD
    if not env_password_ok and not verify_password(req.password, stored_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid admin password")

    now = datetime.utcnow()
    await get_db().users.update_one({"email": ADMIN_EMAIL}, {"$set": {"last_login": now, "role": "admin"}})
    await get_db().activities.insert_one({
        "email": ADMIN_EMAIL,
        "action": "Login",
        "category": "auth",
        "details": "Admin logged in",
        "metadata": {"role": "admin"},
        "timestamp": now,
    })
    return {"token": create_admin_token(admin), "admin": public_user(admin)}


@router.post("/admin/logout")
async def admin_logout(admin: dict[str, Any] = Depends(require_admin)):
    await get_db().activities.insert_one({
        "email": admin.get("email", ADMIN_EMAIL),
        "action": "Logout",
        "category": "auth",
        "details": "Admin logged out",
        "metadata": {"role": "admin"},
        "timestamp": datetime.utcnow(),
    })
    return {"ok": True}


@router.get("/admin/me")
async def admin_me(admin: dict[str, Any] = Depends(require_admin)):
    return {"admin": public_user(admin)}


@router.patch("/admin/profile")
async def update_admin_profile(req: AdminProfileRequest, admin: dict[str, Any] = Depends(require_admin)):
    avatar_url = req.avatar_url.strip()
    update = {
        "name": req.name.strip(),
        "fullName": req.name.strip(),
        "avatar_url": avatar_url,
        "updated_at": datetime.utcnow(),
    }
    await get_db().users.update_one({"_id": admin["_id"]}, {"$set": update})
    admin.update(update)
    return {"admin": public_user(admin)}


@router.get("/admin/analytics")
async def admin_analytics(_: dict[str, Any] = Depends(require_admin)):
    db = get_db()
    now = datetime.utcnow()
    today = now.replace(hour=0, minute=0, second=0, microsecond=0)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    active_since = now - timedelta(days=7)

    total_users = await db.users.count_documents({})
    new_daily = await db.users.count_documents({"$or": [{"created_at": {"$gte": today}}, {"joined_at": {"$gte": today}}]})
    new_monthly = await db.users.count_documents({"$or": [{"created_at": {"$gte": month_start}}, {"joined_at": {"$gte": month_start}}]})
    active_users = await db.users.count_documents({"last_login": {"$gte": active_since}, "status": {"$ne": "banned"}})
    banned_users = await db.users.count_documents({"status": "banned"})
    admin_users = await db.users.count_documents({"role": "admin"})

    usage_pipeline = [
        {"$group": {"_id": "$category", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
    ]
    usage = await db.activities.aggregate(usage_pipeline).to_list(length=20)
    daily_pipeline = [
        {"$match": {"timestamp": {"$gte": now - timedelta(days=13)}}},
        {"$group": {"_id": {"$dateToString": {"format": "%Y-%m-%d", "date": "$timestamp"}}, "count": {"$sum": 1}}},
        {"$sort": {"_id": 1}},
    ]
    daily_usage = await db.activities.aggregate(daily_pipeline).to_list(length=20)
    total_content = await db.admin_contents.count_documents({})
    pending_uploads = await db.datasets.count_documents({"status": {"$in": ["pending", "review"]}})

    usage_items = [{"category": item["_id"] or "other", "count": item["count"]} for item in usage]
    if not any(item["category"] == "visualization" for item in usage_items):
        visual_count = await db.activities.count_documents({
            "$or": [
                {"category": {"$in": ["visualization", "visualizations"]}},
                {"action": {"$in": ["Visualize", "Chart", "Chart Created"]}},
            ]
        })
        usage_items.append({"category": "visualization", "count": visual_count})

    return {
        "cards": {
            "total_users": total_users,
            "new_users_daily": new_daily,
            "new_users_monthly": new_monthly,
            "active_users": active_users,
            "banned_users": banned_users,
            "admin_users": admin_users,
            "content_items": total_content,
            "pending_uploads": pending_uploads,
        },
        "usage_by_category": usage_items,
        "daily_usage": [{"date": item["_id"], "count": item["count"]} for item in daily_usage],
    }


@router.get("/admin/activity-logs")
async def admin_activity_logs(_: dict[str, Any] = Depends(require_admin)):
    db = get_db()
    logs = await db.activities.find({}).sort("timestamp", -1).to_list(length=250)
    return {
        "logs": [
            {
                "id": str(item.get("_id", "")),
                "email": item.get("email", ""),
                "action": item.get("action", "Activity"),
                "category": item.get("category", "other"),
                "details": item.get("details", ""),
                "metadata": serialize_doc(item.get("metadata", {})),
                "timestamp": item.get("timestamp").isoformat() + "Z" if item.get("timestamp") else "",
            }
            for item in logs
        ]
    }


@router.get("/admin/auth-logs")
async def admin_auth_logs(_: dict[str, Any] = Depends(require_admin)):
    db = get_db()
    logs = await db.activities.find({
        "category": "auth",
        "action": {"$in": ["Login", "Logout"]},
    }).sort("timestamp", -1).to_list(length=500)
    emails = list({item.get("email", "") for item in logs if item.get("email")})
    users = await db.users.find({"email": {"$in": emails}}, {"name": 1, "fullName": 1, "email": 1}).to_list(length=500)
    user_names = {
        user.get("email", ""): user.get("name") or user.get("fullName") or "Datalytics User"
        for user in users
    }
    return {
        "logs": [
            {
                "id": str(item.get("_id", "")),
                "name": user_names.get(item.get("email", ""), "Unknown User"),
                "email": item.get("email", ""),
                "action": item.get("action", "Login"),
                "details": item.get("details", ""),
                "timestamp": item.get("timestamp").isoformat() + "Z" if item.get("timestamp") else "",
            }
            for item in logs
        ]
    }


@router.get("/admin/users")
async def list_users(_: dict[str, Any] = Depends(require_admin)):
    users = await get_db().users.find({}, {"password": 0, "otp": 0, "resetOtp": 0}).sort("joined_at", -1).to_list(length=500)
    return {"users": [serialize_doc(public_user(user)) for user in users]}


@router.get("/admin/users/{user_id}")
async def get_user(user_id: str, _: dict[str, Any] = Depends(require_admin)):
    db = get_db()
    user = await db.users.find_one({"_id": ObjectId(user_id)}, {"password": 0, "otp": 0, "resetOtp": 0})
    if not user:
        raise HTTPException(404, "User not found")
    
    user_email = user.get("email", "")
    # Datasets may be stored with user_id as string or ObjectId, or by email
    datasets = await db.datasets.find({
        "$or": [
            {"user_id": user_id},
            {"user_id": ObjectId(user_id)},
            {"user_email": user_email},
            {"email": user_email},
        ]
    }, {"data": 0}).sort("uploaded_at", -1).to_list(length=100)
    
    user_data = serialize_doc(public_user(user))
    if user_data:
        user_data["purchase_history"] = serialize_doc({"list": user.get("purchase_history", [])})["list"]
        
    return {"user": user_data, "datasets": [serialize_doc(d) for d in datasets]}


@router.delete("/admin/users/{user_id}")
async def delete_user(user_id: str, _: dict[str, Any] = Depends(require_admin)):
    user = await get_db().users.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(404, "User not found")
    if user.get("email", "").lower() == ADMIN_EMAIL:
        raise HTTPException(400, "Primary admin cannot be deleted")
    await get_db().users.delete_one({"_id": ObjectId(user_id)})
    return {"ok": True}


@router.patch("/admin/users/{user_id}/status")
async def update_user_status(user_id: str, req: StatusUpdateRequest, _: dict[str, Any] = Depends(require_admin)):
    if req.status not in {"active", "banned", "inactive"}:
        raise HTTPException(400, "Status must be active, banned, or inactive")
    user = await get_db().users.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(404, "User not found")
    if user.get("email", "").lower() == ADMIN_EMAIL and req.status == "banned":
        raise HTTPException(400, "Primary admin cannot be banned")
    await get_db().users.update_one({"_id": ObjectId(user_id)}, {"$set": {"status": req.status, "updated_at": datetime.utcnow()}})
    return {"ok": True, "status": req.status}


@router.patch("/admin/users/{user_id}/role")
async def update_user_role(user_id: str, req: RoleUpdateRequest, _: dict[str, Any] = Depends(require_admin)):
    if req.role not in {"user", "admin"}:
        raise HTTPException(400, "Role must be user or admin")
    await get_db().users.update_one({"_id": ObjectId(user_id)}, {"$set": {"role": req.role, "updated_at": datetime.utcnow()}})
    return {"ok": True, "role": req.role}


@router.get("/admin/content")
async def list_content(_: dict[str, Any] = Depends(require_admin)):
    items = await get_db().admin_contents.find({}).sort("updated_at", -1).to_list(length=500)
    categories = await get_db().admin_categories.find({}).sort("name", 1).to_list(length=200)
    uploads = await get_db().datasets.find({}, {"data": 0}).sort("_id", -1).limit(100).to_list(length=100)
    return {
        "items": [serialize_doc(item) for item in items],
        "categories": [serialize_doc(item) for item in categories],
        "uploads": [serialize_doc(item) for item in uploads],
    }


@router.post("/admin/content")
async def create_content(req: ContentRequest, _: dict[str, Any] = Depends(require_admin)):
    now = datetime.utcnow()
    doc = {**req.model_dump(), "created_at": now, "updated_at": now}
    result = await get_db().admin_contents.insert_one(doc)
    doc["_id"] = result.inserted_id
    return {"item": serialize_doc(doc)}


@router.put("/admin/content/{content_id}")
async def update_content(content_id: str, req: ContentRequest, _: dict[str, Any] = Depends(require_admin)):
    update = {**req.model_dump(), "updated_at": datetime.utcnow()}
    await get_db().admin_contents.update_one({"_id": ObjectId(content_id)}, {"$set": update})
    item = await get_db().admin_contents.find_one({"_id": ObjectId(content_id)})
    return {"item": serialize_doc(item)}


@router.delete("/admin/content/{content_id}")
async def delete_content(content_id: str, _: dict[str, Any] = Depends(require_admin)):
    await get_db().admin_contents.delete_one({"_id": ObjectId(content_id)})
    return {"ok": True}


@router.post("/admin/categories")
async def create_category(req: CategoryRequest, _: dict[str, Any] = Depends(require_admin)):
    now = datetime.utcnow()
    doc = {**req.model_dump(), "created_at": now, "updated_at": now}
    result = await get_db().admin_categories.insert_one(doc)
    doc["_id"] = result.inserted_id
    return {"category": serialize_doc(doc)}


@router.put("/admin/categories/{category_id}")
async def update_category(category_id: str, req: CategoryRequest, _: dict[str, Any] = Depends(require_admin)):
    update = {**req.model_dump(), "updated_at": datetime.utcnow()}
    await get_db().admin_categories.update_one({"_id": ObjectId(category_id)}, {"$set": update})
    category = await get_db().admin_categories.find_one({"_id": ObjectId(category_id)})
    return {"category": serialize_doc(category)}


@router.delete("/admin/categories/{category_id}")
async def delete_category(category_id: str, _: dict[str, Any] = Depends(require_admin)):
    await get_db().admin_categories.delete_one({"_id": ObjectId(category_id)})
    return {"ok": True}


@router.patch("/admin/uploads/{dataset_id}/status")
async def update_upload_status(dataset_id: str, req: StatusUpdateRequest, _: dict[str, Any] = Depends(require_admin)):
    if req.status not in {"pending", "approved", "rejected", "review"}:
        raise HTTPException(400, "Status must be pending, approved, rejected, or review")
    await get_db().datasets.update_one({"_id": ObjectId(dataset_id)}, {"$set": {"status": req.status, "reviewed_at": datetime.utcnow()}})
    return {"ok": True, "status": req.status}


@router.get("/admin/payments")
async def list_payments(_: dict[str, Any] = Depends(require_admin)):
    await ensure_default_plans()
    users = await get_db().users.find({}, {"email": 1, "fullName": 1, "name": 1, "purchase_history": 1, "plan": 1}).to_list(length=1000)
    transactions: list[dict[str, Any]] = []
    for user in users:
        for entry in user.get("purchase_history", []) or []:
            transactions.append({
                **entry,
                "user_email": user.get("email"),
                "user_name": user.get("fullName") or user.get("name") or "User",
                "current_plan": user.get("plan", "None"),
            })

    standalone = await get_db().transactions.find({}).sort("timestamp", -1).to_list(length=500)
    transactions.extend(serialize_doc(item) for item in standalone)
    transactions = sorted(transactions, key=lambda item: str(item.get("timestamp", "")), reverse=True)
    plans = await get_db().subscription_plans.find({}).sort("price", 1).to_list(length=100)
    return {"transactions": [serialize_doc(item) for item in transactions], "plans": [serialize_doc(plan) for plan in plans]}


@router.post("/admin/plans")
async def create_plan(req: PlanRequest, _: dict[str, Any] = Depends(require_admin)):
    now = datetime.utcnow()
    doc = {**req.model_dump(), "created_at": now, "updated_at": now}
    result = await get_db().subscription_plans.insert_one(doc)
    doc["_id"] = result.inserted_id
    return {"plan": serialize_doc(doc)}


@router.put("/admin/plans/{plan_id}")
async def update_plan(plan_id: str, req: PlanRequest, _: dict[str, Any] = Depends(require_admin)):
    update = {**req.model_dump(), "updated_at": datetime.utcnow()}
    await get_db().subscription_plans.update_one({"_id": ObjectId(plan_id)}, {"$set": update})
    plan = await get_db().subscription_plans.find_one({"_id": ObjectId(plan_id)})
    return {"plan": serialize_doc(plan)}


@router.delete("/admin/plans/{plan_id}")
async def delete_plan(plan_id: str, _: dict[str, Any] = Depends(require_admin)):
    await get_db().subscription_plans.delete_one({"_id": ObjectId(plan_id)})
    return {"ok": True}


@router.post("/admin/emails/send")
async def admin_send_emails(req: AdminEmailRequest, _: dict[str, Any] = Depends(require_admin)):
    db = get_db()
    if "all" in req.userIds:
        users = await db.users.find({"email": {"$exists": True, "$ne": ""}}).to_list(length=10000)
    else:
        user_ids = [ObjectId(uid) for uid in req.userIds if uid != "all"]
        users = await db.users.find({"_id": {"$in": user_ids}, "email": {"$exists": True, "$ne": ""}}).to_list(length=10000)

    emails = [u["email"] for u in users if u.get("email")]
    if not emails:
        raise HTTPException(400, "No valid users found to send emails to.")

    theme_map = {
        "announcement": {
            "accent": "#0891b2",
            "soft": "#ecfeff",
            "border": "#a5f3fc",
            "title": "Announcement",
            "badge": "Datalytics News",
        },
        "warning": {
            "accent": "#f59e0b",
            "soft": "#fffbeb",
            "border": "#fde68a",
            "title": "Warning Mail",
            "badge": "Action Required",
        },
        "offer": {
            "accent": "#10b981",
            "soft": "#ecfdf5",
            "border": "#a7f3d0",
            "title": "Offer / Update",
            "badge": "New Update",
        },
    }
    theme = theme_map.get(req.type.lower(), theme_map["announcement"])
    subject = html.escape(req.subject.strip())
    body = html.escape(req.body.strip())
    
    html_template = f"""
    <div style="font-family: Inter, Arial, sans-serif; background: #f8fafc; padding: 28px;">
      <div style="max-width: 620px; margin: 0 auto; background: #ffffff; border: 1px solid {theme['border']}; border-radius: 18px; overflow: hidden; box-shadow: 0 18px 50px rgba(15, 23, 42, 0.08);">
        <div style="height: 8px; background: {theme['accent']};"></div>
        <div style="background: {theme['soft']}; padding: 22px 26px; border-bottom: 1px solid {theme['border']};">
          <div style="display: inline-block; color: {theme['accent']}; border: 1px solid {theme['border']}; border-radius: 999px; padding: 5px 10px; font-size: 11px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase;">{theme['badge']}</div>
          <h2 style="margin: 14px 0 0; color: #0f172a; font-size: 24px; line-height: 1.25;">{{{{subject}}}}</h2>
          <p style="margin: 7px 0 0; color: #64748b; font-size: 13px;">{theme['title']} from Datalytics Admin</p>
        </div>
        <div style="padding: 26px; color: #334155; line-height: 1.7; font-size: 15px; white-space: pre-wrap;">{{{{body}}}}</div>
        <div style="margin: 0 26px 24px; padding-top: 18px; border-top: 1px solid #e2e8f0;">
          <p style="margin: 0; font-size: 12px; color: #94a3b8;">Sent from Datalytics Admin</p>
        </div>
      </div>
    </div>
    """
    html_content = html_template.replace("{{subject}}", subject).replace("{{body}}", body)

    sent = 0
    failed = []
    for email in emails:
        try:
            send_email(email, req.subject.strip(), html_content)
            sent += 1
        except Exception as exc:
            print(f"[EMAIL] Failed to send to {email}: {exc}")
            failed.append(email)

    if sent == 0 and emails:
        raise HTTPException(
            status_code=500,
            detail=f"All emails failed to send. Error: check server SMTP configuration. Failed recipients: {', '.join(failed[:3])}"
        )

    return {"ok": True, "count": sent, "failed": len(failed)}
