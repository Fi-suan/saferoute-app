"""
Geofencing Engine — core algorithm of SafeRoute.
"""
import math
from typing import Optional, Tuple, List
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.models import Herd, HerdLocation, GeoZone, Alert, AlertLevel
from app.config import settings


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371.0
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def bearing_degrees(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    dlambda = math.radians(lon2 - lon1)
    x = math.sin(dlambda) * math.cos(phi2)
    y = math.cos(phi1) * math.sin(phi2) - math.sin(phi1) * math.cos(phi2) * math.cos(dlambda)
    return (math.degrees(math.atan2(x, y)) + 360) % 360


def angle_diff(a: float, b: float) -> float:
    diff = (a - b + 180) % 360 - 180
    return diff


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
    animal_name_ru = {"saiga": "сайгаков", "horse": "лошадей", "camel": "верблюдов", "other": "животных"}.get(herd.animal_type.value, "животных")
    animal_name_kk = {"saiga": "сайғақтар", "horse": "жылқылар", "camel": "түйелер", "other": "жануарлар"}.get(herd.animal_type.value, "жануарлар")
    eta_ru = f"через ~{int(eta_minutes)} мин. " if eta_minutes else ""
    eta_kk = f"шамамен ~{int(eta_minutes)} мин. ішінде " if eta_minutes else ""
    msg_ru = f"⚠️ Внимание! Стадо {animal_name_ru} ({herd.estimated_count} особей) приближается к дороге «{geozone.name}» {eta_ru}(расстояние: {distance_km:.1f} км). Снизьте скорость!"
    msg_kk = f"⚠️ Назар аударыңыз! «{geozone.name}» жолына {animal_name_kk} ({herd.estimated_count} бас) {eta_kk}жақындауда (қашықтық: {distance_km:.1f} км). Жылдамдықты азайтыңыз!"
    return msg_ru, msg_kk


def check_herd_in_geozones(db: Session, herd_id: int, latitude: float, longitude: float) -> List[dict]:
    query = text("""
        SELECT
            gz.id, gz.name, gz.road_type, gz.buffer_km,
            ST_Distance(
                ST_Transform(ST_SetSRID(ST_MakePoint(:lon, :lat), 4326), 3857),
                ST_Transform(gz.road_line, 3857)
            ) / 1000.0 AS distance_to_road_km,
            ST_Within(ST_SetSRID(ST_MakePoint(:lon, :lat), 4326), gz.polygon) AS is_inside
        FROM geozones gz
        WHERE gz.is_active = true
        AND ST_DWithin(
            ST_SetSRID(ST_MakePoint(:lon, :lat), 4326)::geography,
            gz.polygon::geography,
            :buffer_m
        )
    """)
    results = db.execute(query, {"lat": latitude, "lon": longitude, "buffer_m": settings.BUFFER_ZONE_KM * 1000 * 1.5}).fetchall()
    return [dict(r._mapping) for r in results]


def get_movement_vector(db: Session, herd_id: int, current_lat: float, current_lon: float):
    prev = db.query(HerdLocation).filter(HerdLocation.herd_id == herd_id).order_by(HerdLocation.timestamp.desc()).first()
    if prev is None:
        return None, 0.0, None
    bearing = bearing_degrees(prev.latitude, prev.longitude, current_lat, current_lon)
    dist = haversine_km(prev.latitude, prev.longitude, current_lat, current_lon)
    time_diff_hours = (datetime.utcnow() - prev.timestamp).total_seconds() / 3600.0
    speed = (dist / time_diff_hours) if time_diff_hours > 0 else 0.0
    return bearing, min(speed, 100.0), prev


def process_location_update(db: Session, herd: Herd, latitude: float, longitude: float, speed_kmh: float = 0.0) -> Optional[Alert]:
    bearing, computed_speed, prev_loc = get_movement_vector(db, herd.id, latitude, longitude)
    effective_speed = speed_kmh if speed_kmh > 0 else computed_speed
    zones = check_herd_in_geozones(db, herd.id, latitude, longitude)
    if not zones:
        return None

    for zone_data in zones:
        distance_to_road = zone_data["distance_to_road_km"]
        if distance_to_road is None:
            continue
        eta_minutes = None
        if effective_speed and effective_speed > 0.1:
            eta_minutes = (distance_to_road / effective_speed) * 60

        existing = db.query(Alert).filter(Alert.herd_id == herd.id, Alert.geozone_id == zone_data["id"], Alert.is_active == True).first()
        if existing:
            existing.distance_to_road_km = distance_to_road
            existing.estimated_arrival_minutes = eta_minutes
            db.commit()
            return existing

        geozone = db.query(GeoZone).filter(GeoZone.id == zone_data["id"]).first()
        level = determine_alert_level(distance_to_road, effective_speed)
        msg_ru, msg_kk = build_alert_messages(herd, distance_to_road, eta_minutes, geozone)

        alert = Alert(
            herd_id=herd.id,
            geozone_id=zone_data["id"],
            level=level,
            message_ru=msg_ru,
            message_kk=msg_kk,
            distance_to_road_km=distance_to_road,
            estimated_arrival_minutes=eta_minutes,
            is_active=True,
        )
        db.add(alert)
        db.commit()
        db.refresh(alert)
        return alert

    return None
