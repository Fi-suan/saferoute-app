from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime

from app.database import get_db
from app.models import Device, IncidentReport, IncidentConfirmation
from app.schemas import DeviceLocationUpdate
from app.services.auth import get_current_device

router = APIRouter(prefix="/devices", tags=["devices"])


@router.post("/location")
def update_device_location(
    data: DeviceLocationUpdate,
    db: Session = Depends(get_db),
    current: Device = Depends(get_current_device),
):
    """Update device location (requires auth)."""
    if current.device_id != data.device_id:
        raise HTTPException(status_code=403, detail="Cannot update another device")
    current.latitude = data.latitude
    current.longitude = data.longitude
    current.last_seen = datetime.utcnow()
    db.commit()
    return {"status": "ok"}


@router.delete("/{device_id}/data")
def delete_device_data(
    device_id: str,
    db: Session = Depends(get_db),
    current: Device = Depends(get_current_device),
):
    """Delete all user data for GDPR compliance."""
    if current.device_id != device_id:
        raise HTTPException(status_code=403, detail="Cannot delete another device's data")

    # Delete incident confirmations
    db.query(IncidentConfirmation).filter(
        IncidentConfirmation.device_id == device_id
    ).delete()

    # Delete incident reports
    db.query(IncidentReport).filter(
        IncidentReport.reporter_device_id == device_id
    ).delete()

    # Delete device record
    db.query(Device).filter(Device.device_id == device_id).delete()

    db.commit()
    return {"status": "deleted", "device_id": device_id}
