from fastapi import APIRouter, Depends

from app.api.deps import get_current_user
from app.models.schemas import UserResponse
from app.services.auth_service import public_user_dict

router = APIRouter()


@router.get("/me", response_model=UserResponse)
def read_current_user(current_user: dict = Depends(get_current_user)):
    return UserResponse(**public_user_dict(current_user))

