"""
Geofencing Engine — pure Python, no PostGIS required.
Uses Haversine formula for distance calculations.
"""
import math
from datetime import UTC, datetime

from sqlalchemy.orm import Session

from app.models import Alert, AlertLevel, GeoZone, Herd, HerdLocation, as_utc

EARTH_RADIUS_KM = 6371.0


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Distance between two points on Earth (Haversine formula)"""
    if not (-90 <= lat1 <= 90 and -90 <= lat2 <= 90 and -180 <= lon1 <= 180 and -180 <= lon2 <= 180):
        return float('inf')
    R = EARTH_RADIUS_KM
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def _point_to_segment_km(
    plat: float, plon: float,
    alat: float, alon: float,
    blat: float, blon: float,
) -> float:
    """
    Расстояние от точки до отрезка дороги.

    Отрезок проецируется в локальную плоскость с началом в самой точке
    (равнопромежуточная проекция с поправкой на широту). На длинах в десятки
    километров погрешность заметно меньше процента, а сферическая формула для
    отрезка дала бы громоздкий код без выигрыша в точности на этих масштабах.
    """
    lat0 = math.radians(plat)
    coslat = math.cos(lat0)

    def to_xy(lat: float, lon: float) -> tuple[float, float]:
        return (
            math.radians(lon - plon) * coslat * EARTH_RADIUS_KM,
            math.radians(lat - plat) * EARTH_RADIUS_KM,
        )

    ax, ay = to_xy(alat, alon)
    bx, by = to_xy(blat, blon)

    dx, dy = bx - ax, by - ay
    seg_len_sq = dx * dx + dy * dy
    if seg_len_sq == 0.0:  # вырожденный отрезок — просто точка
        return math.hypot(ax, ay)

    # Проекция точки (она в начале координат) на отрезок, зажатая в [0, 1]
    t = -(ax * dx + ay * dy) / seg_len_sq
    t = max(0.0, min(1.0, t))
    return math.hypot(ax + t * dx, ay + t * dy)


def distance_to_polyline_km(lat: float, lon: float, polyline: list) -> float:
    """
    Кратчайшее расстояние от точки до осевой линии дороги.

    polyline — список [lat, lon]. Для линии из одной точки вырождается в
    обычный haversine: так работают коридоры, для которых реальной геометрии
    ещё нет (см. app/data/roads.json).
    """
    if not polyline:
        return float("inf")

    # Начинаем с точного сферического расстояния до вершин. Вершины лежат на
    # линии, поэтому это гарантированная верхняя граница: без неё плоская
    # проекция на удалении в десятки километров даёт результат чуть больше
    # расстояния до ближайшей вершины (~0.1%), что математически невозможно.
    best = min(haversine_km(lat, lon, p[0], p[1]) for p in polyline)

    # Отрезки уточняют результат там, где перпендикуляр падает между вершинами.
    # Вблизи дороги — а только это и важно для алертов — проекция точна.
    for (alat, alon), (blat, blon) in zip(polyline, polyline[1:], strict=False):
        d = _point_to_segment_km(lat, lon, alat, alon, blat, blon)
        if d < best:
            best = d
    return best


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


def build_alert_messages(herd: Herd, distance_km: float, eta_minutes: float | None, geozone: GeoZone) -> tuple[str, str]:
    names_ru = {"saiga": "сайгаков", "horse": "лошадей", "camel": "верблюдов", "other": "животных"}
    names_kk = {"saiga": "сайғақтар", "horse": "жылқылар", "camel": "түйелер", "other": "жануарлар"}
    animal_ru = names_ru.get(herd.animal_type.value, "животных")
    animal_kk = names_kk.get(herd.animal_type.value, "жануарлар")
    eta_ru = f"через ~{int(eta_minutes)} мин. " if eta_minutes else ""
    eta_kk = f"~{int(eta_minutes)} мин. ішінде " if eta_minutes else ""
    msg_ru = f"⚠️ Стадо {animal_ru} ({herd.estimated_count} особей) приближается к «{geozone.name}» {eta_ru}(расстояние: {distance_km:.1f} км). Снизьте скорость!"
    msg_kk = f"⚠️ «{geozone.name}» жолына {animal_kk} ({herd.estimated_count} бас) {eta_kk}жақындауда ({distance_km:.1f} км). Жылдамдықты азайтыңыз!"
    return msg_ru, msg_kk


def check_herd_in_geozones(db: Session, latitude: float, longitude: float) -> list[dict]:
    """
    Pure Python bounding box check — no PostGIS needed.
    Returns zones with distance to road centerline.
    """
    zones = db.query(GeoZone).filter(GeoZone.is_active.is_(True)).all()
    results = []
    for zone in zones:
        # Check if point is within bounding box (extended by buffer)
        in_box = (
            zone.lat_min - 0.1 <= latitude <= zone.lat_max + 0.1 and
            zone.lon_min - 0.1 <= longitude <= zone.lon_max + 0.1
        )
        if not in_box:
            continue
        # Расстояние до осевой линии. road_geometry — ломаная; если её нет,
        # откатываемся на историческую единственную точку road_lat/road_lon.
        geometry = zone.geometry_points()
        dist_km = (
            distance_to_polyline_km(latitude, longitude, geometry)
            if geometry
            else haversine_km(latitude, longitude, zone.road_lat, zone.road_lon)
        )
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
    # as_utc обязателен: на SQLite время из БД приходит naive, и вычитание
    # из aware datetime.now() падало бы с TypeError на втором обновлении позиции.
    time_hours = (datetime.now(UTC) - as_utc(prev.timestamp)).total_seconds() / 3600.0
    speed = (dist / time_hours) if time_hours > 0.001 else 0.0
    return bearing, min(speed, 100.0), prev


def process_location_update(
    db: Session, herd: Herd, latitude: float, longitude: float, speed_kmh: float = 0.0
) -> Alert | None:
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
            Alert.is_active.is_(True),
        ).first()
        if existing:
            existing.distance_to_road_km = dist
            existing.estimated_arrival_minutes = eta_minutes
            # No commit here — caller is responsible for committing the transaction
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
        db.flush()
        db.refresh(alert)
        return alert

    return None
