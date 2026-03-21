from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from app.models import AlertLevel, AnimalType


class HerdBase(BaseModel):
    name: str
    animal_type: AnimalType = AnimalType.SAIGA
    estimated_count: int = 1
    owner_name: Optional[str] = None


class HerdCreate(HerdBase):
    pass


class LocationPoint(BaseModel):
    latitude: float
    longitude: float
    speed_kmh: float = 0.0
    heading_degrees: Optional[float] = None
    source: str = "api"


class HerdLocationOut(BaseModel):
    id: int
    herd_id: int
    latitude: float
    longitude: float
    speed_kmh: float
    heading_degrees: Optional[float]
    timestamp: datetime
    source: str

    class Config:
        from_attributes = True


class HerdOut(HerdBase):
    id: int
    is_active: bool
    created_at: datetime
    current_location: Optional[HerdLocationOut] = None

    class Config:
        from_attributes = True


class GeoZoneOut(BaseModel):
    id: int
    name: str
    road_type: str
    buffer_km: float
    is_active: bool

    class Config:
        from_attributes = True


class GeoZoneGeoJSON(BaseModel):
    type: str = "Feature"
    properties: dict
    geometry: dict


class AlertOut(BaseModel):
    id: int
    herd_id: int
    geozone_id: int
    level: AlertLevel
    message_ru: str
    message_kk: str
    distance_to_road_km: Optional[float]
    estimated_arrival_minutes: Optional[float]
    is_active: bool
    notified_count: int
    created_at: datetime
    resolved_at: Optional[datetime]
    herd_name: Optional[str] = None
    herd_animal_type: Optional[str] = None
    geozone_name: Optional[str] = None

    class Config:
        from_attributes = True


class DeviceRegister(BaseModel):
    device_id: str
    fcm_token: Optional[str] = None
    phone_number: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None


class DeviceLocationUpdate(BaseModel):
    device_id: str
    latitude: float
    longitude: float


class SimulatorStatus(BaseModel):
    running: bool
    tick_count: int
    herds: List[dict]


class LiveMapData(BaseModel):
    herds: List[HerdOut]
    active_alerts: List[AlertOut]
    geozones: List[GeoZoneOut]
    timestamp: datetime
