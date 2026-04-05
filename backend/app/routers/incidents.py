"""
Incidents Router — создание, просмотр, подтверждение инцидентов
"""
import logging
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from datetime import datetime, timezone
from typing import Optional
from slowapi import Limiter
from slowapi.util import get_remote_address

logger = logging.getLogger(__name__)

from app.database import get_db
from app.config import settings
from app.models import IncidentReport, IncidentConfirmation, IncidentType, Device
from app.services.geofencing import haversine_km
from app.services.auth import get_current_device

limiter = Limiter(key_func=get_remote_address)

router = APIRouter(prefix="/api/v1/incidents", tags=["incidents"])


from pydantic import BaseModel, Field, field_validator


class IncidentCreate(BaseModel):
    incident_type: str = "animal"
    description: Optional[str] = Field(None, max_length=2000)
    severity: int = Field(3, ge=1, le=5)
    latitude: float
    longitude: float
    photo_base64: Optional[str] = None
    reporter_device_id: Optional[str] = None

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

    @field_validator("photo_base64")
    @classmethod
    def validate_photo_size(cls, v: Optional[str]) -> Optional[str]:
        if not v:
            return v
        if len(v) > 2_000_000:  # ~1.5MB decoded
            raise ValueError("photo_base64 too large (max ~1.5MB)")
        import re
        if not re.fullmatch(r'[A-Za-z0-9+/=\s]+', v):
            raise ValueError("photo_base64 contains invalid characters")
        return v


class ConfirmRequest(BaseModel):
    device_id: str
    is_resolved: bool


async def verify_photo_with_ai(photo_base64: Optional[str], incident_type: str) -> dict:
    """AI verification via OpenAI GPT-4o Vision (if API key set)"""
    import os
    api_key = os.environ.get("OPENAI_API_KEY", "")

    if not photo_base64:
        return {
            "verified": False,
            "confidence": 0.5,
            "analysis": "Фото берілмеген. Белгі тексерусіз жасалды."
        }

    if not api_key:
        logger.warning("OPENAI_API_KEY not set — AI photo verification skipped")
        return {
            "verified": False,
            "confidence": 0.0,
            "analysis": "AI тексеруі қолжетімсіз — қоғамдастық растауын күтуде."
        }

    try:
        import httpx
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(
                "https://api.openai.com/v1/chat/completions",
                headers={"Authorization": f"Bearer {api_key}"},
                json={
                    "model": "gpt-4o",
                    "max_tokens": 200,
                    "messages": [
                        {
                            "role": "system",
                            "content": (
                                "Ты — AI-аналитик дорожной безопасности Казахстана для приложения Sapa Jol. "
                                "Анализируй фото дорожных инцидентов. Отвечай СТРОГО в JSON: "
                                '{"verified": true/false, "confidence": 0.0-1.0, "analysis_kk": "анализ на казахском"}'
                            )
                        },
                        {
                            "role": "user",
                            "content": [
                                {"type": "text", "text": f"Тип: {incident_type}. Фотоны талда:"},
                                {"type": "image_url", "image_url": {
                                    "url": f"data:image/jpeg;base64,{photo_base64}",
                                    "detail": "low"
                                }}
                            ]
                        }
                    ]
                }
            )
            data = resp.json()
            text = data["choices"][0]["message"]["content"]
            import re, json
            m = re.search(r'\{[\s\S]*\}', text)
            if m:
                parsed = json.loads(m.group(0))
                return {
                    "verified": bool(parsed.get("verified", False)),
                    "confidence": float(parsed.get("confidence", 0.5)),
                    "analysis": parsed.get("analysis_kk", "AI талдауы аяқталды.")
                }
    except Exception as e:
        logger.exception(f"AI verification failed: {e}")

    return {"verified": False, "confidence": 0.3, "analysis": "AI қатесі — қоғамдастық растауын күтуде."}


