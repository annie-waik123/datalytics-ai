from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "DATALYTICS Auth System"
    env: str = "development"
    port: int = 5000

    frontend_url: str = "http://localhost:3000"

    mongodb_uri: str = "mongodb://127.0.0.1:27017"
    mongodb_db_name: str = "datalytics_auth"

    jwt_secret: str = "change-me"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 1440

    session_secret: str = "change-session-secret"

    otp_expiry_minutes: int = 10
    otp_max_attempts: int = 5

    email_user: str = ""
    email_pass: str = ""
    smtp_host: str = "smtp.gmail.com"
    smtp_port: int = 587

    google_client_id: str = ""
    google_client_secret: str = ""
    google_callback_url: str = "http://localhost:5000/auth/google/callback"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()

