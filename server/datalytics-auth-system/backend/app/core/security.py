from datetime import datetime, timedelta, timezone
import secrets
import string

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.core.config import get_settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_secret(raw_value: str) -> str:
    return pwd_context.hash(raw_value)


def verify_secret(raw_value: str, hashed_value: str) -> bool:
    return pwd_context.verify(raw_value, hashed_value)


def generate_otp() -> str:
    digits = string.digits
    return "".join(secrets.choice(digits) for _ in range(6))


def create_access_token(subject: str) -> str:
    settings = get_settings()
    expire_at = datetime.now(timezone.utc) + timedelta(minutes=settings.jwt_expire_minutes)
    payload = {"sub": subject, "exp": expire_at}
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_access_token(token: str) -> dict:
    settings = get_settings()
    try:
        return jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except JWTError as exc:
        raise ValueError("Invalid or expired token.") from exc

