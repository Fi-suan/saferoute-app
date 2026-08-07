import logging
import secrets

from pydantic_settings import BaseSettings

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
    GOOGLE_MAPS_API_KEY: str | None = None

    # CORS — comma-separated allowed origins
    CORS_ORIGINS: str = "https://saferoute.kz,https://admin.saferoute.kz"

    # Объектное хранилище фотографий (S3-совместимое: R2, S3, MinIO, B2).
    # Пока не заданы — фото проверяется моделью и не сохраняется.
    S3_ENDPOINT_URL: str | None = None
    S3_BUCKET: str | None = None
    S3_ACCESS_KEY_ID: str | None = None
    S3_SECRET_ACCESS_KEY: str | None = None
    # Публичный адрес бакета: домен r2.dev или свой CNAME.
    S3_PUBLIC_BASE_URL: str | None = None
    # У R2 регион всегда "auto"; для AWS — настоящий регион бакета.
    S3_REGION: str = "auto"

    # Rate limiting
    RATE_LIMIT_DEFAULT: str = "60/minute"
    RATE_LIMIT_REPORT: str = "10/minute"

    # Geofencing settings
    BUFFER_ZONE_KM: float = 5.0
    ALERT_RADIUS_KM: float = 15.0
    DANGER_THRESHOLD_KM: float = 3.0


    @property
    def photo_storage_enabled(self) -> bool:
        # S3_ENDPOINT_URL намеренно не обязателен: у обычного AWS S3 его не
        # задают, он нужен только совместимым хранилищам вроде R2 и MinIO.
        return all([
            self.S3_BUCKET,
            self.S3_ACCESS_KEY_ID,
            self.S3_SECRET_ACCESS_KEY,
            self.S3_PUBLIC_BASE_URL,
        ])

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()

# Detect fallback usage: pydantic-settings loads from env vars AND .env file,
# so check the resolved value rather than os.environ alone.
if settings.JWT_SECRET == _FALLBACK_JWT_SECRET:
    if not settings.DEBUG:
        raise RuntimeError(
            "JWT_SECRET is required in production. "
            "Set it via env var or .env file, or set DEBUG=true for development."
        )
    _logger.warning(
        "JWT_SECRET not set — using random fallback (DEBUG mode). "
        "Tokens will be invalid after restart."
    )
