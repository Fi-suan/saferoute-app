"""
Auth service — JWT-based device authentication
"""
from datetime import UTC, datetime, timedelta

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models import Device

security = HTTPBearer(auto_error=False)


def create_device_token(device_id: str) -> str:
    payload = {
        "sub": device_id,
        "iat": datetime.now(UTC),
        "exp": datetime.now(UTC) + timedelta(days=settings.JWT_EXPIRE_DAYS),
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def decode_token(token: str) -> str | None:
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
        return payload.get("sub")
    except jwt.PyJWTError:
        return None


def get_current_device(
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
    db: Session = Depends(get_db),
) -> Device:
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authorization header required",
        )
    device_id = decode_token(credentials.credentials)
    if not device_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )
    device = db.query(Device).filter(Device.device_id == device_id).first()
    if not device:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Device not registered",
        )
    return device


def get_optional_device(
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
    db: Session = Depends(get_db),
) -> Device | None:
    """Same as get_current_device but returns None instead of raising."""
    if not credentials:
        return None
    device_id = decode_token(credentials.credentials)
    if not device_id:
        return None
    return db.query(Device).filter(Device.device_id == device_id).first()
