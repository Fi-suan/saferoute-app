from pydantic import BaseModel, Field, field_validator
from typing import Optional, List
from datetime import datetime
from app.models import AlertLevel, AnimalType


class HerdBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    animal_type: AnimalType = AnimalType.SAIGA
    estimated_count: int = Field(1, ge=1, le=100_000)
    owner_name: Optional[str] = Field(None, max_length=200)


class HerdCreate(HerdBase):
    pass


class LocationPoint(BaseModel):
    latitude: float
    longitude: float
    speed_kmh: float = Field(0.0, ge=0, le=500)
    heading_degrees: Optional[float] = Field(None, ge=0, le=360)
    source: str = Field("api", max_length=50)

    @field_validator("latitude")
    @classmethod
    def validate_lat(cls, v: float) -> float:
        if not -90 <= v <= 90:
            raise ValueError("latitude must be between -90 and 90")
        return v

    @field_validator("longitude")
    @classmethod
    def validate_lon(cls, v: float) -> float:
        if not -180 <= v <= 180:
            raise ValueError("longitude must be between -180 and 180")
        return v


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
    lat_min: float
    lat_max: float
    lon_min: float
    lon_max: float
    road_lat: float
    road_lon: float
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
    device_id: str = Field(..., min_length=1, max_length=200)
    role: str = Field("driver", pattern=r"^(driver|owner)$")
    fcm_token: Optional[str] = Field(None, max_length=500)
    phone_number: Optional[str] = Field(None, max_length=20)
    latitude: Optional[float] = None
    longitude: Optional[float] = None

    @field_validator("latitude")
    @classmethod
    def validate_lat(cls, v: Optional[float]) -> Optional[float]:
        if v is not None and not -90 <= v <= 90:
            raise ValueError("latitude must be between -90 and 90")
        return v

    @field_validator("longitude")
    @classmethod
    def validate_lon(cls, v: Optional[float]) -> Optional[float]:
        if v is not None and not -180 <= v <= 180:
            raise ValueError("longitude must be between -180 and 180")
        return v


class DeviceLocationUpdate(BaseModel):
    device_id: str = Field(..., min_length=1, max_length=200)
    latitude: float
    longitude: float

    @field_validator("latitude")
    @classmethod
    def validate_lat(cls, v: float) -> float:
        if not -90 <= v <= 90:
            raise ValueError("latitude must be between -90 and 90")
        return v

    @field_validator("longitude")
    @classmethod
    def validate_lon(cls, v: float) -> float:
        if not -180 <= v <= 180:
            raise ValueError("longitude must be between -180 and 180")
        return v


class SimulatorStatus(BaseModel):
    running: bool
    tick_count: int
    herds: List[dict]


class LiveMapData(BaseModel):
    herds: List[HerdOut]
    active_alerts: List[AlertOut]
    geozones: List[GeoZoneOut]
    timestamp: datetime
