import os
import jwt
from fastapi import Request

SECRET_KEY = os.getenv("JWT_SECRET", "super-secret-key-datalytics")
ALGORITHM = "HS256"

async def get_optional_user_email(request: Request) -> str | None:
    """
    Extracts the user email from the Authorization header if present.
    Returns None if the header is missing or the token is invalid.
    """
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        return None
    
    token = auth_header.split(" ")[1]
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload.get("sub")
    except Exception:
        return None
