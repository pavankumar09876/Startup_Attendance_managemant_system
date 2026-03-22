from pydantic_settings import BaseSettings
from pydantic import field_validator
from typing import Optional
import os


class Settings(BaseSettings):
    # App
    APP_NAME: str = "Workforce Pro"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://postgres:password@localhost:5432/workforce_pro"

    # Redis (ARQ background worker)
    REDIS_URL: str = "redis://localhost:6379"

    # JWT
    SECRET_KEY: str = "your-secret-key-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # CORS
    ALLOWED_ORIGINS: list[str] = ["http://localhost:3000", "http://localhost:3001", "http://localhost:3002", "http://localhost:5173"]

    # SMTP (optional — leave blank to skip email sending)
    SMTP_HOST: Optional[str] = None
    SMTP_PORT: int = 587
    SMTP_USER: Optional[str] = None
    SMTP_PASS: Optional[str] = None
    EMAIL_FROM: str = "noreply@workforcepro.com"

    @field_validator("ALLOWED_ORIGINS", mode="before")
    @classmethod
    def parse_allowed_origins(cls, v):
        if isinstance(v, str):
            return [origin.strip() for origin in v.split(",") if origin.strip()]
        return v

    @field_validator("SECRET_KEY")
    @classmethod
    def secret_key_must_be_strong(cls, v: str) -> str:
        insecure_defaults = {"your-secret-key-change-in-production", "secret", "changeme"}
        is_production = os.getenv("ENV", "development").lower() == "production"
        if is_production and (v.lower() in insecure_defaults or "change" in v.lower() or len(v) < 32):
            raise ValueError(
                "SECRET_KEY is weak or uses a default value. "
                "Set a strong random key via the SECRET_KEY env var (32+ characters)."
            )
        if v.lower() in insecure_defaults or len(v) < 32:
            import warnings
            warnings.warn(
                "WARNING: SECRET_KEY is weak. Set a strong random key for production (32+ chars).",
                stacklevel=2,
            )
        return v

    @field_validator("DATABASE_URL")
    @classmethod
    def database_url_must_not_use_default_password(cls, v: str) -> str:
        is_production = os.getenv("ENV", "development").lower() == "production"
        if is_production and "postgres:password@" in v:
            raise ValueError(
                "DATABASE_URL contains the default password. "
                "Set a real DATABASE_URL via environment variable."
            )
        return v

    class Config:
        env_file = ".env"


settings = Settings()
