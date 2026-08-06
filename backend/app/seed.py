"""
Database seeder — геозоны трасс Казахстана.

Геометрия лежит в app/data/roads.json. Bounding box больше не задаётся руками:
он вычисляется из осевой линии плюс запас на buffer_km, поэтому не может
разойтись с самой дорогой.

Сид идемпотентный и обновляющий: зоны сопоставляются по slug, поэтому
изменения геометрии доезжают до уже существующей базы, а не игнорируются,
как раньше (сид просто выходил, если в таблице что-то было).
"""
import json
import logging
import math
from pathlib import Path

from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.database import Base, SessionLocal, engine
from app.models import GeoZone

logger = logging.getLogger(__name__)

ROADS_FILE = Path(__file__).parent / "data" / "roads.json"

# Запас к bounding box сверх buffer_km, чтобы стадо, идущее к дороге,
# попадало в предварительную проверку раньше, чем окажется вплотную.
BBOX_MARGIN_KM = 20.0


def load_roads() -> list[dict]:
    with ROADS_FILE.open(encoding="utf-8") as f:
        return json.load(f)["roads"]


def bbox_from_geometry(geometry: list, margin_km: float) -> tuple[float, float, float, float]:
    """
    Прямоугольник вокруг осевой линии с запасом в километрах.

    Градус широты всюду ~111 км; для долготы шаг делится на cos(широты),
    иначе на широтах Казахстана запас по долготе вышел бы вдвое меньше нужного.
    """
    lats = [p[0] for p in geometry]
    lons = [p[1] for p in geometry]
    d_lat = margin_km / 111.0
    mid_lat = (min(lats) + max(lats)) / 2
    d_lon = margin_km / (111.0 * max(math.cos(math.radians(mid_lat)), 0.01))
    return (
        min(lats) - d_lat,
        max(lats) + d_lat,
        min(lons) - d_lon,
        max(lons) + d_lon,
    )


def midpoint(geometry: list) -> tuple[float, float]:
    """Средняя точка линии — для обратной совместимости с road_lat/road_lon."""
    return tuple(geometry[len(geometry) // 2])


def seed_geozones(db: Session) -> None:
    roads = load_roads()
    seen_slugs = []

    for road in roads:
        geometry = road["geometry"]
        if not geometry:
            logger.error("Зона '%s' без геометрии — пропущена", road["slug"])
            continue

        lat_min, lat_max, lon_min, lon_max = bbox_from_geometry(
            geometry, road["buffer_km"] + BBOX_MARGIN_KM
        )
        road_lat, road_lon = midpoint(geometry)
        seen_slugs.append(road["slug"])

        zone = db.query(GeoZone).filter(GeoZone.slug == road["slug"]).first()
        if zone is None:
            zone = GeoZone(slug=road["slug"])
            db.add(zone)

        zone.name = road["name"]
        zone.road_type = road["road_type"]
        zone.buffer_km = road["buffer_km"]
        zone.road_geometry = json.dumps(geometry)
        zone.road_lat = road_lat
        zone.road_lon = road_lon
        zone.lat_min, zone.lat_max = lat_min, lat_max
        zone.lon_min, zone.lon_max = lon_min, lon_max
        zone.is_active = True

    # Зоны из старых версий данных: не удаляем (на них могут ссылаться алерты),
    # а гасим, чтобы не участвовали в проверках. Условие на NULL обязательно —
    # у зон, засеянных до появления slug, он пустой, а `NULL NOT IN (...)`
    # в SQL не истинно, и такие строки остались бы активными.
    stale = (
        db.query(GeoZone)
        .filter(
            GeoZone.is_active.is_(True),
            or_(GeoZone.slug.is_(None), GeoZone.slug.notin_(seen_slugs)),
        )
        .update({"is_active": False}, synchronize_session=False)
    )

    try:
        db.commit()
        logger.info("Геозоны засеяны: %d активных, %d погашено", len(seen_slugs), stale)
    except Exception as e:
        db.rollback()
        logger.error("Не удалось засеять геозоны: %s", e)


def init_db():
    Base.metadata.create_all(bind=engine)
    print("[seed] DB tables created.")
    db = SessionLocal()
    try:
        seed_geozones(db)
    finally:
        db.close()


if __name__ == "__main__":
    init_db()
