import os
import random
import smtplib
import ssl
from datetime import datetime, timedelta, timezone
from email.message import EmailMessage

import jwt
from fastapi import APIRouter, HTTPException, status, BackgroundTasks, Depends
from fastapi.concurrency import run_in_threadpool
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, EmailStr
import bcrypt
import requests as py_requests
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token
from app.core.database import get_db

# Pre-create a persistent session and transport for faster Google verification
# This caches Google's public keys and reuses connections, reducing login time from ~10s to ~1s.
_auth_session = py_requests.Session()
GOOGLE_AUTH_REQUEST = google_requests.Request(session=_auth_session)

router = APIRouter()

SECRET_KEY = os.getenv("JWT_SECRET", "super-secret-key-datalytics")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 1440

GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "").strip()

SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USERNAME = os.getenv("SMTP_USERNAME", "datalyticsofficial@gmail.com")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "mxfnibjofpmxghpp")

class SignupRequest(BaseModel):
    fullName: str
    email: EmailStr
    password: str
    confirmPassword: str
    acceptedTerms: bool = False

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class OTPVerifyRequest(BaseModel):
    email: EmailStr
    otp: str

class ForgotPasswordRequest(BaseModel):
    email: EmailStr

class ResetPasswordRequest(BaseModel):
    email: EmailStr
    otp: str
    password: str
    confirmPassword: str

class GoogleLoginRequest(BaseModel):
    token: str

class ChangePasswordOtpRequest(BaseModel):
    oldPassword: str

class ChangePasswordConfirmRequest(BaseModel):
    oldPassword: str
    newPassword: str
    confirmPassword: str
    otp: str

security = HTTPBearer(auto_error=False)

def get_password_hash(password: str) -> str:
    pwd_bytes = password.encode('utf-8')
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(pwd_bytes, salt)
    return hashed.decode('utf-8')

def verify_password(plain_password: str, hashed_password: str) -> bool:
    password_byte_enc = plain_password.encode('utf-8')
    hashed_password_byte_enc = hashed_password.encode('utf-8')
    return bcrypt.checkpw(password_byte_enc, hashed_password_byte_enc)

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def get_current_user_email(credentials: HTTPAuthorizationCredentials = Depends(security)) -> str:
    if not credentials:
        raise HTTPException(401, "Not authenticated")
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        email = payload.get("sub")
        if not email:
            raise HTTPException(401, "Invalid token payload")
        return email
    except jwt.ExpiredSignatureError:
        raise HTTPException(401, "Token expired")
    except jwt.PyJWTError:
        raise HTTPException(401, "Invalid token")


async def log_auth_activity(email: str, action: str, details: str = "") -> None:
    if not email:
        return
    await get_db().activities.insert_one({
        "email": email,
        "action": action,
        "category": "auth",
        "details": details,
        "metadata": {},
        "timestamp": datetime.utcnow(),
    })

def build_otp_email(otp: str):
    return f"""
    <!DOCTYPE html>
    <html lang="en">
    <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
    <body style="margin: 0; padding: 20px; background-color: #06090f; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #ffffff;">
      <div style="max-width: 580px; margin: 0 auto; background-color: #06090f;">

        <!-- Top Bar -->
        <div style="background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); height: 4px; border-radius: 4px 4px 0 0; margin-bottom: 0;"></div>

        <!-- Header -->
        <table width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid rgba(249, 115, 22, 0.25); border-top: none; border-radius: 0 0 0 0; background-color: rgba(10, 14, 23, 0.95); margin-bottom: 0;">
          <tr>
            <td style="padding: 16px 24px;">
              <!-- 3-Bar Equalizer Logo -->
              <table cellpadding="0" cellspacing="0" style="display: inline-table; vertical-align: middle; margin-right: 10px;">
                <tr>
                  <td valign="bottom" style="padding: 0 2px;">
                    <div style="width: 5px; height: 14px; background: linear-gradient(180deg, #ffb347 0%, #f97316 60%, #ea580c 100%); border-radius: 2px 2px 1px 1px; box-shadow: 0 0 6px rgba(249,115,22,0.7);"></div>
                  </td>
                  <td valign="bottom" style="padding: 0 2px;">
                    <div style="width: 5px; height: 22px; background: linear-gradient(180deg, #ffb347 0%, #f97316 60%, #ea580c 100%); border-radius: 2px 2px 1px 1px; box-shadow: 0 0 6px rgba(249,115,22,0.7);"></div>
                  </td>
                  <td valign="bottom" style="padding: 0 2px;">
                    <div style="width: 5px; height: 10px; background: linear-gradient(180deg, #ffb347 0%, #f97316 60%, #ea580c 100%); border-radius: 2px 2px 1px 1px; box-shadow: 0 0 6px rgba(249,115,22,0.7);"></div>
                  </td>
                </tr>
              </table>
              <span style="font-weight: 900; font-size: 19px; color: #ffffff; vertical-align: middle;">Data<span style="color: #f97316;">lytics</span></span>
            </td>
            <td align="right" style="padding: 16px 24px;">
              <span style="display: inline-block; background-color: rgba(34, 197, 94, 0.1); border: 1px solid rgba(34, 197, 94, 0.3); border-radius: 20px; padding: 4px 12px; font-size: 10px; font-weight: 700; color: #22c55e; letter-spacing: 1px; text-transform: uppercase;">
                &#11044; SECURE
              </span>
            </td>
          </tr>
        </table>

        <!-- OTP Hero -->
        <div style="border: 1px solid rgba(249, 115, 22, 0.2); border-top: none; border-bottom: none; padding: 40px 30px 30px; text-align: center; background: linear-gradient(180deg, rgba(249,115,22,0.06) 0%, rgba(10,14,23,0.98) 100%);">
          <div style="font-size: 11px; font-weight: 700; letter-spacing: 2px; color: #64748b; text-transform: uppercase; margin-bottom: 16px;">ACCOUNT VERIFICATION CODE</div>
          <h1 style="font-size: 28px; font-weight: 900; color: #ffffff; margin: 0 0 10px; letter-spacing: -0.5px;">Your One-Time Password</h1>
          <p style="font-size: 13px; line-height: 1.6; color: #94a3b8; margin: 0 auto 30px auto; max-width: 400px;">Enter this code to complete your authentication. Valid for <strong style="color: #f97316;">10 minutes</strong>.</p>

          <!-- OTP Box -->
          <div style="background: rgba(249, 115, 22, 0.06); border: 2px dashed rgba(249, 115, 22, 0.45); padding: 28px 20px; border-radius: 18px; margin-bottom: 20px; display: inline-block; width: 80%; max-width: 380px;">
            <div style="font-size: 10px; font-weight: 700; letter-spacing: 3px; color: #64748b; text-transform: uppercase; margin-bottom: 12px;">ONE-TIME PASSWORD</div>
            <div style="font-size: 50px; font-weight: 900; letter-spacing: 14px; color: #f97316; text-shadow: 0 0 30px rgba(249,115,22,0.5); padding-left: 14px;">{otp}</div>
          </div>

          <!-- Security Note -->
          <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07); border-radius: 12px; padding: 14px 18px; text-align: left; max-width: 90%; margin: 0 auto;">
            <p style="color: #64748b; font-size: 12px; margin: 0; line-height: 1.6;">
              &#128274; <strong style="color: #94a3b8;">Security notice:</strong> Never share this code. DATALYTICS will never ask for your OTP via phone or chat.
            </p>
          </div>
        </div>

        <!-- Features Section -->
        <div style="border: 1px solid rgba(249, 115, 22, 0.2); border-top: none; border-radius: 0 0 12px 12px; padding: 24px 30px; background-color: rgba(10, 14, 23, 0.95);">

          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 16px;">
            <tr>
              <td width="48%" valign="top" style="background: rgba(249,115,22,0.05); border: 1px solid rgba(249,115,22,0.15); border-radius: 12px; padding: 14px;">
                <div style="font-size: 16px; margin-bottom: 6px;">&#128193;</div>
                <div style="font-size: 12px; font-weight: 800; color: #ffffff; margin-bottom: 4px;">Dataset Upload &amp; EDA</div>
                <div style="font-size: 11px; color: #94a3b8; line-height: 1.4;">Upload CSV/Excel. Auto-detect types, nulls &amp; distributions instantly.</div>
              </td>
              <td width="4%"></td>
              <td width="48%" valign="top" style="background: rgba(249,115,22,0.05); border: 1px solid rgba(249,115,22,0.15); border-radius: 12px; padding: 14px;">
                <div style="font-size: 16px; margin-bottom: 6px;">&#129504;</div>
                <div style="font-size: 12px; font-weight: 800; color: #ffffff; margin-bottom: 4px;">AutoML Predictions</div>
                <div style="font-size: 11px; color: #94a3b8; line-height: 1.4;">Train &amp; compare 15+ ML models. Best model auto-selected.</div>
              </td>
            </tr>
          </table>

          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 20px;">
            <tr>
              <td width="48%" valign="top" style="background: rgba(249,115,22,0.05); border: 1px solid rgba(249,115,22,0.15); border-radius: 12px; padding: 14px;">
                <div style="font-size: 16px; margin-bottom: 6px;">&#129302;</div>
                <div style="font-size: 12px; font-weight: 800; color: #ffffff; margin-bottom: 4px;">AI Insights &amp; Chat</div>
                <div style="font-size: 11px; color: #94a3b8; line-height: 1.4;">LLAMA3 + Groq-powered AI explains your data. Ask anything.</div>
              </td>
              <td width="4%"></td>
              <td width="48%" valign="top" style="background: rgba(249,115,22,0.05); border: 1px solid rgba(249,115,22,0.15); border-radius: 12px; padding: 14px;">
                <div style="font-size: 16px; margin-bottom: 6px;">&#128202;</div>
                <div style="font-size: 12px; font-weight: 800; color: #ffffff; margin-bottom: 4px;">Viz &amp; Power BI</div>
                <div style="font-size: 11px; color: #94a3b8; line-height: 1.4;">Interactive charts &amp; auto-built Power BI dashboards.</div>
              </td>
            </tr>
          </table>

          <!-- Footer -->
          <div style="border-top: 1px solid rgba(255,255,255,0.05); padding-top: 16px; text-align: center;">
            <p style="color: #475569; font-size: 11px; margin: 0;">&copy; 2026 DATALYTICS AI Platform. All rights reserved.</p>
          </div>
        </div>

        <!-- Bottom Bar -->
        <div style="background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); height: 4px; border-radius: 0 0 4px 4px; margin-top: 2px;"></div>

      </div>
    </body>
    </html>
    """

