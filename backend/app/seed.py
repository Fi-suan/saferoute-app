from sqlalchemy.orm import Session
from sqlalchemy import text
from app.database import engine, Base, SessionLocal
from app.models import GeoZone


def seed_geozones(db: Session):
    """Create buffer zones along major Kazakhstan highways near saiga migration routes."""
    if db.query(GeoZone).count() > 0:
        print("Geozones already seeded, skipping.")
        return

    roads = [
        {
            "name": "Трасса А-17 (Астана-Павлодар) км 245-310",
            "road_type": "highway",
            "buffer_km": 5.0,
            "wkt_line": "LINESTRING(71.3 51.18, 71.5 51.18, 71.7 51.18, 71.9 51.18, 72.1 51.18, 72.3 51.18, 72.5 51.18)",
        },
        {
            "name": "Трасса А-17 (Павлодар-Семей) км 30-80",
            "road_type": "highway",
            "buffer_km": 5.0,
            "wkt_line": "LINESTRING(77.0 52.3, 77.3 52.2, 77.6 52.1, 77.9 52.0, 78.2 51.9)",
        },
        {
            "name": "Трасса А-1 (Алматы-Астана) степной участок",
            "road_type": "highway",
            "buffer_km": 5.0,
            "wkt_line": "LINESTRING(71.4 51.22, 71.6 51.23, 71.8 51.24, 72.0 51.25, 72.2 51.26)",
        },
    ]

    for r in roads:
        result = db.execute(
            text("""
                SELECT
                    ST_Buffer(
                        ST_GeomFromText(:wkt, 4326)::geography,
                        :buffer_meters
                    )::geometry AS polygon,
                    ST_GeomFromText(:wkt, 4326) AS road_line
            """),
            {"wkt": r["wkt_line"], "buffer_meters": r["buffer_km"] * 1000},
        ).fetchone()

        zone = GeoZone(
            name=r["name"],
            road_type=r["road_type"],
            buffer_km=r["buffer_km"],
            polygon=result.polygon,
            road_line=result.road_line,
            is_active=True,
        )
        db.add(zone)

    db.commit()
    print(f"Seeded {len(roads)} geozones.")


def init_db():
    Base.metadata.create_all(bind=engine)
    print("DB tables created.")
    db = SessionLocal()
    try:
        seed_geozones(db)
    finally:
        db.close()


if __name__ == "__main__":
    init_db()
