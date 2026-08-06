from datetime import datetime

from pydantic import BaseModel, Field, field_validator

from app.models import AlertLevel, AnimalType


class HerdBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    animal_type: AnimalType = AnimalType.SAIGA
    estimated_count: int = Field(1, ge=1, le=100_000)
    owner_name: str | None = Field(None, max_length=200)


class HerdCreate(HerdBase):
    pass


class LocationPoint(BaseModel):
    latitude: float
    longitude: float
    speed_kmh: float = Field(0.0, ge=0, le=500)
    heading_degrees: float | None = Field(None, ge=0, le=360)
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
    heading_degrees: float | None
    timestamp: datetime
    source: str

    class Config:
        from_attributes = True


class HerdOut(HerdBase):
    id: int
    is_active: bool
    created_at: datetime
    current_location: HerdLocationOut | None = None

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
    distance_to_road_km: float | None
    estimated_arrival_minutes: float | None
    is_active: bool
    notified_count: int
    created_at: datetime
    resolved_at: datetime | None
    herd_name: str | None = None
    herd_animal_type: str | None = None
    geozone_name: str | None = None

    class Config:
        from_attributes = True


class DeviceRegister(BaseModel):
    device_id: str = Field(..., min_length=1, max_length=200)
    role: str = Field("driver", pattern=r"^(driver|owner)$")
    fcm_token: str | None = Field(None, max_length=500)
    phone_number: str | None = Field(None, max_length=20)
    latitude: float | None = None
    longitude: float | None = None

    @field_validator("latitude")
    @classmethod
    def validate_lat(cls, v: float | None) -> float | None:
        if v is not None and not -90 <= v <= 90:
            raise ValueError("latitude must be between -90 and 90")
        return v

    @field_validator("longitude")
    @classmethod
    def validate_lon(cls, v: float | None) -> float | None:
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
    herds: list[dict]


class LiveMapData(BaseModel):
    herds: list[HerdOut]
    active_alerts: list[AlertOut]
    geozones: list[GeoZoneOut]
    timestamp: datetime
