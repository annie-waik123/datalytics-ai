from typing import Literal

from pydantic import BaseModel, EmailStr, Field, field_validator, model_validator


class SignupRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=72)
    confirm_password: str = Field(min_length=8, max_length=72)

    @field_validator("password")
    @classmethod
    def validate_password_strength(cls, value: str) -> str:
        if not any(char.isdigit() for char in value):
            raise ValueError("Password must include at least one number.")
        if not any(char.isupper() for char in value):
            raise ValueError("Password must include at least one uppercase letter.")
        if not any(char.islower() for char in value):
            raise ValueError("Password must include at least one lowercase letter.")
        return value

    @model_validator(mode="after")
    def validate_password_match(self) -> "SignupRequest":
        if self.password != self.confirm_password:
            raise ValueError("Passwords do not match.")
        return self


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=72)


class VerifyOtpRequest(BaseModel):
    email: EmailStr
    otp: str = Field(pattern=r"^\d{6}$")
    purpose: Literal["signup", "login"]


class StepResponse(BaseModel):
    message: str
    otp_required: bool = False
    purpose: Literal["signup", "login"] | None = None
    email: EmailStr | None = None
    dev_otp: str | None = None


class VerifyOtpResponse(BaseModel):
    message: str
    access_token: str | None = None
    token_type: str | None = None


class UserResponse(BaseModel):
    id: str
    email: EmailStr
    is_verified: bool
    provider: str