def build_welcome_email(name: str):
    first_name = name.split()[0] if name else "User"
    return f"""
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 20px; background-color: #06090f; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #ffffff;">
      <!-- Main Container -->
      <div style="max-width: 600px; margin: 0 auto; background-color: #06090f;">
        
        <!-- Top Bar -->
        <table width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid rgba(249, 115, 22, 0.2); border-radius: 12px; margin-bottom: 16px; background-color: rgba(10, 14, 23, 0.8);">
          <tr>
            <td style="padding: 12px 20px;">
              <!-- 3-Bar Equalizer Logo -->
              <table cellpadding="0" cellspacing="0" style="display: inline-table; vertical-align: middle; margin-right: 10px;">
                <tr>
                  <td valign="bottom" style="padding: 0 2px;">
                    <div style="width: 5px; height: 14px; background: linear-gradient(180deg, #ffb347 0%, #f97316 60%, #ea580c 100%); border-radius: 2px 2px 1px 1px; box-shadow: 0 0 6px rgba(249,115,22,0.7);"></div>
                  </td>
                  <td valign="bottom" style="padding: 0 2px;">
                    <div style="width: 5px; height: 22px; background: linear-gradient(180deg, #ffb347 0%, #f97316 60%, #ea580c 100%); border-radius: 2px 2px 1px 1px; box-shadow: 0 0 6px rgba(249,115,22,0.7);"></div>
                  </td>
                  <td valign="bottom" style="padding: 0 2px;">
                    <div style="width: 5px; height: 10px; background: linear-gradient(180deg, #ffb347 0%, #f97316 60%, #ea580c 100%); border-radius: 2px 2px 1px 1px; box-shadow: 0 0 6px rgba(249,115,22,0.7);"></div>
                  </td>
                </tr>
              </table>
              <span style="font-weight: 900; font-size: 19px; color: #ffffff; vertical-align: middle;">Data<span style="color: #f97316;">lytics</span></span>
            </td>
            <td align="right" style="padding: 12px 20px;">
              <span style="display: inline-block; background-color: rgba(34, 197, 94, 0.1); border: 1px solid rgba(34, 197, 94, 0.3); border-radius: 20px; padding: 4px 10px; font-size: 10px; font-weight: 700; color: #22c55e; letter-spacing: 1px; text-transform: uppercase;">
                <span style="display: inline-block; width: 6px; height: 6px; background-color: #22c55e; border-radius: 50%; margin-right: 4px; vertical-align: middle;"></span> <span style="vertical-align: middle;">LIVE</span>
              </span>
            </td>
          </tr>
        </table>

        <!-- Hero Section -->
        <div style="border: 1px solid rgba(255, 255, 255, 0.05); border-radius: 16px; padding: 40px 30px; text-align: center; margin-bottom: 16px; background: linear-gradient(180deg, rgba(10, 14, 23, 0.8) 0%, rgba(6, 9, 15, 0.9) 100%);">
          <div style="font-size: 11px; font-weight: 700; letter-spacing: 2px; color: #38bdf8; text-transform: uppercase; margin-bottom: 20px;">
            ACCOUNT READY — DATALYTICS WORKSPACE
          </div>
          <h1 style="font-size: 38px; font-weight: 900; line-height: 1.1; margin: 0 0 20px 0; color: #ffffff; letter-spacing: -1px;">
            Welcome<br/>
            <span style="color: #f97316;">{first_name}</span>
          </h1>
          <p style="font-size: 14px; line-height: 1.6; color: #94a3b8; margin: 0 auto 30px auto; max-width: 480px;">
            Your Datalytics account is ready. Upload datasets, profile your data, build visualizations, train models, ask AI questions, and generate reports from one workspace.
          </p>
          <a href="http://localhost:5000" style="display: inline-block; background: linear-gradient(135deg, #f97316, #ea580c); color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 700; padding: 14px 28px; border-radius: 30px; box-shadow: 0 4px 20px rgba(249, 115, 22, 0.4);">
            ✦ Start Analyzing Now
          </a>
        </div>

        <div style="border: 1px solid rgba(56, 189, 248, 0.18); border-radius: 16px; padding: 22px; background: linear-gradient(135deg, rgba(14, 165, 233, 0.10), rgba(249, 115, 22, 0.08)); margin-bottom: 16px;">
          <div style="font-size: 14px; font-weight: 900; color: #ffffff; margin-bottom: 10px;">What you can do next</div>
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="padding: 8px 0; color: #cbd5e1; font-size: 13px;">• Upload CSV, Excel, JSON, database, or API data sources.</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #cbd5e1; font-size: 13px;">• Clean, prepare, and explore your dataset with smart profiling.</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #cbd5e1; font-size: 13px;">• Create charts, dashboards, predictions, recommendations, and export-ready reports.</td>
            </tr>
          </table>
        </div>

        <!-- Stats Section -->
        <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 16px;">
          <tr>
            <td width="32%" style="border: 1px solid rgba(255, 255, 255, 0.05); border-radius: 12px; background-color: rgba(10, 14, 23, 0.6); padding: 20px 10px; text-align: center;">
              <div style="font-size: 26px; font-weight: 900; color: #f97316; margin-bottom: 4px;">48K+</div>
              <div style="font-size: 9px; font-weight: 700; color: #64748b; letter-spacing: 1px; text-transform: uppercase;">ROWS PROCESSED</div>
            </td>
            <td width="2%"></td>
            <td width="32%" style="border: 1px solid rgba(255, 255, 255, 0.05); border-radius: 12px; background-color: rgba(10, 14, 23, 0.6); padding: 20px 10px; text-align: center;">
              <div style="font-size: 26px; font-weight: 900; color: #f97316; margin-bottom: 4px;">94%</div>
              <div style="font-size: 9px; font-weight: 700; color: #64748b; letter-spacing: 1px; text-transform: uppercase;">MODEL ACCURACY</div>
            </td>
            <td width="2%"></td>
            <td width="32%" style="border: 1px solid rgba(255, 255, 255, 0.05); border-radius: 12px; background-color: rgba(10, 14, 23, 0.6); padding: 20px 10px; text-align: center;">
              <div style="font-size: 26px; font-weight: 900; color: #f97316; margin-bottom: 4px;">+12.4%</div>
              <div style="font-size: 9px; font-weight: 700; color: #64748b; letter-spacing: 1px; text-transform: uppercase;">INSIGHT GROWTH</div>
            </td>
          </tr>
        </table>

        <!-- Live Data Overview -->
        <div style="border: 1px solid rgba(255, 255, 255, 0.05); border-radius: 16px; padding: 20px; background-color: rgba(10, 14, 23, 0.6); margin-bottom: 16px;">
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 20px;">
            <tr>
              <td>
                <div style="font-size: 14px; font-weight: 800; color: #ffffff;">
                  <span style="display: inline-block; width: 12px; height: 12px; background: linear-gradient(135deg, #3b82f6, #8b5cf6, #ec4899); border-radius: 3px; vertical-align: middle; margin-right: 6px;"></span>
                  <span style="vertical-align: middle;">Live Data Overview</span>
                </div>
              </td>
              <td align="right">
                <span style="display: inline-block; background-color: rgba(34, 197, 94, 0.1); border: 1px solid rgba(34, 197, 94, 0.3); border-radius: 20px; padding: 4px 8px; font-size: 9px; font-weight: 700; color: #22c55e; letter-spacing: 1px; text-transform: uppercase;">
                  + REAL-TIME
                </span>
              </td>
            </tr>
          </table>
          
          <!-- Fake Bar Chart -->
          <table width="100%" cellpadding="0" cellspacing="0" height="80" style="margin-bottom: 8px;">
            <tr>
              <td valign="bottom" width="14%"><div style="background-color: #f97316; height: 32px; border-radius: 4px 4px 0 0; margin: 0 4px;"></div></td>
              <td valign="bottom" width="14%"><div style="background-color: #38bdf8; height: 28px; border-radius: 4px 4px 0 0; margin: 0 4px;"></div></td>
              <td valign="bottom" width="14%"><div style="background-color: #c084fc; height: 24px; border-radius: 4px 4px 0 0; margin: 0 4px;"></div></td>
              <td valign="bottom" width="14%"><div style="background-color: #22c55e; height: 36px; border-radius: 4px 4px 0 0; margin: 0 4px;"></div></td>
              <td valign="bottom" width="14%"><div style="background-color: #ef4444; height: 64px; border-radius: 4px 4px 0 0; margin: 0 4px;"></div></td>
              <td valign="bottom" width="14%"><div style="background-color: #fbbf24; height: 30px; border-radius: 4px 4px 0 0; margin: 0 4px;"></div></td>
              <td valign="bottom" width="14%"><div style="background-color: #38bdf8; height: 34px; border-radius: 4px 4px 0 0; margin: 0 4px;"></div></td>
            </tr>
          </table>
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td width="14%" align="center" style="font-size: 9px; color: #64748b; font-weight: 700;">JAN</td>
              <td width="14%" align="center" style="font-size: 9px; color: #64748b; font-weight: 700;">FEB</td>
              <td width="14%" align="center" style="font-size: 9px; color: #64748b; font-weight: 700;">MAR</td>
              <td width="14%" align="center" style="font-size: 9px; color: #64748b; font-weight: 700;">APR</td>
              <td width="14%" align="center" style="font-size: 9px; color: #64748b; font-weight: 700;">MAY</td>
              <td width="14%" align="center" style="font-size: 9px; color: #64748b; font-weight: 700;">JUN</td>
              <td width="14%" align="center" style="font-size: 9px; color: #64748b; font-weight: 700;">JUL</td>
            </tr>
          </table>
        </div>

        <!-- 10-Step AI Pipeline -->
        <div style="border: 1px solid rgba(255, 255, 255, 0.05); border-radius: 16px; padding: 20px; background-color: rgba(10, 14, 23, 0.6); margin-bottom: 16px;">
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 20px;">
            <tr>
              <td>
                <div style="font-size: 14px; font-weight: 800; color: #ffffff;">⚡ Your 10-Step AI Pipeline</div>
              </td>
              <td align="right">
                <span style="display: inline-block; background-color: rgba(34, 197, 94, 0.1); border: 1px solid rgba(34, 197, 94, 0.3); border-radius: 20px; padding: 4px 8px; font-size: 9px; font-weight: 700; color: #22c55e; letter-spacing: 1px;">
                  0 / 10 DONE
                </span>
              </td>
            </tr>
          </table>
          
          <div style="font-size: 9px; font-weight: 700; color: #f97316; letter-spacing: 2px; text-transform: uppercase; margin-bottom: 15px; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 8px;">PIPELINE MODULES</div>
          
          <!-- Pipeline Grid -->
          <table width="100%" cellpadding="0" cellspacing="0" style="table-layout: fixed; margin-bottom: 15px;">
            <tr>
              <td align="center" valign="top">
                <div style="width: 40px; height: 40px; border-radius: 50%; background-color: rgba(34, 197, 94, 0.1); border: 2px solid #22c55e; margin: 0 auto 8px auto; text-align: center; line-height: 40px; font-size: 18px;">📁</div>
                <div style="font-size: 10px; font-weight: 700; color: #e2e8f0;">Dataset<br/>Upload</div>
              </td>
              <td align="center" valign="top">
                <div style="width: 40px; height: 40px; border-radius: 50%; background-color: rgba(34, 197, 94, 0.1); border: 2px solid #22c55e; margin: 0 auto 8px auto; text-align: center; line-height: 40px; font-size: 18px;">⚙️</div>
                <div style="font-size: 10px; font-weight: 700; color: #e2e8f0;">Data<br/>Prep</div>
              </td>
              <td align="center" valign="top">
                <div style="width: 40px; height: 40px; border-radius: 50%; background-color: rgba(34, 197, 94, 0.1); border: 2px solid #22c55e; margin: 0 auto 8px auto; text-align: center; line-height: 40px; font-size: 18px;">🔍</div>
                <div style="font-size: 10px; font-weight: 700; color: #e2e8f0;">Explore</div>
              </td>
              <td align="center" valign="top">
                <div style="width: 40px; height: 40px; border-radius: 50%; background-color: rgba(34, 197, 94, 0.1); border: 2px solid #22c55e; margin: 0 auto 8px auto; text-align: center; line-height: 40px; font-size: 18px;">🧠</div>
                <div style="font-size: 10px; font-weight: 700; color: #e2e8f0;">Auto-ML</div>
              </td>
              <td align="center" valign="top">
                <div style="width: 40px; height: 40px; border-radius: 50%; background-color: rgba(249, 115, 22, 0.1); border: 2px solid #f97316; margin: 0 auto 8px auto; text-align: center; line-height: 40px; font-size: 18px;">🚀</div>
                <div style="font-size: 10px; font-weight: 700; color: #e2e8f0;">Predict</div>
              </td>
            </tr>
          </table>
          <table width="100%" cellpadding="0" cellspacing="0" style="table-layout: fixed;">
            <tr>
              <td align="center" valign="top">
                <div style="width: 40px; height: 40px; border-radius: 50%; background-color: rgba(255, 255, 255, 0.05); border: 2px solid rgba(255, 255, 255, 0.1); margin: 0 auto 8px auto; text-align: center; line-height: 40px; font-size: 18px;">📊</div>
                <div style="font-size: 10px; font-weight: 700; color: #94a3b8;">Visualize</div>
              </td>
              <td align="center" valign="top">
                <div style="width: 40px; height: 40px; border-radius: 50%; background-color: rgba(255, 255, 255, 0.05); border: 2px solid rgba(255, 255, 255, 0.1); margin: 0 auto 8px auto; text-align: center; line-height: 40px; font-size: 18px;">💻</div>
                <div style="font-size: 10px; font-weight: 700; color: #94a3b8;">Power BI</div>
              </td>
              <td align="center" valign="top">
                <div style="width: 40px; height: 40px; border-radius: 50%; background-color: rgba(255, 255, 255, 0.05); border: 2px solid rgba(255, 255, 255, 0.1); margin: 0 auto 8px auto; text-align: center; line-height: 40px; font-size: 18px;">🤖</div>
                <div style="font-size: 10px; font-weight: 700; color: #94a3b8;">AI Insights</div>
              </td>
              <td align="center" valign="top">
                <div style="width: 40px; height: 40px; border-radius: 50%; background-color: rgba(255, 255, 255, 0.05); border: 2px solid rgba(255, 255, 255, 0.1); margin: 0 auto 8px auto; text-align: center; line-height: 40px; font-size: 18px;">⚡</div>
                <div style="font-size: 10px; font-weight: 700; color: #94a3b8;">Decisions</div>
              </td>
              <td align="center" valign="top">
                <div style="width: 40px; height: 40px; border-radius: 50%; background-color: rgba(255, 255, 255, 0.05); border: 2px solid rgba(255, 255, 255, 0.1); margin: 0 auto 8px auto; text-align: center; line-height: 40px; font-size: 18px;">📝</div>
                <div style="font-size: 10px; font-weight: 700; color: #94a3b8;">Reports</div>
              </td>
            </tr>
          </table>
        </div>

        <!-- Features Grid -->
        <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 16px;">
          <tr>
            <td width="48%" valign="top" style="border: 1px solid rgba(255, 255, 255, 0.05); border-radius: 16px; padding: 20px; background-color: rgba(10, 14, 23, 0.6);">
              <div style="font-size: 20px; margin-bottom: 10px;">🤖</div>
              <div style="font-size: 13px; font-weight: 800; color: #ffffff; margin-bottom: 6px;">AI-Powered Insights</div>
              <div style="font-size: 11px; color: #94a3b8; line-height: 1.4;">LLAMA3 + Groq API delivers sub-second AI explanations.</div>
            </td>
            <td width="4%"></td>
            <td width="48%" valign="top" style="border: 1px solid rgba(255, 255, 255, 0.05); border-radius: 16px; padding: 20px; background-color: rgba(10, 14, 23, 0.6);">
              <div style="font-size: 20px; margin-bottom: 10px;">📈</div>
              <div style="font-size: 13px; font-weight: 800; color: #ffffff; margin-bottom: 6px;">Auto Power BI</div>
              <div style="font-size: 11px; color: #94a3b8; line-height: 1.4;">One-click Plotly dashboards with smart charts.</div>
            </td>
          </tr>
          <tr><td colspan="3" height="16"></td></tr>
          <tr>
            <td width="48%" valign="top" style="border: 1px solid rgba(255, 255, 255, 0.05); border-radius: 16px; padding: 20px; background-color: rgba(10, 14, 23, 0.6);">
              <div style="font-size: 20px; margin-bottom: 10px;">🧠</div>
              <div style="font-size: 13px; font-weight: 800; color: #ffffff; margin-bottom: 6px;">AutoML Predictions</div>
              <div style="font-size: 11px; color: #94a3b8; line-height: 1.4;">Train and compare ML models without writing code.</div>
            </td>
            <td width="4%"></td>
            <td width="48%" valign="top" style="border: 1px solid rgba(255, 255, 255, 0.05); border-radius: 16px; padding: 20px; background-color: rgba(10, 14, 23, 0.6);">
              <div style="font-size: 20px; margin-bottom: 10px;">📄</div>
              <div style="font-size: 13px; font-weight: 800; color: #ffffff; margin-bottom: 6px;">Smart Reports</div>
              <div style="font-size: 11px; color: #94a3b8; line-height: 1.4;">PDF/Excel exports with executive summaries.</div>
            </td>
          </tr>
        </table>

        <!-- Footer Call to Action -->
        <div style="border: 1px solid rgba(255, 255, 255, 0.05); border-radius: 16px; padding: 40px 30px; text-align: center; background: linear-gradient(180deg, rgba(10, 14, 23, 0.8) 0%, rgba(6, 9, 15, 0.9) 100%);">
          <h2 style="font-size: 24px; font-weight: 900; margin: 0; color: #ffffff; line-height: 1.3;">
            Your data is waiting<br/>to <span style="color: #f97316;">tell its story.</span>
          </h2>
        </div>

      </div>
    </body>
    </html>
    """

