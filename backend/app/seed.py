"""
Database seeder — creates initial Kazakhstan road geozones.
No PostGIS required — uses bounding boxes + centerpoint.
"""
import logging
from sqlalchemy.orm import Session
from app.database import engine, Base, SessionLocal
from app.models import GeoZone

logger = logging.getLogger(__name__)


# Kazakhstan highways: (name, road_type, buffer_km, lat_min, lat_max, lon_min, lon_max, road_lat, road_lon)
ROAD_ZONES = [
    {
        "name": "Трасса А-17 (Астана—Павлодар) зап. участок",
        "road_type": "highway",
        "buffer_km": 5.0,
        "lat_min": 51.05, "lat_max": 51.35, "lon_min": 71.3, "lon_max": 72.5,
        "road_lat": 51.18, "road_lon": 71.9,  # centerline midpoint
    },
    {
        "name": "Трасса А-17 (Астана—Павлодар) вост. участок",
        "road_type": "highway",
        "buffer_km": 5.0,
        "lat_min": 51.35, "lat_max": 52.0, "lon_min": 72.5, "lon_max": 75.0,
        "road_lat": 51.7, "road_lon": 73.75,
    },
    {
        "name": "Трасса А-17 (Павлодар—Семей)",
        "road_type": "highway",
        "buffer_km": 5.0,
        "lat_min": 51.8, "lat_max": 52.5, "lon_min": 76.8, "lon_max": 80.5,
        "road_lat": 52.1, "road_lon": 78.6,
    },
    {
        "name": "Трасса А-1 (Алматы—Астана) степной участок",
        "road_type": "highway",
        "buffer_km": 5.0,
        "lat_min": 49.5, "lat_max": 51.3, "lon_min": 68.0, "lon_max": 73.0,
        "road_lat": 50.4, "road_lon": 70.5,
    },
    {
        "name": "Трасса А-21 (Павлодар—Омск)",
        "road_type": "highway",
        "buffer_km": 5.0,
        "lat_min": 51.9, "lat_max": 53.5, "lon_min": 76.5, "lon_max": 81.0,
        "road_lat": 52.7, "road_lon": 78.75,
    },
]


def seed_geozones(db: Session):
    if db.query(GeoZone).count() > 0:
        logger.info("Geozones already seeded, skipping.")
        return

    for r in ROAD_ZONES:
        if r["lat_min"] >= r["lat_max"] or r["lon_min"] >= r["lon_max"]:
            logger.error(f"Invalid bounding box for zone '{r['name']}': lat_min >= lat_max or lon_min >= lon_max")
            continue
        zone = GeoZone(
            name=r["name"],
            road_type=r["road_type"],
            buffer_km=r["buffer_km"],
            lat_min=r["lat_min"],
            lat_max=r["lat_max"],
            lon_min=r["lon_min"],
            lon_max=r["lon_max"],
            road_lat=r["road_lat"],
            road_lon=r["road_lon"],
            is_active=True,
        )
        db.add(zone)

    try:
        db.commit()
        count = db.query(GeoZone).count()
        logger.info(f"Seeded {count} geozones successfully")
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to seed geozones: {e}")


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
