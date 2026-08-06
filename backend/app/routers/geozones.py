
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import GeoZone
from app.schemas import GeoZoneOut

router = APIRouter(prefix="/geozones", tags=["geozones"])


@router.get("/", response_model=list[GeoZoneOut])
def list_geozones(db: Session = Depends(get_db)):
    zones = db.query(GeoZone).filter(GeoZone.is_active.is_(True)).all()
    return [GeoZoneOut.model_validate(z) for z in zones]


@router.get("/geojson")
def get_geozones_geojson(db: Session = Depends(get_db)):
    zones = db.query(GeoZone).filter(GeoZone.is_active.is_(True)).all()

    features = []
    for zone in zones:
        polygon_geojson = {
            "type": "Polygon",
            "coordinates": [[
                [zone.lon_min, zone.lat_min],
                [zone.lon_max, zone.lat_min],
                [zone.lon_max, zone.lat_max],
                [zone.lon_min, zone.lat_max],
                [zone.lon_min, zone.lat_min]
            ]]
        }

        features.append({
            "type": "Feature",
            "properties": {
                "id": zone.id,
                "slug": zone.slug,
                "name": zone.name,
                "road_type": zone.road_type,
                "buffer_km": zone.buffer_km,
                "layer": "buffer_zone",
            },
            "geometry": polygon_geojson,
        })

        # Сама осевая линия. Сейчас фронт держит геометрию трасс у себя
        # (useRoutePolyline.STATIC_WAYPOINTS) — отдельным от бэкенда списком.
        # Отдаём её здесь, чтобы источник правды остался один.
        points = zone.geometry_points()
        if len(points) > 1:
            features.append({
                "type": "Feature",
                "properties": {
                    "id": zone.id,
                    "slug": zone.slug,
                    "name": zone.name,
                    "road_type": zone.road_type,
                    "layer": "road_centerline",
                },
                "geometry": {
                    "type": "LineString",
                    # GeoJSON — [lon, lat], в модели хранится [lat, lon].
                    "coordinates": [[p[1], p[0]] for p in points],
                },
            })

    return {"type": "FeatureCollection", "features": features}