def send_email(to: str, subject: str, html: str, otp: str = None):
    print(f"[EMAIL] Attempting to send to {to}...")
    if otp:
        print(f"[EMAIL] DEBUG OTP for {to}: {otp}")

    if not SMTP_PASSWORD or SMTP_PASSWORD in ("", "your-gmail-app-password"):
        print(f"[EMAIL MOCK] No SMTP password. To: {to} | Subject: {subject}")
        if otp:
            print(f"[EMAIL MOCK] OTP = {otp}")
        return

    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = f"DATALYTICS <{SMTP_USERNAME}>"
    msg["To"] = to
    msg.add_alternative(html, subtype="html")

    # Try SSL on port 465 first (more reliable), fallback to STARTTLS on 587
    try:
        context = ssl.create_default_context()
        with smtplib.SMTP_SSL("smtp.gmail.com", 465, context=context) as server:
            server.login(SMTP_USERNAME, SMTP_PASSWORD)
            server.send_message(msg)
            print(f"[EMAIL] Success (SSL): Sent to {to}")
            return
    except Exception as e1:
        print(f"[EMAIL] SSL attempt failed: {e1} — trying STARTTLS...")

    try:
        context = ssl.create_default_context()
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
            server.ehlo()
            server.starttls(context=context)
            server.ehlo()
            server.login(SMTP_USERNAME, SMTP_PASSWORD)
            server.send_message(msg)
            print(f"[EMAIL] Success (STARTTLS): Sent to {to}")
    except Exception as e2:
        print(f"[EMAIL] STARTTLS also failed: {e2}")
        if otp:
            print(f"[EMAIL] FALLBACK OTP for {to}: {otp}")

