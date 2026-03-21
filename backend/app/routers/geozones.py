from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import List
import json

from app.database import get_db
from app.models import GeoZone
from app.schemas import GeoZoneOut, GeoZoneGeoJSON

router = APIRouter(prefix="/geozones", tags=["geozones"])


@router.get("/", response_model=List[GeoZoneOut])
def list_geozones(db: Session = Depends(get_db)):
    zones = db.query(GeoZone).filter(GeoZone.is_active == True).all()
    return [GeoZoneOut.model_validate(z) for z in zones]


@router.get("/geojson")
def get_geozones_geojson(db: Session = Depends(get_db)):
    query = text("""
        SELECT
            id, name, road_type, buffer_km,
            ST_AsGeoJSON(polygon)::json AS polygon_geojson,
            ST_AsGeoJSON(road_line)::json AS road_geojson
        FROM geozones
        WHERE is_active = true
    """)
    rows = db.execute(query).fetchall()

    features = []
    for row in rows:
        if row.polygon_geojson:
            features.append({
                "type": "Feature",
                "properties": {
                    "id": row.id,
                    "name": row.name,
                    "road_type": row.road_type,
                    "buffer_km": row.buffer_km,
                    "layer": "buffer_zone",
                },
                "geometry": row.polygon_geojson,
            })

    return {"type": "FeatureCollection", "features": features}