@router.post("/report", status_code=201)
@limiter.limit(settings.RATE_LIMIT_REPORT)
async def create_incident(
    request: Request,
    data: IncidentCreate,
    db: Session = Depends(get_db),
    current: Device = Depends(get_current_device),
):
    """Создать инцидент: фото → AI проверка → метка на карте"""
    ai_result = await verify_photo_with_ai(data.photo_base64, data.incident_type)

    try:
        inc_type = IncidentType(data.incident_type)
    except ValueError:
        inc_type = IncidentType.OTHER

    incident = IncidentReport(
        incident_type=inc_type,
        description=data.description,
        severity=data.severity,
        latitude=data.latitude,
        longitude=data.longitude,
        reporter_device_id=current.device_id,
        ai_verified=ai_result["verified"],
        ai_confidence=ai_result["confidence"],
        ai_analysis=ai_result["analysis"],
        is_active=True,
    )
    db.add(incident)
    db.commit()
    db.refresh(incident)
    return _to_dict(incident)


@router.get("/active")
def get_active_incidents(db: Session = Depends(get_db)):
    incidents = db.query(IncidentReport).filter(
        IncidentReport.is_active == True
    ).order_by(IncidentReport.created_at.desc()).all()
    return [_to_dict(i) for i in incidents]


@router.get("/nearby")
def get_nearby_incidents(lat: float, lon: float, radius_km: float = 3.0, db: Session = Depends(get_db)):
    incidents = db.query(IncidentReport).filter(IncidentReport.is_active == True).all()
    nearby = []
    for inc in incidents:
        dist = haversine_km(lat, lon, inc.latitude, inc.longitude)
        if dist <= radius_km:
            d = _to_dict(inc)
            d["distance_km"] = round(dist, 2)
            nearby.append(d)
    nearby.sort(key=lambda x: x["distance_km"])
    return nearby


@router.get("/feed")
def get_incident_feed(limit: int = 50, offset: int = 0, db: Session = Depends(get_db)):
    incidents = db.query(IncidentReport).order_by(
        IncidentReport.created_at.desc()
    ).offset(offset).limit(min(limit, 200)).all()
    return [_to_dict(i) for i in incidents]


@router.post("/{incident_id}/confirm")
def confirm_incident(
    incident_id: int,
    data: ConfirmRequest,
    db: Session = Depends(get_db),
    current: Device = Depends(get_current_device),
):
    incident = db.query(IncidentReport).filter(IncidentReport.id == incident_id).first()
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")

    existing = db.query(IncidentConfirmation).filter(
        IncidentConfirmation.incident_id == incident_id,
        IncidentConfirmation.device_id == data.device_id,
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Already confirmed")

    confirmation = IncidentConfirmation(
        incident_id=incident_id,
        device_id=data.device_id,
        is_resolved=data.is_resolved,
    )
    db.add(confirmation)

    # Atomic increment to avoid race condition
    db.query(IncidentReport).filter(IncidentReport.id == incident_id).update(
        {IncidentReport.confirmations_count: IncidentReport.confirmations_count + 1}
    )
    db.flush()
    db.refresh(incident)

    if data.is_resolved and incident.confirmations_count >= 3:
        incident.is_active = False
        incident.resolved_at = datetime.now(timezone.utc)

    db.commit()
    return {
        "status": "ok",
        "confirmations": incident.confirmations_count,
        "is_active": incident.is_active,
    }


@router.get("/{incident_id}")
def get_incident(incident_id: int, db: Session = Depends(get_db)):
    incident = db.query(IncidentReport).filter(IncidentReport.id == incident_id).first()
    if not incident:
        raise HTTPException(status_code=404, detail="Not found")
    return _to_dict(incident)


def _to_dict(inc: IncidentReport) -> dict:
    return {
        "id": inc.id,
        "incident_type": inc.incident_type.value if inc.incident_type else "other",
        "description": inc.description,
        "severity": inc.severity,
        "latitude": inc.latitude,
        "longitude": inc.longitude,
        "photo_url": inc.photo_url,
        "ai_verified": inc.ai_verified,
        "ai_confidence": inc.ai_confidence,
        "ai_analysis": inc.ai_analysis,
        "confirmations_count": inc.confirmations_count,
        "is_active": inc.is_active,
        "created_at": inc.created_at.isoformat() if inc.created_at else None,
        "resolved_at": inc.resolved_at.isoformat() if inc.resolved_at else None,
    }
