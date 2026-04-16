import os
import random
import smtplib
import ssl
from datetime import datetime, timedelta, timezone
from email.message import EmailMessage

import jwt
from fastapi import APIRouter, HTTPException, status, BackgroundTasks
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel, EmailStr
import bcrypt
import requests as py_requests
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token
from database import get_db

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

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class OTPVerifyRequest(BaseModel):
    email: EmailStr
    otp: str

class GoogleLoginRequest(BaseModel):
    token: str

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

def build_otp_email(otp: str):
    return f"""
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #060b18; margin: 0; padding: 40px 0; color: #f8fafc; text-align: center;">
      <div style="max-width: 550px; margin: 0 auto; background: #0d1225; border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 24px; padding: 50px 40px; box-shadow: 0 30px 60px rgba(0, 0, 0, 0.5);">
        <div style="margin-bottom: 30px;">
          <span style="font-size: 26px; font-weight: 800; letter-spacing: 2px; background: linear-gradient(135deg, #00d4ff, #7c3aed); -webkit-background-clip: text; -webkit-text-fill-color: transparent; color: #00d4ff;">DATALYTICS</span>
        </div>
        <h1 style="font-size: 32px; font-weight: 700; color: #ffffff; margin: 0 0 15px;">Secure Verification</h1>
        <p style="color: #94a3b8; font-size: 16px; line-height: 1.6; margin-bottom: 35px;">To complete your authentication, please use the following one-time security code. This code is valid for 10 minutes.</p>
        
        <div style="background: rgba(255, 255, 255, 0.03); border: 1px dashed rgba(255, 255, 255, 0.2); padding: 25px; border-radius: 16px; margin-bottom: 35px;">
          <span style="font-size: 42px; font-weight: 800; letter-spacing: 10px; color: #ffffff; text-shadow: 0 0 20px rgba(0, 212, 255, 0.3);">{otp}</span>
        </div>
        
        <p style="color: #64748b; font-size: 14px; margin-bottom: 0;">If you didn't request this code, you can safely ignore this email.</p>
        <div style="margin-top: 40px; padding-top: 25px; border-top: 1px solid rgba(255, 255, 255, 0.05);">
          <p style="color: #475569; font-size: 12px; margin: 0;">&copy; 2026 DATALYTICS AI Platform. All rights reserved.</p>
        </div>
      </div>
    </div>
    """

