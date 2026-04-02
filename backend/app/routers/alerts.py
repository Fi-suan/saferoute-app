from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime

from app.database import get_db
from app.models import Alert, Herd, GeoZone, Device
from app.schemas import AlertOut
from app.services.auth import get_current_device

router = APIRouter(prefix="/alerts", tags=["alerts"])


def _enrich_alert(alert: Alert) -> AlertOut:
    data = AlertOut.model_validate(alert)
    if alert.herd:
        data.herd_name = alert.herd.name
        data.herd_animal_type = alert.herd.animal_type.value
    if alert.geozone:
        data.geozone_name = alert.geozone.name
    return data


@router.get("/active", response_model=List[AlertOut])
def get_active_alerts(db: Session = Depends(get_db)):
    """Все активные предупреждения"""
    alerts = (
        db.query(Alert)
        .filter(Alert.is_active == True)
        .order_by(Alert.created_at.desc())
        .all()
    )
    return [_enrich_alert(a) for a in alerts]


@router.get("/history", response_model=List[AlertOut])
def get_alert_history(limit: int = 50, db: Session = Depends(get_db)):
    """История всех предупреждений"""
    alerts = (
        db.query(Alert)
        .order_by(Alert.created_at.desc())
        .limit(limit)
        .all()
    )
    return [_enrich_alert(a) for a in alerts]


@router.post("/{alert_id}/resolve")
def resolve_alert(alert_id: int, db: Session = Depends(get_db), current: Device = Depends(get_current_device)):
    alert = db.query(Alert).filter(Alert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    alert.is_active = False
    alert.resolved_at = datetime.utcnow()
    db.commit()
    return {"status": "resolved", "alert_id": alert_id}
