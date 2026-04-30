from pydantic_settings import BaseSettings
from typing import Optional, List
import logging
import os
import secrets

_logger = logging.getLogger(__name__)

# Generate stable fallback only once per process
_FALLBACK_JWT_SECRET = secrets.token_urlsafe(32)


class Settings(BaseSettings):
    # Database
    DATABASE_URL: str = "postgresql://postgres:postgres@localhost:5432/saferoute"


    # App
    APP_NAME: str = "SafeRoute / Sapa Jol"
    DEBUG: bool = False

    # Auth — MUST be set via env var in production
    JWT_SECRET: str = _FALLBACK_JWT_SECRET
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_DAYS: int = 365

    # Google Maps (for backend proxy)
    GOOGLE_MAPS_API_KEY: Optional[str] = None

    # CORS — comma-separated allowed origins
    CORS_ORIGINS: str = "https://saferoute.kz,https://admin.saferoute.kz"

    # Rate limiting
    RATE_LIMIT_DEFAULT: str = "60/minute"
    RATE_LIMIT_REPORT: str = "10/minute"

    # Geofencing settings
    BUFFER_ZONE_KM: float = 5.0
    ALERT_RADIUS_KM: float = 15.0
    DANGER_THRESHOLD_KM: float = 3.0


    @property
    def cors_origins_list(self) -> List[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()

if not os.environ.get("JWT_SECRET"):
    if not settings.DEBUG:
        raise RuntimeError(
            "JWT_SECRET environment variable is required in production. "
            "Set JWT_SECRET in .env or set DEBUG=true for development."
        )
    _logger.warning(
        "JWT_SECRET not set — using random fallback (DEBUG mode). "
        "Tokens will be invalid after restart."
    )
