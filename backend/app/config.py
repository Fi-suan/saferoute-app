from pydantic_settings import BaseSettings
from typing import Optional, List
import secrets


class Settings(BaseSettings):
    # Database
    DATABASE_URL: str = "postgresql://postgres:postgres@localhost:5432/saferoute"

    # Firebase FCM
    FIREBASE_CREDENTIALS_PATH: Optional[str] = None

    # Twilio SMS
    TWILIO_ACCOUNT_SID: Optional[str] = None
    TWILIO_AUTH_TOKEN: Optional[str] = None
    TWILIO_PHONE_NUMBER: Optional[str] = None

    # App
    APP_NAME: str = "SafeRoute / Sapa Jol"
    DEBUG: bool = False

    # Auth
    JWT_SECRET: str = secrets.token_urlsafe(32)
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

    # Simulator
    SIMULATOR_INTERVAL_SECONDS: int = 5

    @property
    def cors_origins_list(self) -> List[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
