"""
GPS Simulator — generates fake herd movement for demo purposes.
No PostGIS / geoalchemy2 / shapely — pure Python only.
"""
import math
import random
import logging
from datetime import datetime
from typing import List, Dict
from sqlalchemy.orm import Session
from app.models import Herd, HerdLocation, AnimalType
from app.services.geofencing import process_location_update

logger = logging.getLogger(__name__)

INITIAL_HERD_POSITIONS = [
    {"name": "Табун сайгаков «Альфа»", "animal_type": AnimalType.SAIGA, "estimated_count": 47, "owner_name": "Казахстанский зоологический институт", "start_lat": 51.05, "start_lon": 71.45, "target_lat": 51.18, "target_lon": 71.50, "speed_variation": 0.3},
    {"name": "Табун лошадей «Степной бриз»", "animal_type": AnimalType.HORSE, "estimated_count": 23, "owner_name": "Фермер Аманжол Сейткали", "start_lat": 51.25, "start_lon": 71.80, "target_lat": 51.18, "target_lon": 71.85, "speed_variation": 0.5},
    {"name": "Стадо верблюдов «Арал»", "animal_type": AnimalType.CAMEL, "estimated_count": 12, "owner_name": "Фермер Болат Нурпеисов", "start_lat": 51.10, "start_lon": 72.10, "target_lat": 51.18, "target_lon": 72.08, "speed_variation": 0.2},
    {"name": "Табун сайгаков «Бета»", "animal_type": AnimalType.SAIGA, "estimated_count": 88, "owner_name": "Казахстанский зоологический институт", "start_lat": 51.00, "start_lon": 72.40, "target_lat": 51.18, "target_lon": 72.35, "speed_variation": 0.4},
]

_sim_state: Dict[int, Dict] = {}
_tick_count: int = 0


def initialize_simulator(db: Session) -> List[Herd]:
    herds = []
    for config in INITIAL_HERD_POSITIONS:
        existing = db.query(Herd).filter(Herd.name == config["name"]).first()
        if existing:
            herds.append(existing)
            _init_herd_state(existing.id, config)
            continue

        herd = Herd(
            name=config["name"],
            animal_type=config["animal_type"],
            estimated_count=config["estimated_count"],
            owner_name=config["owner_name"],
        )
        db.add(herd)
        db.commit()
        db.refresh(herd)

        initial_loc = HerdLocation(
            herd_id=herd.id,
            latitude=config["start_lat"],
            longitude=config["start_lon"],
            speed_kmh=0.0,
            source="simulator",
        )
        db.add(initial_loc)
        db.commit()
        _init_herd_state(herd.id, config)
        herds.append(herd)

    return herds


def _init_herd_state(herd_id: int, config: dict):
    _sim_state[herd_id] = {
        "current_lat": config["start_lat"],
        "current_lon": config["start_lon"],
        "target_lat": config["target_lat"],
        "target_lon": config["target_lon"],
        "speed_variation": config["speed_variation"],
        "arrived": False,
    }


def simulator_tick(db: Session) -> Dict:
    global _tick_count
    _tick_count += 1

    if not _sim_state:
        initialize_simulator(db)

    results = []
    for herd_id, state in list(_sim_state.items()):
        if state["arrived"]:
            continue
        herd = db.query(Herd).filter(Herd.id == herd_id).first()
        if not herd:
            continue

        base_step = 0.001
        step = base_step * (1.0 + random.uniform(-state["speed_variation"], state["speed_variation"]))
        step = max(0.0005, min(step, 0.006))

        dlat = state["target_lat"] - state["current_lat"]
        dlon = state["target_lon"] - state["current_lon"]
        dist = math.sqrt(dlat ** 2 + dlon ** 2)

        if dist < step * 0.5:
            state["arrived"] = True
            continue

        new_lat = state["current_lat"] + (dlat / dist) * step + random.uniform(-0.0002, 0.0002)
        new_lon = state["current_lon"] + (dlon / dist) * step + random.uniform(-0.0002, 0.0002)
        state["current_lat"] = new_lat
        state["current_lon"] = new_lon

        from app.config import settings
        # At Kazakhstan's latitude (~51°N), 1° lon ≈ 70 km; average with lat (111 km) ≈ 90 km
        km_per_degree = 90.0
        speed = (step * km_per_degree) / (settings.SIMULATOR_INTERVAL_SECONDS / 3600.0)

        try:
            loc = HerdLocation(
                herd_id=herd_id, latitude=new_lat, longitude=new_lon,
                speed_kmh=speed, source="simulator",
            )
            db.add(loc)
            alert = process_location_update(db, herd, new_lat, new_lon, speed)
            db.commit()
            results.append({
                "herd_id": herd_id,
                "lat": new_lat, "lon": new_lon,
                "alert_level": alert.level.value if alert else None,
            })
        except Exception as e:
            logger.error(f"Simulator tick error for herd {herd_id}: {e}")
            db.rollback()

    # Clean up arrived herds to prevent unbounded growth
    arrived_ids = [hid for hid, s in _sim_state.items() if s["arrived"]]
    for hid in arrived_ids:
        del _sim_state[hid]

    return {"tick": _tick_count, "herds": results}


def get_simulator_status() -> Dict:
    return {
        "running": bool(_sim_state),
        "tick_count": _tick_count,
        "herds": [{"herd_id": hid, "lat": s["current_lat"], "lon": s["current_lon"], "arrived": s["arrived"]} for hid, s in _sim_state.items()],
    }


def reset_simulator(db: Session):
    global _tick_count, _sim_state
    _tick_count = 0
    _sim_state = {}
    initialize_simulator(db)
