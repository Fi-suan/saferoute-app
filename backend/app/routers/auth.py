"""
Auth Router — device registration and token management
"""
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, Request
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Device, Role, as_utc
from app.schemas import DeviceRegister
from app.services.auth import create_device_token, get_current_device

limiter = Limiter(key_func=get_remote_address)

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register")
@limiter.limit("5/minute")
def register_device(request: Request, data: DeviceRegister, db: Session = Depends(get_db)):
    """Register device and return JWT token."""
    device = db.query(Device).filter(Device.device_id == data.device_id).first()
    if device:
        device.fcm_token = data.fcm_token or device.fcm_token
        device.phone_number = data.phone_number or device.phone_number
        # Только если координаты прислали. Раньше присваивалось безусловно, и
        # повторная регистрация (она идёт на каждом запуске приложения и не
        # передаёт координат) обнуляла позицию — после чего устройство выпадало
        # из рассылки предупреждений, которая отбирает водителей по позиции.
        if data.latitude is not None:
            device.latitude = data.latitude
        if data.longitude is not None:
            device.longitude = data.longitude
        device.last_seen = datetime.now(UTC)
    else:
        role = Role.OWNER if data.role == "owner" else Role.DRIVER
        device = Device(
            device_id=data.device_id,
            role=role,
            fcm_token=data.fcm_token,
            phone_number=data.phone_number,
            latitude=data.latitude,
            longitude=data.longitude,
        )
        db.add(device)
    db.commit()
    db.refresh(device)

    token = create_device_token(data.device_id)
    return {
        "status": "registered",
        "device_id": data.device_id,
        "role": device.role.value,
        "token": token,
    }


@router.get("/profile")
def get_profile(device: Device = Depends(get_current_device)):
    """Return current device profile (requires auth)."""
    return {
        "device_id": device.device_id,
        "role": device.role.value,
        "phone_number": device.phone_number,
        "last_seen": as_utc(device.last_seen).isoformat() if device.last_seen else None,
    }