@router.post("/auth/signup")
async def signup(req: SignupRequest, background_tasks: BackgroundTasks):
    if req.password != req.confirmPassword:
        raise HTTPException(400, "Passwords do not match")
    if not req.acceptedTerms:
        raise HTTPException(400, "Please accept the terms and privacy policy to continue")
    db = get_db()
    existing = await db.users.find_one({"email": req.email})
    if existing:
        raise HTTPException(400, "Email already registered")
    
    hashed_pw = get_password_hash(req.password)
    otp = f"{random.randint(100000, 999999)}"
    
    user_doc = {
        "fullName": req.fullName,
        "email": req.email,
        "password": hashed_pw,
        "provider": "email",
        "verified": False,
        "accepted_terms": True,
        "accepted_terms_at": datetime.utcnow(),
        "otp": otp,
        "otpExp": datetime.utcnow() + timedelta(minutes=10),
        "joined_at": datetime.utcnow(),
        "diamonds": 200,
        "purchase_history": []
    }
    await db.users.insert_one(user_doc)
    background_tasks.add_task(send_email, req.email, "Verify Your DATALYTICS Account", build_otp_email(otp), otp=otp)
    return {"message": "OTP sent to email"}

@router.post("/auth/login")
async def login(req: LoginRequest, background_tasks: BackgroundTasks):
    print(f"[LOGIN] Attempt for: {req.email}")
    try:
        db = get_db()
        user = await db.users.find_one({"email": req.email})
        if not user or user["provider"] != "email" or not verify_password(req.password, user["password"]):
            print(f"[LOGIN] Invalid credentials for: {req.email}")
            raise HTTPException(401, "Invalid credentials")
        
        otp = f"{random.randint(100000, 999999)}"
        exp = datetime.utcnow() + timedelta(minutes=10)
        
        await db.users.update_one({"email": req.email}, {"$set": {"otp": otp, "otpExp": exp}})
        
        print(f"[LOGIN] Sending OTP {otp} to {req.email}")
        background_tasks.add_task(send_email, req.email, "Your Login OTP", build_otp_email(otp), otp=otp)
        
        return {"message": "OTP sent to email"}
    except HTTPException:
        raise
    except Exception as e:
        print(f"[LOGIN] Error: {str(e)}")
        raise HTTPException(500, f"Internal Server Error: {str(e)}")

