from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from pymongo.database import Database

from app.core.database import get_db
from app.core.security import decode_access_token
from app.services.auth_service import get_user_by_email

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/login")


def get_database() -> Database:
    return get_db()


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Database = Depends(get_database),
) -> dict:
    try:
        payload = decode_access_token(token)
        email = payload.get("sub")
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token.") from exc

    if not email:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token payload.")

    user = get_user_by_email(db, email)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User does not exist.")

    return user
