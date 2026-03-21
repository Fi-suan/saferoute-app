from pydantic_settings import BaseSettings
from typing import Optional


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

    # Geofencing settings
    BUFFER_ZONE_KM: float = 5.0
    ALERT_RADIUS_KM: float = 15.0
    DANGER_THRESHOLD_KM: float = 3.0

    # Simulator
    SIMULATOR_INTERVAL_SECONDS: int = 5

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