@router.post("/auth/forgot-password")
async def forgot_password(req: ForgotPasswordRequest, background_tasks: BackgroundTasks):
    db = get_db()
    user = await db.users.find_one({"email": req.email})
    if user and user.get("provider") == "email":
        otp = f"{random.randint(100000, 999999)}"
        exp = datetime.utcnow() + timedelta(minutes=10)
        await db.users.update_one(
            {"email": req.email},
            {"$set": {"resetOtp": otp, "resetOtpExp": exp}},
        )
        background_tasks.add_task(
            send_email,
            req.email,
            "Reset Your DATALYTICS Password",
            build_otp_email(otp),
            otp=otp,
        )
    return {"message": "If that email exists, a password reset code has been sent."}

@router.post("/auth/reset-password")
async def reset_password(req: ResetPasswordRequest):
    if req.password != req.confirmPassword:
        raise HTTPException(400, "Passwords do not match")
    if len(req.password) < 8:
        raise HTTPException(400, "Password must be at least 8 characters")

    db = get_db()
    user = await db.users.find_one({"email": req.email})
    if not user or user.get("provider") != "email":
        raise HTTPException(400, "Invalid or expired reset code")
    if user.get("resetOtp") != req.otp:
        raise HTTPException(400, "Invalid or expired reset code")
    if datetime.utcnow() > user.get("resetOtpExp", datetime.utcnow() - timedelta(seconds=1)):
        raise HTTPException(400, "Reset code expired")

    await db.users.update_one(
        {"email": req.email},
        {
            "$set": {"password": get_password_hash(req.password), "updated_at": datetime.utcnow()},
            "$unset": {"resetOtp": "", "resetOtpExp": ""},
        },
    )
    return {"message": "Password reset successful. Please login with your new password."}

@router.post("/auth/change-password/request-otp")
async def request_change_password_otp(
    req: ChangePasswordOtpRequest,
    background_tasks: BackgroundTasks,
    email: str = Depends(get_current_user_email),
):
    db = get_db()
    user = await db.users.find_one({"email": email})
    if not user or user.get("provider") != "email":
        raise HTTPException(400, "Password change is available only for local email accounts")
    if not verify_password(req.oldPassword, user.get("password", "")):
        raise HTTPException(400, "Old password is incorrect")

    otp = f"{random.randint(100000, 999999)}"
    exp = datetime.utcnow() + timedelta(minutes=10)
    await db.users.update_one(
        {"email": email},
        {"$set": {"changePasswordOtp": otp, "changePasswordOtpExp": exp}},
    )
    background_tasks.add_task(
        send_email,
        email,
        "Confirm Your DATALYTICS Password Change",
        build_otp_email(otp),
        otp=otp,
    )
    return {"message": "OTP sent to your registered email"}

@router.post("/auth/change-password/confirm")
async def confirm_change_password(
    req: ChangePasswordConfirmRequest,
    email: str = Depends(get_current_user_email),
):
    if req.newPassword != req.confirmPassword:
        raise HTTPException(400, "Passwords do not match")
    if len(req.newPassword) < 8:
        raise HTTPException(400, "Password must be at least 8 characters")

    db = get_db()
    user = await db.users.find_one({"email": email})
    if not user or user.get("provider") != "email":
        raise HTTPException(400, "Password change is available only for local email accounts")
    if not verify_password(req.oldPassword, user.get("password", "")):
        raise HTTPException(400, "Old password is incorrect")
    if user.get("changePasswordOtp") != req.otp:
        raise HTTPException(400, "Invalid OTP")
    if datetime.utcnow() > user.get("changePasswordOtpExp", datetime.utcnow() - timedelta(seconds=1)):
        raise HTTPException(400, "OTP expired")

    await db.users.update_one(
        {"email": email},
        {
            "$set": {"password": get_password_hash(req.newPassword), "updated_at": datetime.utcnow()},
            "$unset": {"changePasswordOtp": "", "changePasswordOtpExp": ""},
        },
    )
    return {"message": "Password changed successfully"}