def build_welcome_email(name: str):
    features = [
        ("📁", "Dataset Upload", "Seamless CSV, Excel & JSON imports"),
        ("⚙️", "Data Preparation", "Automated cleaning and preprocessing"),
        ("🔍", "Data Exploration", "Deep dive into statistical distributions"),
        ("📊", "Visualization", "Interactive charts and dynamic plots"),
        ("🤖", "Prediction", "Deploy ML models with high accuracy"),
        ("💎", "Auto Power BI", "Instant BI dashboards from raw data"),
        ("💡", "Insights", "Automated business recommendations"),
        ("📝", "Reports", "Comprehensive analytical summaries"),
        ("🧠", "AI Insights", "Conversational AI for your datasets")
    ]
    
    feature_html = ""
    for icon, title, desc in features:
        feature_html += f"""
        <div style="display: inline-block; width: 140px; vertical-align: top; margin: 10px; text-align: left; background: rgba(255,255,255,0.02); padding: 15px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.05);">
          <div style="font-size: 24px; margin-bottom: 8px;">{icon}</div>
          <div style="font-size: 13px; font-weight: 700; color: #fff; margin-bottom: 4px;">{title}</div>
          <div style="font-size: 11px; color: #94a3b8; line-height: 1.3;">{desc}</div>
        </div>
        """

    return f"""
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #060b18; margin: 0; padding: 40px 0; color: #f8fafc; text-align: center;">
      <div style="max-width: 650px; margin: 0 auto; background: #0d1225; border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 30px; padding: 0; overflow: hidden; box-shadow: 0 40px 80px rgba(0, 0, 0, 0.6);">
        
        <!-- Header Image/Gradient Area -->
        <div style="background: linear-gradient(135deg, #00d4ff 0%, #7c3aed 100%); padding: 60px 40px; text-align: center;">
          <div style="background: rgba(255, 255, 255, 0.2); backdrop-filter: blur(10px); display: inline-block; padding: 12px 24px; border-radius: 100px; margin-bottom: 20px; border: 1px solid rgba(255, 255, 255, 0.3);">
             <span style="color: #fff; font-weight: 800; letter-spacing: 2px; font-size: 20px;">DATALYTICS</span>
          </div>
          <h1 style="font-size: 36px; font-weight: 800; color: #ffffff; margin: 0; line-height: 1.2;">Welcome to the Future of Data, {name.split()[0]}! 🚀</h1>
        </div>

        <div style="padding: 40px;">
          <p style="color: #cbd5e1; font-size: 17px; line-height: 1.7; margin-bottom: 35px;">
            Your workspace is officially ready. You now have access to a complete industry-grade data science pipeline at your fingertips.
          </p>

          <h3 style="color: #ffffff; font-size: 18px; font-weight: 700; text-align: left; margin-bottom: 20px; padding-left: 10px; border-left: 4px solid #00d4ff;">Your Powerful Toolkit</h3>
          
          <div style="text-align: center; margin-bottom: 40px;">
            {feature_html}
          </div>

          <div style="background: rgba(0, 212, 255, 0.05); border: 1px solid rgba(0, 212, 255, 0.1); padding: 30px; border-radius: 20px; margin-bottom: 40px;">
            <h4 style="color: #00d4ff; font-size: 16px; font-weight: 700; margin: 0 0 10px;">Ready to dive in?</h4>
            <p style="color: #94a3b8; font-size: 14px; margin-bottom: 25px;">Start by uploading your first dataset and let our AI handle the rest.</p>
            <a href="http://localhost:5000" style="display: inline-block; padding: 16px 40px; background: linear-gradient(135deg, #00d4ff, #0066ff); color: #fff; text-decoration: none; font-weight: 700; font-size: 16px; border-radius: 14px; box-shadow: 0 10px 25px rgba(0, 212, 255, 0.4); transition: all 0.3s;">Launch Dashboard</a>
          </div>

          <div style="padding-top: 30px; border-top: 1px solid rgba(255, 255, 255, 0.05); text-align: center;">
            <p style="color: #64748b; font-size: 13px; margin-bottom: 10px;">Need help? Our documentation and support team are always here.</p>
            <p style="color: #475569; font-size: 12px; margin: 0;">&copy; 2026 DATALYTICS AI Platform. All rights reserved.</p>
          </div>
        </div>
      </div>
    </div>
    """

def send_email(to: str, subject: str, html: str, otp: str = None):
    print(f"[EMAIL] Attempting to send to {to}...")
    if otp:
        print(f"DEBUG: OTP for {to} is {otp}")
    
    if not SMTP_PASSWORD or SMTP_PASSWORD == "your-gmail-app-password":
        print(f"[EMAIL MOCK] SMTP_PASSWORD not set. To: {to} | Subject: {subject}")
        return

    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = f"DATALYTICS <{SMTP_USERNAME}>"
    msg["To"] = to
    msg.add_alternative(html, subtype="html")
    context = ssl.create_default_context()
    try:
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
            server.starttls(context=context)
            server.login(SMTP_USERNAME, SMTP_PASSWORD)
            server.send_message(msg)
            print(f"[EMAIL] Success: Sent to {to}")
    except Exception as e:
        print(f"[EMAIL] Error failed: {e}")
        if otp:
            print(f"CRITICAL: Email failed! Use this OTP to proceed: {otp}")

@router.post("/auth/signup")
async def signup(req: SignupRequest, background_tasks: BackgroundTasks):
    if req.password != req.confirmPassword:
        raise HTTPException(400, "Passwords do not match")
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
        "otp": otp,
        "otpExp": datetime.utcnow() + timedelta(minutes=10),
        "joined_at": datetime.utcnow(),
        "diamonds": 100,
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

