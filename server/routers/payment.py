import os
import hmac
import hashlib
from fastapi import APIRouter, HTTPException, Request, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from datetime import datetime
import jwt
from dotenv import load_dotenv

# Ensure .env is loaded even when this module is imported stand-alone
load_dotenv(override=True)

try:
    import razorpay
    _razorpay_available = True
except ImportError:
    _razorpay_available = False

from database import get_db

router = APIRouter()

PLAN_CATALOG = {
    "Platinum": {"price": 199, "diamonds": 199},
    "Elite": {"price": 399, "diamonds": 399},
    "Ultra": {"price": 699, "diamonds": 699},
    "Max": {"price": 999, "diamonds": 999},
    "Prime": {"price": 1499, "diamonds": 1499},
    "Diamond": {"price": 1999, "diamonds": 1999},
    "Starter Pack": {"price": 100, "diamonds": 200},
    "Pro Pack": {"price": 500, "diamonds": 800},
}


def _resolve_plan_values(plan_name: str, price: int | None = None, diamonds: int | None = None) -> tuple[int | None, int | None]:
    plan = PLAN_CATALOG.get(plan_name)
    if not plan:
        return price, diamonds
    return plan["price"], plan["diamonds"]


# ── Debug endpoint (public) ───────────────────────────────────────────────────
@router.get("/payment/status")
async def payment_status():
    """Check if Razorpay is properly configured. Hit /api/payment/status in browser."""
    key_id  = os.getenv("RZP_KEY_ID", "")
    secret  = os.getenv("RZP_SECRET", "")
    return {
        "razorpay_library": _razorpay_available,
        "key_id_set":  bool(key_id)  and key_id.startswith("rzp_"),
        "secret_set":  bool(secret),
        "mode":        "test" if key_id.startswith("rzp_test_") else "live" if key_id.startswith("rzp_live_") else "unknown",
        "ready":       _razorpay_available and bool(key_id) and bool(secret),
    }

# ── Auth helpers ──────────────────────────────────────────────────────────────
SECRET_KEY = os.getenv("JWT_SECRET", "super-secret-key-datalytics")
ALGORITHM = "HS256"
security = HTTPBearer(auto_error=False)

def get_current_user_email(credentials: HTTPAuthorizationCredentials = Depends(security)) -> str:
    if not credentials:
        raise HTTPException(401, "Not authenticated")
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if not email:
            raise HTTPException(401, "Invalid token payload")
        return email
    except jwt.ExpiredSignatureError:
        raise HTTPException(401, "Token expired")
    except jwt.PyJWTError:
        raise HTTPException(401, "Invalid token")

# ── Razorpay client init ──────────────────────────────────────────────────────
def get_rzp_client():
    import os
    if not _razorpay_available:
        print("[RAZORPAY] Library not available")
        return None
    key_id = os.getenv("RZP_KEY_ID", "")
    secret = os.getenv("RZP_SECRET", "")
    if key_id and secret:
        try:
            client = razorpay.Client(auth=(key_id, secret))
            return client
        except Exception as e:
            print(f"[RAZORPAY] Client init error: {str(e)}")
            return None
    print(f"[RAZORPAY] Keys missing: key_id={'set' if key_id else 'missing'}, secret={'set' if secret else 'missing'}")
    return None


# ── Request models ────────────────────────────────────────────────────────────
class BuyPlanRequest(BaseModel):
    plan_name: str
    price: int       # Price in INR (rupees)
    diamonds: int

class VerifyPaymentRequest(BaseModel):
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str
    plan_name: str
    diamonds: int

class DeductDiamondsRequest(BaseModel):
    amount: int = 20

# ── Endpoints ─────────────────────────────────────────────────────────────────

def _serialize_history(history: list) -> list:
    """Convert datetime objects and ObjectIds in purchase history to JSON-safe types."""
    result = []
    for entry in history:
        e = dict(entry)
        # Convert datetime to ISO string with Z for UTC
        if isinstance(e.get("timestamp"), datetime):
            e["timestamp"] = e["timestamp"].replace(tzinfo=None).isoformat() + "Z"
        # Remove MongoDB _id if present
        e.pop("_id", None)
        # Ensure plan_name is a string
        if not e.get("plan_name"):
            e["plan_name"] = "Unknown"
        result.append(e)
    return result


@router.get("/payment/user-diamonds")
async def get_user_diamonds(email: str = Depends(get_current_user_email)):
    """Return the authenticated user's current diamond balance and purchase history."""
    db = get_db()
    user = await db.users.find_one({"email": email})
    if not user:
        raise HTTPException(404, "User not found")
    return {
        "diamonds": user.get("diamonds", 0),
        "plan": user.get("plan", "None"),
        "email": email,
        "purchase_history": _serialize_history(user.get("purchase_history", [])),
    }