def build_welcome_back_email(name: str):
    first_name = name.split()[0] if name else "User"
    return f"""
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 20px; background-color: #06090f; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #ffffff;">
      <!-- Main Container -->
      <div style="max-width: 600px; margin: 0 auto; background-color: #06090f;">
        
        <!-- Top Bar -->
        <table width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid rgba(249, 115, 22, 0.2); border-radius: 12px; margin-bottom: 16px; background-color: rgba(10, 14, 23, 0.8);">
          <tr>
            <td style="padding: 12px 20px;">
              <!-- 3-Bar Equalizer Logo -->
              <table cellpadding="0" cellspacing="0" style="display: inline-table; vertical-align: middle; margin-right: 10px;">
                <tr>
                  <td valign="bottom" style="padding: 0 2px;">
                    <div style="width: 5px; height: 14px; background: linear-gradient(180deg, #ffb347 0%, #f97316 60%, #ea580c 100%); border-radius: 2px 2px 1px 1px; box-shadow: 0 0 6px rgba(249,115,22,0.7);"></div>
                  </td>
                  <td valign="bottom" style="padding: 0 2px;">
                    <div style="width: 5px; height: 22px; background: linear-gradient(180deg, #ffb347 0%, #f97316 60%, #ea580c 100%); border-radius: 2px 2px 1px 1px; box-shadow: 0 0 6px rgba(249,115,22,0.7);"></div>
                  </td>
                  <td valign="bottom" style="padding: 0 2px;">
                    <div style="width: 5px; height: 10px; background: linear-gradient(180deg, #ffb347 0%, #f97316 60%, #ea580c 100%); border-radius: 2px 2px 1px 1px; box-shadow: 0 0 6px rgba(249,115,22,0.7);"></div>
                  </td>
                </tr>
              </table>
              <span style="font-weight: 900; font-size: 19px; color: #ffffff; vertical-align: middle;">Data<span style="color: #f97316;">lytics</span></span>
            </td>
            <td align="right" style="padding: 12px 20px;">
              <span style="display: inline-block; background-color: rgba(34, 197, 94, 0.1); border: 1px solid rgba(34, 197, 94, 0.3); border-radius: 20px; padding: 4px 10px; font-size: 10px; font-weight: 700; color: #22c55e; letter-spacing: 1px; text-transform: uppercase;">
                <span style="display: inline-block; width: 6px; height: 6px; background-color: #22c55e; border-radius: 50%; margin-right: 4px; vertical-align: middle;"></span> <span style="vertical-align: middle;">LIVE</span>
              </span>
            </td>
          </tr>
        </table>

        <!-- Hero Section -->
        <div style="border: 1px solid rgba(255, 255, 255, 0.05); border-radius: 16px; padding: 40px 30px; text-align: center; margin-bottom: 16px; background: linear-gradient(180deg, rgba(10, 14, 23, 0.8) 0%, rgba(6, 9, 15, 0.9) 100%);">
          <div style="font-size: 11px; font-weight: 700; letter-spacing: 2px; color: #64748b; text-transform: uppercase; margin-bottom: 20px;">
            WELCOME BACK — YOUR WORKSPACE AWAITS
          </div>
          <h1 style="font-size: 38px; font-weight: 900; line-height: 1.1; margin: 0 0 20px 0; color: #ffffff; letter-spacing: -1px;">
            Ready to uncover<br/>the next<br/>
            <span style="color: #f97316;">unstoppable insight?</span>
          </h1>
          <p style="font-size: 14px; line-height: 1.6; color: #94a3b8; margin: 0 auto 30px auto; max-width: 480px;">
            Welcome back, {first_name}. Your datasets have missed you. Jump right back in to explore your metrics, train models, and generate smart reports.
          </p>
          <a href="http://localhost:5000" style="display: inline-block; background: linear-gradient(135deg, #f97316, #ea580c); color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 700; padding: 14px 28px; border-radius: 30px; box-shadow: 0 4px 20px rgba(249, 115, 22, 0.4);">
            ✦ Resume Analyzing
          </a>
        </div>

        <!-- Stats Section -->
        <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 16px;">
          <tr>
            <td width="32%" style="border: 1px solid rgba(255, 255, 255, 0.05); border-radius: 12px; background-color: rgba(10, 14, 23, 0.6); padding: 20px 10px; text-align: center;">
              <div style="font-size: 26px; font-weight: 900; color: #f97316; margin-bottom: 4px;">48K+</div>
              <div style="font-size: 9px; font-weight: 700; color: #64748b; letter-spacing: 1px; text-transform: uppercase;">ROWS PROCESSED</div>
            </td>
            <td width="2%"></td>
            <td width="32%" style="border: 1px solid rgba(255, 255, 255, 0.05); border-radius: 12px; background-color: rgba(10, 14, 23, 0.6); padding: 20px 10px; text-align: center;">
              <div style="font-size: 26px; font-weight: 900; color: #f97316; margin-bottom: 4px;">94%</div>
              <div style="font-size: 9px; font-weight: 700; color: #64748b; letter-spacing: 1px; text-transform: uppercase;">MODEL ACCURACY</div>
            </td>
            <td width="2%"></td>
            <td width="32%" style="border: 1px solid rgba(255, 255, 255, 0.05); border-radius: 12px; background-color: rgba(10, 14, 23, 0.6); padding: 20px 10px; text-align: center;">
              <div style="font-size: 26px; font-weight: 900; color: #f97316; margin-bottom: 4px;">+12.4%</div>
              <div style="font-size: 9px; font-weight: 700; color: #64748b; letter-spacing: 1px; text-transform: uppercase;">INSIGHT GROWTH</div>
            </td>
          </tr>
        </table>

        <!-- Live Data Overview -->
        <div style="border: 1px solid rgba(255, 255, 255, 0.05); border-radius: 16px; padding: 20px; background-color: rgba(10, 14, 23, 0.6); margin-bottom: 16px;">
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 20px;">
            <tr>
              <td>
                <div style="font-size: 14px; font-weight: 800; color: #ffffff;">
                  <span style="display: inline-block; width: 12px; height: 12px; background: linear-gradient(135deg, #3b82f6, #8b5cf6, #ec4899); border-radius: 3px; vertical-align: middle; margin-right: 6px;"></span>
                  <span style="vertical-align: middle;">Live Data Overview</span>
                </div>
              </td>
              <td align="right">
                <span style="display: inline-block; background-color: rgba(34, 197, 94, 0.1); border: 1px solid rgba(34, 197, 94, 0.3); border-radius: 20px; padding: 4px 8px; font-size: 9px; font-weight: 700; color: #22c55e; letter-spacing: 1px; text-transform: uppercase;">
                  + REAL-TIME
                </span>
              </td>
            </tr>
          </table>
          
          <!-- Fake Bar Chart -->
          <table width="100%" cellpadding="0" cellspacing="0" height="80" style="margin-bottom: 8px;">
            <tr>
              <td valign="bottom" width="14%"><div style="background-color: #f97316; height: 32px; border-radius: 4px 4px 0 0; margin: 0 4px;"></div></td>
              <td valign="bottom" width="14%"><div style="background-color: #38bdf8; height: 28px; border-radius: 4px 4px 0 0; margin: 0 4px;"></div></td>
              <td valign="bottom" width="14%"><div style="background-color: #c084fc; height: 24px; border-radius: 4px 4px 0 0; margin: 0 4px;"></div></td>
              <td valign="bottom" width="14%"><div style="background-color: #22c55e; height: 36px; border-radius: 4px 4px 0 0; margin: 0 4px;"></div></td>
              <td valign="bottom" width="14%"><div style="background-color: #ef4444; height: 64px; border-radius: 4px 4px 0 0; margin: 0 4px;"></div></td>
              <td valign="bottom" width="14%"><div style="background-color: #fbbf24; height: 30px; border-radius: 4px 4px 0 0; margin: 0 4px;"></div></td>
              <td valign="bottom" width="14%"><div style="background-color: #38bdf8; height: 34px; border-radius: 4px 4px 0 0; margin: 0 4px;"></div></td>
            </tr>
          </table>
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td width="14%" align="center" style="font-size: 9px; color: #64748b; font-weight: 700;">JAN</td>
              <td width="14%" align="center" style="font-size: 9px; color: #64748b; font-weight: 700;">FEB</td>
              <td width="14%" align="center" style="font-size: 9px; color: #64748b; font-weight: 700;">MAR</td>
              <td width="14%" align="center" style="font-size: 9px; color: #64748b; font-weight: 700;">APR</td>
              <td width="14%" align="center" style="font-size: 9px; color: #64748b; font-weight: 700;">MAY</td>
              <td width="14%" align="center" style="font-size: 9px; color: #64748b; font-weight: 700;">JUN</td>
              <td width="14%" align="center" style="font-size: 9px; color: #64748b; font-weight: 700;">JUL</td>
            </tr>
          </table>
        </div>

        <!-- 10-Step AI Pipeline -->
        <div style="border: 1px solid rgba(255, 255, 255, 0.05); border-radius: 16px; padding: 20px; background-color: rgba(10, 14, 23, 0.6); margin-bottom: 16px;">
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 20px;">
            <tr>
              <td>
                <div style="font-size: 14px; font-weight: 800; color: #ffffff;">⚡ Your 10-Step AI Pipeline</div>
              </td>
              <td align="right">
                <span style="display: inline-block; background-color: rgba(34, 197, 94, 0.1); border: 1px solid rgba(34, 197, 94, 0.3); border-radius: 20px; padding: 4px 8px; font-size: 9px; font-weight: 700; color: #22c55e; letter-spacing: 1px;">
                  3 / 10 DONE
                </span>
              </td>
            </tr>
          </table>
          
          <div style="font-size: 9px; font-weight: 700; color: #f97316; letter-spacing: 2px; text-transform: uppercase; margin-bottom: 15px; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 8px;">PIPELINE MODULES</div>
          
          <!-- Pipeline Grid -->
          <table width="100%" cellpadding="0" cellspacing="0" style="table-layout: fixed; margin-bottom: 15px;">
            <tr>
              <td align="center" valign="top">
                <div style="width: 40px; height: 40px; border-radius: 50%; background-color: rgba(34, 197, 94, 0.1); border: 2px solid #22c55e; margin: 0 auto 8px auto; text-align: center; line-height: 40px; font-size: 18px;">📁</div>
                <div style="font-size: 10px; font-weight: 700; color: #e2e8f0;">Dataset<br/>Upload</div>
              </td>
              <td align="center" valign="top">
                <div style="width: 40px; height: 40px; border-radius: 50%; background-color: rgba(34, 197, 94, 0.1); border: 2px solid #22c55e; margin: 0 auto 8px auto; text-align: center; line-height: 40px; font-size: 18px;">⚙️</div>
                <div style="font-size: 10px; font-weight: 700; color: #e2e8f0;">Data<br/>Prep</div>
              </td>
              <td align="center" valign="top">
                <div style="width: 40px; height: 40px; border-radius: 50%; background-color: rgba(34, 197, 94, 0.1); border: 2px solid #22c55e; margin: 0 auto 8px auto; text-align: center; line-height: 40px; font-size: 18px;">🔍</div>
                <div style="font-size: 10px; font-weight: 700; color: #e2e8f0;">Explore</div>
              </td>
              <td align="center" valign="top">
                <div style="width: 40px; height: 40px; border-radius: 50%; background-color: rgba(34, 197, 94, 0.1); border: 2px solid #22c55e; margin: 0 auto 8px auto; text-align: center; line-height: 40px; font-size: 18px;">🧠</div>
                <div style="font-size: 10px; font-weight: 700; color: #e2e8f0;">Auto-ML</div>
              </td>
              <td align="center" valign="top">
                <div style="width: 40px; height: 40px; border-radius: 50%; background-color: rgba(249, 115, 22, 0.1); border: 2px solid #f97316; margin: 0 auto 8px auto; text-align: center; line-height: 40px; font-size: 18px;">🚀</div>
                <div style="font-size: 10px; font-weight: 700; color: #e2e8f0;">Predict</div>
              </td>
            </tr>
          </table>
          <table width="100%" cellpadding="0" cellspacing="0" style="table-layout: fixed;">
            <tr>
              <td align="center" valign="top">
                <div style="width: 40px; height: 40px; border-radius: 50%; background-color: rgba(255, 255, 255, 0.05); border: 2px solid rgba(255, 255, 255, 0.1); margin: 0 auto 8px auto; text-align: center; line-height: 40px; font-size: 18px;">📊</div>
                <div style="font-size: 10px; font-weight: 700; color: #94a3b8;">Visualize</div>
              </td>
              <td align="center" valign="top">
                <div style="width: 40px; height: 40px; border-radius: 50%; background-color: rgba(255, 255, 255, 0.05); border: 2px solid rgba(255, 255, 255, 0.1); margin: 0 auto 8px auto; text-align: center; line-height: 40px; font-size: 18px;">💻</div>
                <div style="font-size: 10px; font-weight: 700; color: #94a3b8;">Power BI</div>
              </td>
              <td align="center" valign="top">
                <div style="width: 40px; height: 40px; border-radius: 50%; background-color: rgba(255, 255, 255, 0.05); border: 2px solid rgba(255, 255, 255, 0.1); margin: 0 auto 8px auto; text-align: center; line-height: 40px; font-size: 18px;">🤖</div>
                <div style="font-size: 10px; font-weight: 700; color: #94a3b8;">AI Insights</div>
              </td>
              <td align="center" valign="top">
                <div style="width: 40px; height: 40px; border-radius: 50%; background-color: rgba(255, 255, 255, 0.05); border: 2px solid rgba(255, 255, 255, 0.1); margin: 0 auto 8px auto; text-align: center; line-height: 40px; font-size: 18px;">⚡</div>
                <div style="font-size: 10px; font-weight: 700; color: #94a3b8;">Decisions</div>
              </td>
              <td align="center" valign="top">
                <div style="width: 40px; height: 40px; border-radius: 50%; background-color: rgba(255, 255, 255, 0.05); border: 2px solid rgba(255, 255, 255, 0.1); margin: 0 auto 8px auto; text-align: center; line-height: 40px; font-size: 18px;">📝</div>
                <div style="font-size: 10px; font-weight: 700; color: #94a3b8;">Reports</div>
              </td>
            </tr>
          </table>
        </div>

        <!-- Features Grid -->
        <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 16px;">
          <tr>
            <td width="48%" valign="top" style="border: 1px solid rgba(255, 255, 255, 0.05); border-radius: 16px; padding: 20px; background-color: rgba(10, 14, 23, 0.6);">
              <div style="font-size: 20px; margin-bottom: 10px;">🤖</div>
              <div style="font-size: 13px; font-weight: 800; color: #ffffff; margin-bottom: 6px;">AI-Powered Insights</div>
              <div style="font-size: 11px; color: #94a3b8; line-height: 1.4;">LLAMA3 + Groq API delivers sub-second AI explanations.</div>
            </td>
            <td width="4%"></td>
            <td width="48%" valign="top" style="border: 1px solid rgba(255, 255, 255, 0.05); border-radius: 16px; padding: 20px; background-color: rgba(10, 14, 23, 0.6);">
              <div style="font-size: 20px; margin-bottom: 10px;">📈</div>
              <div style="font-size: 13px; font-weight: 800; color: #ffffff; margin-bottom: 6px;">Auto Power BI</div>
              <div style="font-size: 11px; color: #94a3b8; line-height: 1.4;">One-click Plotly dashboards with smart charts.</div>
            </td>
          </tr>
          <tr><td colspan="3" height="16"></td></tr>
          <tr>
            <td width="48%" valign="top" style="border: 1px solid rgba(255, 255, 255, 0.05); border-radius: 16px; padding: 20px; background-color: rgba(10, 14, 23, 0.6);">
              <div style="font-size: 20px; margin-bottom: 10px;">🧠</div>
              <div style="font-size: 13px; font-weight: 800; color: #ffffff; margin-bottom: 6px;">AutoML Predictions</div>
              <div style="font-size: 11px; color: #94a3b8; line-height: 1.4;">Train and compare ML models without writing code.</div>
            </td>
            <td width="4%"></td>
            <td width="48%" valign="top" style="border: 1px solid rgba(255, 255, 255, 0.05); border-radius: 16px; padding: 20px; background-color: rgba(10, 14, 23, 0.6);">
              <div style="font-size: 20px; margin-bottom: 10px;">📄</div>
              <div style="font-size: 13px; font-weight: 800; color: #ffffff; margin-bottom: 6px;">Smart Reports</div>
              <div style="font-size: 11px; color: #94a3b8; line-height: 1.4;">PDF/Excel exports with executive summaries.</div>
            </td>
          </tr>
        </table>

        <!-- Footer Call to Action -->
        <div style="border: 1px solid rgba(255, 255, 255, 0.05); border-radius: 16px; padding: 40px 30px; text-align: center; background: linear-gradient(180deg, rgba(10, 14, 23, 0.8) 0%, rgba(6, 9, 15, 0.9) 100%);">
          <h2 style="font-size: 24px; font-weight: 900; margin: 0; color: #ffffff; line-height: 1.3;">
            Your data is waiting<br/>to <span style="color: #f97316;">tell its story.</span>
          </h2>
        </div>

      </div>
    </body>
    </html>
    """

