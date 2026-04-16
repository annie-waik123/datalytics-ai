from datetime import datetime, timezone
from urllib.parse import quote

from authlib.integrations.starlette_client import OAuth
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, status
from fastapi.responses import RedirectResponse
from pymongo.database import Database

from app.api.deps import get_database
from app.core.config import get_settings
from app.models.schemas import LoginRequest, SignupRequest, StepResponse, VerifyOtpRequest, VerifyOtpResponse
from app.services.auth_service import (
    create_login_token,
    create_or_update_signup_user,
    get_user_by_email,
    mark_user_verified,
    validate_login_credentials,
)
from app.services.email_service import otp_email_template, send_html_email, welcome_email_template
from app.services.otp_service import create_otp, verify_otp

router = APIRouter()
settings = get_settings()

oauth = OAuth()
google_enabled = bool(settings.google_client_id and settings.google_client_secret)
if google_enabled:
    oauth.register(
        name="google",
        client_id=settings.google_client_id,
        client_secret=settings.google_client_secret,
        server_metadata_url="https://accounts.google.com/.well-known/openid-configuration",
        client_kwargs={"scope": "openid email profile"},
    )


def _dev_otp_payload(otp: str) -> str | None:
    return otp if settings.env.lower() == "development" else None


@router.post("/signup", response_model=StepResponse)
def signup(
    payload: SignupRequest,
    background_tasks: BackgroundTasks,
    db: Database = Depends(get_database),
):
    create_or_update_signup_user(db, payload.email, payload.password)
    otp_code, _ = create_otp(db, payload.email.lower(), purpose="signup")

    background_tasks.add_task(
        send_html_email,
        payload.email.lower(),
        "DATALYTICS OTP Verification",
        otp_email_template(otp_code, "signup"),
    )

    return StepResponse(
        message="Signup initiated. OTP sent to your email.",
        otp_required=True,
        purpose="signup",
        email=payload.email.lower(),
        dev_otp=_dev_otp_payload(otp_code),
    )


@router.post("/login", response_model=StepResponse)
def login(
    payload: LoginRequest,
    background_tasks: BackgroundTasks,
    db: Database = Depends(get_database),
):
    validate_login_credentials(db, payload.email, payload.password)
    otp_code, _ = create_otp(db, payload.email.lower(), purpose="login")

    background_tasks.add_task(
        send_html_email,
        payload.email.lower(),
        "DATALYTICS Login OTP",
        otp_email_template(otp_code, "login"),
    )

    return StepResponse(
        message="Credentials validated. OTP sent for 2-step login.",
        otp_required=True,
        purpose="login",
        email=payload.email.lower(),
        dev_otp=_dev_otp_payload(otp_code),
    )


@router.post("/verify-otp", response_model=VerifyOtpResponse)
def verify_otp_route(
    payload: VerifyOtpRequest,
    background_tasks: BackgroundTasks,
    db: Database = Depends(get_database),
):
    verify_otp(db, payload.email.lower(), payload.purpose, payload.otp)

    if payload.purpose == "signup":
        user = mark_user_verified(db, payload.email.lower())
        display_name = payload.email.split("@")[0]
        background_tasks.add_task(
            send_html_email,
            payload.email.lower(),
            "Welcome to DATALYTICS",
            welcome_email_template(display_name),
        )
        return VerifyOtpResponse(message=f"Account verified for {user['email']}. You can log in now.")

    access_token = create_login_token(payload.email.lower())
    return VerifyOtpResponse(message="Login successful.", access_token=access_token, token_type="bearer")


@router.get("/auth/google")
async def google_login(request: Request):
    if not google_enabled:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Google OAuth is not configured.",
        )
    return await oauth.google.authorize_redirect(request, settings.google_callback_url)


@router.get("/auth/google/callback")
async def google_callback(
    request: Request,
    background_tasks: BackgroundTasks,
    db: Database = Depends(get_database),
):
    if not google_enabled:
        return RedirectResponse(f"{settings.frontend_url}/login?error=google_not_configured")

    try:
        token = await oauth.google.authorize_access_token(request)
        user_info = token.get("userinfo")
        if not user_info:
            user_info = await oauth.google.parse_id_token(request, token)

        email = (user_info.get("email") or "").lower()
        google_id = user_info.get("sub")
        name = user_info.get("name") or email.split("@")[0]

        if not email:
            raise ValueError("Google account does not have a verified email.")

        existing_user = get_user_by_email(db, email)
        if not existing_user:
            db.users.insert_one(
                {
                    "email": email,
                    "password_hash": None,
                    "provider": "google",
                    "google_id": google_id,
                    "is_verified": True,
                    "created_at": datetime.now(timezone.utc),
                    "updated_at": datetime.now(timezone.utc),
                }
            )
            background_tasks.add_task(
                send_html_email,
                email,
                "Welcome to DATALYTICS",
                welcome_email_template(name),
            )
        else:
            db.users.update_one(
                {"_id": existing_user["_id"]},
                {
                    "$set": {
                        "provider": "google",
                        "google_id": google_id,
                        "is_verified": True,
                        "updated_at": datetime.now(timezone.utc),
                    }
                },
            )

        access_token = create_login_token(email)
        redirect_url = f"{settings.frontend_url}/auth/success?token={quote(access_token, safe='')}"
        return RedirectResponse(redirect_url)
    except Exception as exc:  # pragma: no cover
        error = quote(str(exc), safe="")
        return RedirectResponse(f"{settings.frontend_url}/login?error={error}")
