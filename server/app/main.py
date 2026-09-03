"""
FastAPI main application entry point.
Run from server/ directory: uvicorn app.main:app --reload --port 8000
"""
from __future__ import annotations

import uuid
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from dotenv import load_dotenv
load_dotenv(override=True)

import logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
log = logging.getLogger(__name__)

from app.api.v1.routes import data, upload, preprocess, train, predict, eda
from app.api.v1.routes import auth
from app.api.v1.routes import chatbot, recommendations, reports, payment
from app.api.v1.routes import activity, admin
from app.api.v1.routes import analyst, analytics
from app.core.database import ping_db


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup — test MongoDB
    ok = await ping_db()
    print(f"[startup] MongoDB connected: {ok}")
    yield
    # Shutdown
    print("[shutdown] Cleaning up...")


app = FastAPI(
    title="Datalytics API",
    description="FastAPI backend for Datalytics — ML + Chatbot + Insights Platform",
    version="3.0.0",
    lifespan=lifespan,
)

# ── CORS ──────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Session-ID"],
)


# ── Session-ID middleware ─────────────────────────────────────────────────────
@app.middleware("http")
async def session_middleware(request: Request, call_next):
    session_id = request.headers.get("X-Session-ID")
    if not session_id:
        session_id = str(uuid.uuid4())
        headers = list(request.scope.get("headers") or [])
        headers.append((b"x-session-id", session_id.encode("latin-1")))
        request.scope["headers"] = headers

    response = await call_next(request)
    response.headers["X-Session-ID"] = session_id
    return response


# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(upload.router,          prefix="/api", tags=["Upload"])
app.include_router(auth.router,            prefix="/api", tags=["Auth"])
app.include_router(data.router,            prefix="/api", tags=["Data"])
app.include_router(eda.router,             prefix="/api", tags=["EDA"])
app.include_router(preprocess.router,      prefix="/api", tags=["Preprocess"])
app.include_router(train.router,           prefix="/api", tags=["Train"])
app.include_router(predict.router,         prefix="/api", tags=["Predict"])
app.include_router(chatbot.router,         prefix="/api", tags=["Chatbot"])
app.include_router(recommendations.router, prefix="/api", tags=["Recommendations"])
app.include_router(reports.router,         prefix="/api", tags=["Reports"])
app.include_router(payment.router,         prefix="/api", tags=["Payment"])
app.include_router(activity.router,        prefix="/api", tags=["Activity"])
app.include_router(admin.router,           prefix="/api", tags=["Admin"])
app.include_router(analyst.router,         prefix="/api", tags=["AI Analyst"])
app.include_router(analytics.router,       prefix="/api", tags=["Natural-Language Analytics"])


@app.get("/")
async def root():
    return {"message": "Datalytics API v3.0 running. Docs at /docs"}


@app.get("/health")
async def health():
    db_ok = await ping_db()
    return {"status": "ok", "mongodb": "connected" if db_ok else "unavailable"}