@router.post("/auth/verify-otp")
async def verify_otp(req: OTPVerifyRequest, background_tasks: BackgroundTasks):
    db = get_db()
    user = await db.users.find_one({"email": req.email})
    if not user or "otp" not in user or user["otp"] != req.otp:
        raise HTTPException(400, "Invalid OTP")
    if datetime.utcnow() > user["otpExp"]:
        raise HTTPException(400, "OTP expired")
    
    # Check for inactivity (7+ days)
    now = datetime.utcnow()
    last_login = user.get("last_login")
    was_inactive = False
    if last_login:
        # If last_login is a string, parse it; if it's already datetime, use it
        if isinstance(last_login, str):
            try:
                last_login = datetime.fromisoformat(last_login.replace("Z", "+00:00"))
            except:
                last_login = now
        
        if now - last_login > timedelta(days=7):
            was_inactive = True

    update_fields = {
        "verified": True,
        "last_login": now
    }
    await db.users.update_one({"email": req.email}, {"$unset": {"otp": "", "otpExp": ""}, "$set": update_fields})
    await log_auth_activity(req.email, "Login", "User logged in")
    
    if not user.get("welcome_sent"):
        background_tasks.add_task(send_email, req.email, "Welcome to DATALYTICS", build_welcome_email(user["fullName"]))
        await db.users.update_one({"email": req.email}, {"$set": {"welcome_sent": True}})
    elif was_inactive:
        background_tasks.add_task(send_email, req.email, "Welcome Back to DATALYTICS", build_welcome_back_email(user["fullName"]))
        
    token = create_access_token({
        "sub": req.email, 
        "name": user["fullName"],
        "joined_at": user.get("joined_at", datetime.utcnow()).replace(tzinfo=None).isoformat() + "Z",
        "provider": user.get("provider", "email"),
        "plan": user.get("plan", "None"),
        "diamonds": user.get("diamonds", 200),
    })
    return {"token": token, "user": {"email": req.email, "fullName": user["fullName"], "provider": user.get("provider", "email"), "plan": user.get("plan", "None"), "diamonds": user.get("diamonds", 200)}}