def build_welcome_back_email(name: str):
    return f"""
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #060b18; margin: 0; padding: 40px 0; color: #f8fafc; text-align: center;">
      <div style="max-width: 600px; margin: 0 auto; background: #0d1225; border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 30px; padding: 0; overflow: hidden; box-shadow: 0 40px 80px rgba(0, 0, 0, 0.6);">
        
        <div style="background: linear-gradient(135deg, #7c3aed 0%, #00d4ff 100%); padding: 50px 40px; text-align: center;">
          <div style="background: rgba(255, 255, 255, 0.2); backdrop-filter: blur(10px); display: inline-block; padding: 10px 20px; border-radius: 100px; margin-bottom: 20px; border: 1px solid rgba(255, 255, 255, 0.3);">
             <span style="color: #fff; font-weight: 800; letter-spacing: 2px; font-size: 18px;">DATALYTICS</span>
          </div>
          <h1 style="font-size: 32px; font-weight: 800; color: #ffffff; margin: 0; line-height: 1.2;">Welcome Back, {name.split()[0]}! 👋</h1>
        </div>

        <div style="padding: 40px;">
          <p style="color: #cbd5e1; font-size: 17px; line-height: 1.7; margin-bottom: 30px;">
            It's been a while! We've missed having you in the workspace. Since you were gone, our AI has been getting even smarter.
          </p>

          <div style="background: rgba(124, 58, 237, 0.05); border: 1px solid rgba(124, 58, 237, 0.15); padding: 25px; border-radius: 20px; margin-bottom: 35px; text-align: left;">
            <h4 style="color: #a855f7; font-size: 16px; font-weight: 700; margin: 0 0 12px;">What's waiting for you:</h4>
            <ul style="color: #94a3b8; font-size: 14px; margin: 0; padding-left: 20px; line-height: 1.8;">
              <li>Fresh AI-driven insights from your existing datasets.</li>
              <li>Enhanced Auto-ML models for even better accuracy.</li>
              <li>New visualization tools for your Power BI dashboards.</li>
            </ul>
          </div>

          <a href="http://localhost:5000" style="display: inline-block; padding: 16px 45px; background: linear-gradient(135deg, #7c3aed, #00d4ff); color: #fff; text-decoration: none; font-weight: 700; font-size: 16px; border-radius: 14px; box-shadow: 0 10px 25px rgba(124, 58, 237, 0.4);">Resume Your Journey</a>

          <div style="padding-top: 35px; border-top: 1px solid rgba(255, 255, 255, 0.05); margin-top: 40px;">
            <p style="color: #475569; font-size: 12px; margin: 0;">&copy; 2026 DATALYTICS AI Platform. All rights reserved.</p>
          </div>
        </div>
      </div>
    </div>
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
    
    if not user.get("welcome_sent"):
        background_tasks.add_task(send_email, req.email, "Welcome to DATALYTICS", build_welcome_email(user["fullName"]))
        await db.users.update_one({"email": req.email}, {"$set": {"welcome_sent": True}})
    elif was_inactive:
        background_tasks.add_task(send_email, req.email, "Welcome Back to DATALYTICS", build_welcome_back_email(user["fullName"]))
        
    token = create_access_token({
        "sub": req.email, 
        "name": user["fullName"],
        "joined_at": user.get("joined_at", datetime.utcnow()).replace(tzinfo=None).isoformat() + "Z"
    })
    return {"token": token, "user": {"email": req.email, "fullName": user["fullName"]}}

@router.post("/auth/google")
async def google_login(req: GoogleLoginRequest, background_tasks: BackgroundTasks):
    client_id = os.getenv("GOOGLE_CLIENT_ID", "").strip()
    try:
        # Move blocking verification to threadpool to avoid event loop blocking
        idinfo = await run_in_threadpool(
            id_token.verify_oauth2_token,
            req.token,
            GOOGLE_AUTH_REQUEST,
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
                "diamonds": 100,
                "purchase_history": []
            }
            await db.users.insert_one(user_doc)
            background_tasks.add_task(send_email, email, "Welcome to DATALYTICS", build_welcome_email(name))
            
        token = create_access_token({
            "sub": email, 
            "name": name,
            "joined_at": (user.get("joined_at", now).replace(tzinfo=None).isoformat() + "Z") if user else (now.replace(tzinfo=None).isoformat() + "Z")
        })
        return {"token": token, "user": {"email": email, "fullName": name}}
    except Exception as e:
        print(f"[GOOGLE AUTH] Error: {str(e)}")
        raise HTTPException(400, f"Invalid Google token: {str(e)}")
