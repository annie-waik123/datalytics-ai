from fastapi import APIRouter, Depends, Body
from app.api.v1.routes.payment import get_current_user_email
from app.services.activity_service import (
    get_user_activities_summary,
    log_activity,
    reset_user_activities,
    get_user_kpi_counts,
    get_last_session,
)

router = APIRouter()


@router.get("/user-activities")
async def get_user_activities(email: str = Depends(get_current_user_email)):
    """
    Returns the user's workflow activities categorized by
    assets (datasets, models, reports, etc) and the heatmap summary.
    """
    summary = await get_user_activities_summary(email)
    return summary


@router.get("/user-activities/last-session")
async def get_last_pipeline_session(email: str = Depends(get_current_user_email)):
    """
    Returns the most recent dataset session: last upload details + all
    pipeline actions taken after that upload (real MongoDB data).
    """
    session = await get_last_session(email)
    return session


@router.get("/user-activities/kpis")
async def get_kpis(email: str = Depends(get_current_user_email)):
    """
    Returns aggregated KPI counts from MongoDB for the current user.
    Used by the profile page to show accurate totals.
    """
    counts = await get_user_kpi_counts(email)
    return counts


@router.post("/user-activities/log")
async def log_user_activity(
    email: str = Depends(get_current_user_email),
    payload: dict = Body(...),
):
    """
    Log a single activity event for the authenticated user.
    Expected body: { action, category, details?, metadata? }
    """
    await log_activity(
        email=email,
        action=payload.get("action", "unknown"),
        category=payload.get("category", "other"),
        details=payload.get("details", ""),
        metadata=payload.get("metadata", {}),
    )
    return {"ok": True}


@router.delete("/user-activities/reset")
async def reset_activities(email: str = Depends(get_current_user_email)):
    """
    Hard-delete ALL activity records for the authenticated user from MongoDB.
    Called when user wants a fresh start from zero.
    """
    deleted = await reset_user_activities(email)
    return {"ok": True, "deleted_count": deleted}
