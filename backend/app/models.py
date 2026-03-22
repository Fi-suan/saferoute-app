from sqlalchemy import Column, Integer, String, Float, DateTime, Boolean, ForeignKey, Text, Enum
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base
import enum


class AlertLevel(str, enum.Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class AnimalType(str, enum.Enum):
    SAIGA = "saiga"
    HORSE = "horse"
    CAMEL = "camel"
    OTHER = "other"


class Role(str, enum.Enum):
    DRIVER = "driver"
    OWNER = "owner"


class Herd(Base):
    """Стадо / табун животных"""
    __tablename__ = "herds"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    animal_type = Column(Enum(AnimalType), default=AnimalType.SAIGA)
    estimated_count = Column(Integer, default=1)
    owner_name = Column(String(200), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    locations = relationship(
        "HerdLocation", back_populates="herd",
        order_by="desc(HerdLocation.timestamp)",
        lazy="dynamic"
    )
    alerts = relationship("Alert", back_populates="herd")


class HerdLocation(Base):
    """История GPS-позиций стада"""
    __tablename__ = "herd_locations"

    id = Column(Integer, primary_key=True, index=True)
    herd_id = Column(Integer, ForeignKey("herds.id"), nullable=False)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    speed_kmh = Column(Float, default=0.0)
    heading_degrees = Column(Float, nullable=True)
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)
    source = Column(String(50), default="simulator")

    herd = relationship("Herd", back_populates="locations")


class GeoZone(Base):
    """Буферная зона вдоль дороги — bounding box"""
    __tablename__ = "geozones"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    road_type = Column(String(50), default="highway")
    buffer_km = Column(Float, default=5.0)
    # Bounding box (replaces PostGIS polygon)
    lat_min = Column(Float, nullable=False, default=0.0)
    lat_max = Column(Float, nullable=False, default=0.0)
    lon_min = Column(Float, nullable=False, default=0.0)
    lon_max = Column(Float, nullable=False, default=0.0)
    # Road centerline midpoint (replaces PostGIS linestring)
    road_lat = Column(Float, nullable=False, default=0.0)
    road_lon = Column(Float, nullable=False, default=0.0)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    alerts = relationship("Alert", back_populates="geozone")


class Alert(Base):
    """Предупреждение об опасности"""
    __tablename__ = "alerts"

    id = Column(Integer, primary_key=True, index=True)
    herd_id = Column(Integer, ForeignKey("herds.id"), nullable=False)
    geozone_id = Column(Integer, ForeignKey("geozones.id"), nullable=False)
    level = Column(Enum(AlertLevel), default=AlertLevel.MEDIUM)
    message_ru = Column(Text, nullable=False)
    message_kk = Column(Text, nullable=False)
    distance_to_road_km = Column(Float)
    estimated_arrival_minutes = Column(Float, nullable=True)
    is_active = Column(Boolean, default=True)
    notified_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    resolved_at = Column(DateTime, nullable=True)

    herd = relationship("Herd", back_populates="alerts")
    geozone = relationship("GeoZone", back_populates="alerts")


class Device(Base):
    """Пользовательское устройство (Водитель или Пастух)"""
    __tablename__ = "devices"

    id = Column(Integer, primary_key=True, index=True)
    device_id = Column(String(200), unique=True, nullable=False)
    role = Column(Enum(Role), default=Role.DRIVER)
    fcm_token = Column(String(500), nullable=True)
    phone_number = Column(String(20), nullable=True)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    last_seen = Column(DateTime, default=datetime.utcnow)
    is_active = Column(Boolean, default=True)


class IncidentType(str, enum.Enum):
    ANIMAL = "animal"
    CRASH = "crash"
    HAZARD = "hazard"
    OTHER = "other"


class IncidentReport(Base):
    """Метка инцидента"""
    __tablename__ = "incident_reports"

    id = Column(Integer, primary_key=True, index=True)
    incident_type = Column(Enum(IncidentType), default=IncidentType.CRASH)
    description = Column(Text, nullable=True)
    severity = Column(Integer, default=2)
    photo_url = Column(String(500), nullable=True)
    ai_verified = Column(Boolean, default=False)
    ai_confidence = Column(Float, nullable=True)
    ai_analysis = Column(Text, nullable=True)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    reporter_device_id = Column(String(200), nullable=True)
    confirmations_count = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    resolved_at = Column(DateTime, nullable=True)

    confirmations = relationship("IncidentConfirmation", back_populates="incident")


class IncidentConfirmation(Base):
    """Подтверждение от водителя"""
    __tablename__ = "incident_confirmations"

    id = Column(Integer, primary_key=True, index=True)
    incident_id = Column(Integer, ForeignKey("incident_reports.id"), nullable=False)
    device_id = Column(String(200), nullable=False)
    is_resolved = Column(Boolean, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    incident = relationship("IncidentReport", back_populates="confirmations")
