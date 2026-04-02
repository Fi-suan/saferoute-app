from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app.database import get_db
from app.models import Herd, HerdLocation, Device
from app.schemas import HerdCreate, HerdOut, HerdLocationOut, LocationPoint
from app.services.geofencing import process_location_update
from app.services.notifications import notify_nearby_drivers
from app.services.auth import get_current_device

router = APIRouter(prefix="/herds", tags=["herds"])


def _latest_loc(herd: Herd, db: Session):
    return db.query(HerdLocation).filter(
        HerdLocation.herd_id == herd.id
    ).order_by(HerdLocation.timestamp.desc()).first()


def _build_herd_out(herd: Herd, db: Session) -> HerdOut:
    loc = _latest_loc(herd, db)
    return HerdOut(
        id=herd.id,
        name=herd.name,
        animal_type=herd.animal_type,
        estimated_count=herd.estimated_count,
        owner_name=herd.owner_name,
        is_active=herd.is_active,
        created_at=herd.created_at,
        current_location=HerdLocationOut.model_validate(loc) if loc else None,
    )


@router.get("/", response_model=List[HerdOut])
def list_herds(db: Session = Depends(get_db)):
    """Список всех активных стад с текущей позицией"""
    herds = db.query(Herd).filter(Herd.is_active == True).all()
    return [_build_herd_out(h, db) for h in herds]


@router.get("/{herd_id}", response_model=HerdOut)
def get_herd(herd_id: int, db: Session = Depends(get_db)):
    herd = db.query(Herd).filter(Herd.id == herd_id).first()
    if not herd:
        raise HTTPException(status_code=404, detail="Стадо не найдено")
    return _build_herd_out(herd, db)


@router.post("/", response_model=HerdOut, status_code=201)
def create_herd(data: HerdCreate, db: Session = Depends(get_db), current: Device = Depends(get_current_device)):
    herd = Herd(**data.model_dump())
    db.add(herd)
    db.commit()
    db.refresh(herd)
    return _build_herd_out(herd, db)


@router.post("/{herd_id}/location")
def update_herd_location(herd_id: int, loc: LocationPoint, db: Session = Depends(get_db), current: Device = Depends(get_current_device)):
    """Принять новую GPS-координату от ошейника / симулятора"""
    herd = db.query(Herd).filter(Herd.id == herd_id).first()
    if not herd:
        raise HTTPException(status_code=404, detail="Стадо не найдено")

    location = HerdLocation(
        herd_id=herd_id,
        latitude=loc.latitude,
        longitude=loc.longitude,
        speed_kmh=loc.speed_kmh,
        heading_degrees=loc.heading_degrees,
        source=loc.source,
    )
    db.add(location)
    db.commit()

    alert = process_location_update(db, herd, loc.latitude, loc.longitude, loc.speed_kmh)
    notified = notify_nearby_drivers(db, alert, loc.latitude, loc.longitude) if alert else 0

    return {
        "status": "ok",
        "alert": alert.level.value if alert else None,
        "alert_id": alert.id if alert else None,
        "drivers_notified": notified,
    }


@router.get("/{herd_id}/track", response_model=List[HerdLocationOut])
def get_herd_track(herd_id: int, limit: int = 100, db: Session = Depends(get_db)):
    locs = (
        db.query(HerdLocation)
        .filter(HerdLocation.herd_id == herd_id)
        .order_by(HerdLocation.timestamp.desc())
        .limit(limit)
        .all()
    )
    return [HerdLocationOut.model_validate(l) for l in locs]
