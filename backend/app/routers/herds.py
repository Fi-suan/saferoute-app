import logging
from datetime import UTC, datetime

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import SessionLocal, get_db
from app.models import Alert, Device, Herd, HerdLocation, Role
from app.schemas import HerdCreate, HerdLocationOut, HerdOut, LocationPoint
from app.services.auth import get_current_device
from app.services.geofencing import process_location_update
from app.services.notifications import notify_nearby_drivers

logger = logging.getLogger(__name__)

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


@router.get("/", response_model=list[HerdOut])
def list_herds(db: Session = Depends(get_db)):
    """Список всех активных стад с текущей позицией"""
    from sqlalchemy import func
    herds = db.query(Herd).filter(Herd.is_active.is_(True)).all()
    if not herds:
        return []

    # Batch load latest locations for all herds in 1 query (fixes N+1)
    herd_ids = [h.id for h in herds]
    latest_subq = (
        db.query(
            HerdLocation.herd_id,
            func.max(HerdLocation.id).label("max_id"),
        )
        .filter(HerdLocation.herd_id.in_(herd_ids))
        .group_by(HerdLocation.herd_id)
        .subquery()
    )
    latest_locs = (
        db.query(HerdLocation)
        .join(latest_subq, HerdLocation.id == latest_subq.c.max_id)
        .all()
    )
    loc_map = {loc.herd_id: loc for loc in latest_locs}

    result = []
    for herd in herds:
        loc = loc_map.get(herd.id)
        result.append(HerdOut(
            id=herd.id, name=herd.name, animal_type=herd.animal_type,
            estimated_count=herd.estimated_count, owner_name=herd.owner_name,
            is_active=herd.is_active, created_at=herd.created_at,
            current_location=HerdLocationOut.model_validate(loc) if loc else None,
        ))
    return result


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


def _notify_task(alert_id: int, herd_lat: float, herd_lon: float) -> None:
    """
    Фоновая рассылка. Своя сессия: та, что обслуживала запрос, к этому моменту
    уже закрыта зависимостью get_db.
    """
    db = SessionLocal()
    try:
        alert = db.query(Alert).filter(Alert.id == alert_id).first()
        if alert:
            notify_nearby_drivers(db, alert, herd_lat, herd_lon)
    except Exception:
        logger.exception("Фоновая рассылка по алерту %s не удалась", alert_id)
    finally:
        db.close()


@router.post("/{herd_id}/location")
def update_herd_location(
    herd_id: int,
    loc: LocationPoint,
    background: BackgroundTasks,
    db: Session = Depends(get_db),
    current: Device = Depends(get_current_device),
):
    """Принять новую GPS-координату от ошейника / симулятора"""
    if current.role != Role.OWNER:
        raise HTTPException(status_code=403, detail="Only livestock owners can update herd locations")

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

    # Location insert + alert creation in single transaction
    try:
        alert, alert_created = process_location_update(
            db, herd, loc.latitude, loc.longitude, loc.speed_kmh
        )
        db.commit()
    except Exception:
        db.rollback()
        raise

    # Рассылка уходит в фон: ответ ошейнику не должен ждать похода в Expo.
    # Только по новым алертам — см. process_location_update.
    notifying = alert is not None and alert_created
    if notifying:
        background.add_task(_notify_task, alert.id, loc.latitude, loc.longitude)

    return {
        "status": "ok",
        "alert": alert.level.value if alert else None,
        "alert_id": alert.id if alert else None,
        "notifying": notifying,
    }


@router.patch("/{herd_id}/deactivate")
def deactivate_herd(herd_id: int, db: Session = Depends(get_db), current: Device = Depends(get_current_device)):
    """Deactivate herd (manual mode off) and resolve associated active alerts."""
    herd = db.query(Herd).filter(Herd.id == herd_id).first()
    if not herd:
        raise HTTPException(status_code=404, detail="Herd not found")
    herd.is_active = False

    # Resolve any active alerts for this herd — they no longer make sense.
    now = datetime.now(UTC)
    resolved = db.query(Alert).filter(
        Alert.herd_id == herd_id,
        Alert.is_active.is_(True),
    ).update({"is_active": False, "resolved_at": now})

    db.commit()
    return {"status": "ok", "herd_id": herd_id, "alerts_resolved": resolved}


@router.get("/{herd_id}/track", response_model=list[HerdLocationOut])
def get_herd_track(herd_id: int, limit: int = 100, db: Session = Depends(get_db)):
    locs = (
        db.query(HerdLocation)
        .filter(HerdLocation.herd_id == herd_id)
        .order_by(HerdLocation.timestamp.desc())
        .limit(limit)
        .all()
    )
    return [HerdLocationOut.model_validate(loc_row) for loc_row in locs]