@router.post("/payment/buy-plan")
async def buy_plan(req: BuyPlanRequest, email: str = Depends(get_current_user_email)):
    """Create a Razorpay order for the chosen plan."""
    rzp = get_rzp_client()
    price, diamonds = _resolve_plan_values(req.plan_name, req.price, req.diamonds)
    
    if not rzp:
        print(f"[RAZORPAY] Keys missing or client init failed for {email}")
        return {
            "order_id": f"order_mock_{int(datetime.utcnow().timestamp())}",
            "amount": price * 100,
            "currency": "INR",
            "key": os.getenv("RZP_KEY_ID", "rzp_test_placeholder"),
            "plan_name": req.plan_name,
            "diamonds": diamonds,
            "email": email,
            "mock": True,
            "message": "Razorpay API keys are not configured. Using mock payment."
        }

    try:
        print(f"[RAZORPAY] Creating order for {email}: {req.plan_name}")
        order_data = {
            "amount": price * 100,  # paise
            "currency": "INR",
            "receipt": f"rcpt_{int(datetime.utcnow().timestamp())}",
            "payment_capture": 1,  # Auto capture
            "notes": {"email": email, "plan": req.plan_name, "diamonds": diamonds, "mode": "test"},
        }
        order = rzp.order.create(data=order_data)
        print(f"[RAZORPAY] Order created: {order['id']}")
        
        return {
            "order_id": order["id"],
            "amount": order["amount"],
            "currency": order["currency"],
            "key": os.getenv("RZP_KEY_ID", ""),
            "plan_name": req.plan_name,
            "diamonds": diamonds,
            "email": email,
            "mock": False
        }
    except Exception as e:
        print(f"[RAZORPAY ERROR] Order creation failed for {email}: {str(e)}")
        # If it fails, we raise an error instead of falling back silently
        # This makes it easier for the user to see what's wrong
        raise HTTPException(500, f"Razorpay order creation failed: {str(e)}")


@router.post("/payment/verify-payment")
async def verify_payment(req: VerifyPaymentRequest, email: str = Depends(get_current_user_email)):
    """Verify Razorpay signature and credit diamonds + update plan."""
    print(f"[PAYMENT] Verifying payment for {email}, order={req.razorpay_order_id}")
    rzp = get_rzp_client()
    is_mock = req.razorpay_order_id.startswith("order_mock_")
    _, diamonds = _resolve_plan_values(req.plan_name, None, req.diamonds)
    
    try:
        if not is_mock:
            if not rzp:
                raise HTTPException(500, "Razorpay keys not configured for verification")
            try:
                print(f"[PAYMENT] Validating real signature for {email}")
                rzp.utility.verify_payment_signature({
                    "razorpay_order_id": req.razorpay_order_id,
                    "razorpay_payment_id": req.razorpay_payment_id,
                    "razorpay_signature": req.razorpay_signature,
                })
            except Exception as sig_err:
                print(f"[PAYMENT] Signature verification failed for {email}: {str(sig_err)}")
                raise HTTPException(400, "Payment signature verification failed")
        else:
            print(f"[PAYMENT] Processing mock verification for {email}")

        db = get_db()
        now = datetime.utcnow()
        
        # Credit diamonds to user
        history_entry = {
            "order_id": req.razorpay_order_id,
            "payment_id": req.razorpay_payment_id,
            "plan_name": req.plan_name,
            "diamonds": diamonds,
            "timestamp": now,
            "status": "Paid",
            "mock": is_mock
        }
        
        print(f"[PAYMENT] Updating DB for {email}: +{diamonds} diamonds")
        
        # Pre-check: ensure diamonds is an integer (in case it was null)
        user_check = await db.users.find_one({"email": email})
        if user_check and user_check.get("diamonds") is None:
            await db.users.update_one({"email": email}, {"$set": {"diamonds": 0}})

        result = await db.users.update_one(
            {"email": email},
            {
                "$inc": {"diamonds": diamonds},
                "$set": {"plan": req.plan_name, "last_payment_at": now},
                "$push": {"purchase_history": history_entry},
            },
        )
        
        if result.matched_count == 0:
            print(f"[PAYMENT ERROR] User not found in DB: {email}")
            raise HTTPException(404, f"User {email} not found in database")

        user = await db.users.find_one({"email": email})
        print(f"[PAYMENT] Success! {email} total diamonds: {user.get('diamonds')}")
        
        return {
            "success": True,
            "diamonds": user.get("diamonds", 0),
            "plan": req.plan_name,
            "purchase_history": _serialize_history(user.get("purchase_history", [])),
            "message": "Payment verified and diamonds credited."
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"[PAYMENT ERROR] Critical failure for {email}: {str(e)}")
        raise HTTPException(500, f"Internal payment error: {str(e)}")


@router.post("/payment/deduct-diamonds")
async def deduct_diamonds(req: DeductDiamondsRequest, email: str = Depends(get_current_user_email)):
    """Deduct diamonds for a pipeline action. Returns 402 if balance is insufficient."""
    db = get_db()
    user = await db.users.find_one({"email": email})

    if not user:
        raise HTTPException(404, "User not found")

    current = user.get("diamonds", 0)

    if current < req.amount:
        raise HTTPException(
            402,
            detail={
                "error": "insufficient_diamonds",
                "message": "Not enough diamonds. Please purchase a plan.",
                "current_balance": current,
                "required": req.amount,
            },
        )

    await db.users.update_one({"email": email}, {"$inc": {"diamonds": -req.amount}})
    remaining = current - req.amount
    print(f"[DIAMONDS] Deducted {req.amount} from {email}: {current} -> {remaining}")
    return {"success": True, "deducted": req.amount, "remaining_diamonds": remaining}
