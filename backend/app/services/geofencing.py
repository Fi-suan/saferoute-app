"""
Geofencing Engine — pure Python, no PostGIS required.
Uses Haversine formula for distance calculations.
"""
import math
from typing import Optional, Tuple, List
from datetime import datetime
from sqlalchemy.orm import Session
from app.models import Herd, HerdLocation, GeoZone, Alert, AlertLevel
from app.config import settings


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Distance between two points on Earth (Haversine formula)"""
    R = 6371.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def bearing_degrees(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dlambda = math.radians(lon2 - lon1)
    x = math.sin(dlambda) * math.cos(phi2)
    y = math.cos(phi1) * math.sin(phi2) - math.sin(phi1) * math.cos(phi2) * math.cos(dlambda)
    return (math.degrees(math.atan2(x, y)) + 360) % 360


def determine_alert_level(distance_km: float, speed_kmh: float) -> AlertLevel:
    if distance_km <= 0.5:
        return AlertLevel.CRITICAL
    elif distance_km <= 1.5:
        return AlertLevel.HIGH
    elif distance_km <= 3.0:
        return AlertLevel.MEDIUM
    else:
        return AlertLevel.LOW


def build_alert_messages(herd: Herd, distance_km: float, eta_minutes: Optional[float], geozone: GeoZone) -> Tuple[str, str]:
    names_ru = {"saiga": "сайгаков", "horse": "лошадей", "camel": "верблюдов", "other": "животных"}
    names_kk = {"saiga": "сайғақтар", "horse": "жылқылар", "camel": "түйелер", "other": "жануарлар"}
    animal_ru = names_ru.get(herd.animal_type.value, "животных")
    animal_kk = names_kk.get(herd.animal_type.value, "жануарлар")
    eta_ru = f"через ~{int(eta_minutes)} мин. " if eta_minutes else ""
    eta_kk = f"~{int(eta_minutes)} мин. ішінде " if eta_minutes else ""
    msg_ru = f"⚠️ Стадо {animal_ru} ({herd.estimated_count} особей) приближается к «{geozone.name}» {eta_ru}(расстояние: {distance_km:.1f} км). Снизьте скорость!"
    msg_kk = f"⚠️ «{geozone.name}» жолына {animal_kk} ({herd.estimated_count} бас) {eta_kk}жақындауда ({distance_km:.1f} км). Жылдамдықты азайтыңыз!"
    return msg_ru, msg_kk


def check_herd_in_geozones(db: Session, latitude: float, longitude: float) -> List[dict]:
    """
    Pure Python bounding box check — no PostGIS needed.
    Returns zones with distance to road centerline.
    """
    zones = db.query(GeoZone).filter(GeoZone.is_active == True).all()
    results = []
    for zone in zones:
        # Check if point is within bounding box (extended by buffer)
        in_box = (
            zone.lat_min - 0.1 <= latitude <= zone.lat_max + 0.1 and
            zone.lon_min - 0.1 <= longitude <= zone.lon_max + 0.1
        )
        if not in_box:
            continue
        # Distance to road centerline
        dist_km = haversine_km(latitude, longitude, zone.road_lat, zone.road_lon)
        if dist_km <= zone.buffer_km * 1.5:
            results.append({
                "id": zone.id,
                "name": zone.name,
                "road_type": zone.road_type,
                "buffer_km": zone.buffer_km,
                "distance_to_road_km": dist_km,
                "road_lat": zone.road_lat,
                "road_lon": zone.road_lon,
            })
    return results


def get_movement_vector(db: Session, herd_id: int, current_lat: float, current_lon: float):
    prev = (
        db.query(HerdLocation)
        .filter(HerdLocation.herd_id == herd_id)
        .order_by(HerdLocation.timestamp.desc())
        .first()
    )
    if prev is None:
        return None, 0.0, None
    bearing = bearing_degrees(prev.latitude, prev.longitude, current_lat, current_lon)
    dist = haversine_km(prev.latitude, prev.longitude, current_lat, current_lon)
    time_hours = (datetime.utcnow() - prev.timestamp).total_seconds() / 3600.0
    speed = (dist / time_hours) if time_hours > 0.001 else 0.0
    return bearing, min(speed, 100.0), prev


def process_location_update(
    db: Session, herd: Herd, latitude: float, longitude: float, speed_kmh: float = 0.0
) -> Optional[Alert]:
    bearing, computed_speed, prev_loc = get_movement_vector(db, herd.id, latitude, longitude)
    effective_speed = speed_kmh if speed_kmh > 0 else computed_speed
    zones = check_herd_in_geozones(db, latitude, longitude)
    if not zones:
        return None

    for zone_data in zones:
        dist = zone_data["distance_to_road_km"]
        eta_minutes = (dist / effective_speed * 60) if effective_speed > 0.1 else None

        existing = db.query(Alert).filter(
            Alert.herd_id == herd.id,
            Alert.geozone_id == zone_data["id"],
            Alert.is_active == True,
        ).first()
        if existing:
            existing.distance_to_road_km = dist
            existing.estimated_arrival_minutes = eta_minutes
            db.commit()
            return existing

        geozone = db.query(GeoZone).filter(GeoZone.id == zone_data["id"]).first()
        level = determine_alert_level(dist, effective_speed)
        msg_ru, msg_kk = build_alert_messages(herd, dist, eta_minutes, geozone)

        alert = Alert(
            herd_id=herd.id, geozone_id=zone_data["id"],
            level=level, message_ru=msg_ru, message_kk=msg_kk,
            distance_to_road_km=dist, estimated_arrival_minutes=eta_minutes,
            is_active=True,
        )
        db.add(alert)
        db.commit()
        db.refresh(alert)
        return alert

    return None
