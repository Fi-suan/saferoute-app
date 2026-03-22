from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from datetime import datetime

from app.database import get_db
from app.models import Device, Role
from app.schemas import DeviceRegister, DeviceLocationUpdate

router = APIRouter(prefix="/devices", tags=["devices"])


@router.post("/register")
def register_device(data: DeviceRegister, db: Session = Depends(get_db)):
    device = db.query(Device).filter(Device.device_id == data.device_id).first()
    if device:
        # User is already registered; update token/location but not role
        device.fcm_token = data.fcm_token or device.fcm_token
        device.phone_number = data.phone_number or device.phone_number
        device.latitude = data.latitude or device.latitude
        device.longitude = data.longitude or device.longitude
        device.last_seen = datetime.utcnow()
    else:
        # Assign role from enum or fallback 
        role = Role.OWNER if data.role == 'owner' else Role.DRIVER
        device = Device(
            device_id=data.device_id,
            role=role,
            fcm_token=data.fcm_token,
            phone_number=data.phone_number,
            latitude=data.latitude,
            longitude=data.longitude
        )
        db.add(device)
    db.commit()
    return {"status": "registered", "device_id": data.device_id, "role": device.role.value}


@router.post("/location")
def update_device_location(data: DeviceLocationUpdate, db: Session = Depends(get_db)):
    device = db.query(Device).filter(Device.device_id == data.device_id).first()
    if not device:
        return {"error": "Device not found"}
    device.latitude = data.latitude
    device.longitude = data.longitude
    device.last_seen = datetime.utcnow()
    db.commit()
    return {"status": "ok"}