@router.post("/auth/logout")
async def logout(email: str = Depends(get_current_user_email)):
    await log_auth_activity(email, "Logout", "User logged out")
    return {"ok": True}

@router.post("/auth/google")
async def google_login(req: GoogleLoginRequest, background_tasks: BackgroundTasks):
    client_id = os.getenv("GOOGLE_CLIENT_ID", "").strip()
    try:
        # Attempt verification with cached session first for speed
        try:
            idinfo = await run_in_threadpool(
                id_token.verify_oauth2_token,
                req.token,
                GOOGLE_AUTH_REQUEST,
                client_id,
                clock_skew_in_seconds=150
            )
        except Exception as e:
            # If persistent session fails (e.g. RemoteDisconnected), retry once with fresh request
            print(f"[GOOGLE AUTH] Cached session failed, retrying with fresh request: {e}")
            idinfo = await run_in_threadpool(
                id_token.verify_oauth2_token,
                req.token,
                google_requests.Request(),
                client_id,
                clock_skew_in_seconds=150
            )
            
        email = idinfo["email"]
        name = idinfo.get("name", "User")
        
        db = get_db()
        user = await db.users.find_one({"email": email})
        
        now = datetime.utcnow()
        if user:
            # Quick update last login, no need for heavy checks before sending response
            await db.users.update_one({"email": email}, {"$set": {"last_login": now}})
            await log_auth_activity(email, "Login", "Google login")
            
            # Use background tasks for any inactive user email logic to keep response fast
            last_login = user.get("last_login")
            if last_login:
                if isinstance(last_login, str):
                    try:
                        last_login = datetime.fromisoformat(last_login.replace("Z", "+00:00"))
                    except:
                        last_login = now
                if now - last_login > timedelta(days=7):
                    background_tasks.add_task(send_email, email, "Welcome Back to DATALYTICS", build_welcome_back_email(name))
        else:
            user_doc = {
                "fullName": name,
                "email": email,
                "provider": "google",
                "verified": True,
                "welcome_sent": True,
                "joined_at": now,
                "last_login": now,
                "diamonds": 200,
                "purchase_history": []
            }
            await db.users.insert_one(user_doc)
            background_tasks.add_task(send_email, email, "Welcome to DATALYTICS", build_welcome_email(name))
            await log_auth_activity(email, "Login", "Google signup and login")
            
        token = create_access_token({
            "sub": email, 
            "name": name,
            "joined_at": (user.get("joined_at", now).replace(tzinfo=None).isoformat() + "Z") if user else (now.replace(tzinfo=None).isoformat() + "Z"),
            "provider": "google",
            "plan": user.get("plan", "None") if user else "None",
            "diamonds": user.get("diamonds", 200) if user else 200,
        })
        return {"token": token, "user": {"email": email, "fullName": name, "provider": "google", "plan": user.get("plan", "None") if user else "None", "diamonds": user.get("diamonds", 200) if user else 200}}
    except Exception as e:
        print(f"[GOOGLE AUTH] Error: {str(e)}")
        raise HTTPException(400, f"Invalid Google token: {str(e)}")
