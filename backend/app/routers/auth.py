"""
Auth Router — device registration and token management
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from datetime import datetime, timezone

from app.database import get_db
from app.models import Device, Role
from app.schemas import DeviceRegister
from app.services.auth import create_device_token, get_current_device

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register")
def register_device(data: DeviceRegister, db: Session = Depends(get_db)):
    """Register device and return JWT token."""
    device = db.query(Device).filter(Device.device_id == data.device_id).first()
    if device:
        device.fcm_token = data.fcm_token or device.fcm_token
        device.phone_number = data.phone_number or device.phone_number
        device.latitude = data.latitude
        device.longitude = data.longitude
        device.last_seen = datetime.now(timezone.utc)
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
        "last_seen": device.last_seen.isoformat() if device.last_seen else None,
    }
