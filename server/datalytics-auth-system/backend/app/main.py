from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.sessions import SessionMiddleware

from app.api.routes import auth, users
from app.core.config import get_settings
from app.core.database import init_db

settings = get_settings()

app = FastAPI(
    title=settings.app_name,
    version="1.0.0",
    description="FastAPI auth backend with OTP + JWT + Google OAuth for DATALYTICS.",
)

app.add_middleware(
    SessionMiddleware,
    secret_key=settings.session_secret,
    same_site="lax",
    https_only=False,
)

allowed_origins = {settings.frontend_url}
if "localhost" in settings.frontend_url:
    allowed_origins.add(settings.frontend_url.replace("localhost", "127.0.0.1"))
elif "127.0.0.1" in settings.frontend_url:
    allowed_origins.add(settings.frontend_url.replace("127.0.0.1", "localhost"))

app.add_middleware(
    CORSMiddleware,
    allow_origins=list(allowed_origins),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="", tags=["Authentication"])
app.include_router(users.router, prefix="/users", tags=["Users"])


@app.on_event("startup")
def startup() -> None:
    init_db()


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "service": "datalytics-auth-api"}
