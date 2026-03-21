from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from datetime import datetime

from app.database import get_db
from app.models import DriverDevice
from app.schemas import DeviceRegister, DeviceLocationUpdate

router = APIRouter(prefix="/devices", tags=["devices"])


@router.post("/register")
def register_device(data: DeviceRegister, db: Session = Depends(get_db)):
    device = db.query(DriverDevice).filter(DriverDevice.device_id == data.device_id).first()
    if device:
        device.fcm_token = data.fcm_token or device.fcm_token
        device.phone_number = data.phone_number or device.phone_number
        device.latitude = data.latitude or device.latitude
        device.longitude = data.longitude or device.longitude
        device.last_seen = datetime.utcnow()
    else:
        device = DriverDevice(**data.model_dump())
        db.add(device)
    db.commit()
    return {"status": "registered", "device_id": data.device_id}


@router.post("/location")
def update_device_location(data: DeviceLocationUpdate, db: Session = Depends(get_db)):
    device = db.query(DriverDevice).filter(DriverDevice.device_id == data.device_id).first()
    if not device:
        return {"error": "Device not found"}
    device.latitude = data.latitude
    device.longitude = data.longitude
    device.last_seen = datetime.utcnow()
    db.commit()
    return {"status": "ok"}
