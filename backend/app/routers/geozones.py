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
    zones = db.query(GeoZone).filter(GeoZone.is_active == True).all()

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
                "name": zone.name,
                "road_type": zone.road_type,
                "buffer_km": zone.buffer_km,
                "layer": "buffer_zone",
            },
            "geometry": polygon_geojson,
        })

    return {"type": "FeatureCollection", "features": features}
