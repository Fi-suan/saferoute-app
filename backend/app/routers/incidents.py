"""
Incidents Router — создание, просмотр, подтверждение инцидентов
"""
import json
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


# ── AI Photo Verification ────────────────────────────────────────────────────

AI_SYSTEM_PROMPT = """\
You are an AI road safety analyst for the Sapa Jol mobile app in Kazakhstan.

Your task: analyze a photo from the road and decide whether to verify the reported incident.

## What you evaluate:

1. **Match with incident type** - does the photo content match the reported type:
   - animal: livestock (horses, cows, camels, sheep, goats) on or near the road
   - crash: traffic accident, damaged vehicles, collisions
   - hazard: road obstacles (rocks, potholes, flooding, fallen trees, ice)
   - other: any other road danger

2. **Danger level** (severity 1-5):
   - 1: Minimal - object is far from the road, does not obstruct traffic
   - 2: Low - potential threat exists, but easy to bypass
   - 3: Medium - part of the lane is occupied, speed reduction required
   - 4: High - serious danger, potential skidding or collision
   - 5: Critical - road is completely blocked, full stop required

3. **Decision factors to consider:**
   - Distance of the object from the roadway
   - Number of animals / size of obstacle
   - Visibility (day/night/fog/rain)
   - Speed limit context (highway vs city - assess from background)
   - Animal behavior (stationary / moving toward road / crossing)
   - Presence of fences or barriers
   - Road surface condition
   - Whether vehicles are already stopped or slowing

4. **Rejection criteria:**
   - Photo is not from a road (selfie, food, text, interior) -> verified: false
   - Photo shows a road but no incident -> verified: false
   - Screenshot / photo of a screen -> verified: false
   - Poor quality but object is visible -> verified: true, lower confidence

Always respond in the specified JSON format. Write analysis_kk in Kazakh language."""

AI_RESPONSE_SCHEMA = {
    "type": "json_schema",
    "json_schema": {
        "name": "incident_verification",
        "strict": True,
        "schema": {
            "type": "object",
            "properties": {
                "verified": {
                    "type": "boolean",
                    "description": "true if photo confirms the reported incident type",
                },
                "confidence": {
                    "type": "number",
                    "description": "Confidence in the decision from 0.0 to 1.0",
                },
                "severity_suggestion": {
                    "type": "integer",
                    "description": "Suggested danger level from 1 to 5",
                },
                "analysis_kk": {
                    "type": "string",
                    "description": "Brief analysis in Kazakh language (1-2 sentences)",
                },
                "factors": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "Key factors that influenced the decision",
                },
            },
            "required": ["verified", "confidence", "severity_suggestion", "analysis_kk", "factors"],
            "additionalProperties": False,
        },
    },
}


def _ai_fallback(user_severity: int, reason_kk: str) -> dict:
    return {
        "verified": False,
        "confidence": 0.0,
        "severity_suggestion": user_severity,
        "analysis": reason_kk,
        "factors": [],
    }


async def verify_photo_with_ai(
    photo_base64: Optional[str],
    incident_type: str,
    user_severity: int = 3,
) -> dict:
    """AI verification via OpenAI GPT-4o Vision with structured output."""
    import os
    api_key = os.environ.get("OPENAI_API_KEY", "")

    if not photo_base64:
        return _ai_fallback(user_severity, "Фото берiлмеген. Белгi тексерусiз жасалды.")

    if not api_key:
        logger.warning("OPENAI_API_KEY not set - AI photo verification skipped")
        return _ai_fallback(user_severity, "AI тексеруi қолжетiмсiз - қоғамдастық растауын кутуде.")

    try:
        import httpx
        async with httpx.AsyncClient(timeout=25.0) as client:
            resp = await client.post(
                "https://api.openai.com/v1/chat/completions",
                headers={"Authorization": f"Bearer {api_key}"},
                json={
                    "model": "gpt-4o",
                    "max_tokens": 300,
                    "temperature": 0.1,
                    "response_format": AI_RESPONSE_SCHEMA,
                    "messages": [
                        {
                            "role": "system",
                            "content": AI_SYSTEM_PROMPT,
                        },
                        {
                            "role": "user",
                            "content": [
                                {
                                    "type": "text",
                                    "text": (
                                        f"Reported incident type: {incident_type}\n"
                                        f"User-reported severity: {user_severity}/5\n"
                                        f"Analyze the photo and make your decision."
                                    ),
                                },
                                {
                                    "type": "image_url",
                                    "image_url": {
                                        "url": f"data:image/jpeg;base64,{photo_base64}",
                                        "detail": "low",
                                    },
                                },
                            ],
                        },
                    ],
                },
            )

            if resp.status_code != 200:
                logger.error(f"OpenAI API error {resp.status_code}: {resp.text[:300]}")
                return _ai_fallback(user_severity, "API қатесi - қоғамдастық растауын кутуде.")

            data = resp.json()
            text = data["choices"][0]["message"]["content"]
            parsed = json.loads(text)

            confidence = max(0.0, min(1.0, float(parsed["confidence"])))
            severity = max(1, min(5, int(parsed["severity_suggestion"])))

            return {
                "verified": bool(parsed["verified"]),
                "confidence": confidence,
                "severity_suggestion": severity,
                "analysis": parsed.get("analysis_kk", "AI талдауы аяқталды."),
                "factors": parsed.get("factors", []),
            }

    except json.JSONDecodeError as e:
        logger.error(f"AI response JSON parse failed: {e}")
        return _ai_fallback(user_severity, "AI жауабын өңдеу қатесi.")
    except Exception as e:
        logger.exception(f"AI verification failed: {e}")
        return _ai_fallback(user_severity, "AI қатесi - қоғамдастық растауын кутуде.")


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/report", status_code=201)
@limiter.limit(settings.RATE_LIMIT_REPORT)
async def create_incident(
    request: Request,
    data: IncidentCreate,
    db: Session = Depends(get_db),
    current: Device = Depends(get_current_device),
):
    """Create incident: photo -> AI verification -> map marker"""
    ai_result = await verify_photo_with_ai(data.photo_base64, data.incident_type, data.severity)

    try:
        inc_type = IncidentType(data.incident_type)
    except ValueError:
        inc_type = IncidentType.OTHER

    # AI can override severity if it has high confidence
    final_severity = data.severity
    if ai_result["verified"] and ai_result["confidence"] >= 0.7:
        final_severity = ai_result["severity_suggestion"]

    incident = IncidentReport(
        incident_type=inc_type,
        description=data.description,
        severity=final_severity,
        latitude=data.latitude,
        longitude=data.longitude,
        reporter_device_id=current.device_id,
        ai_verified=ai_result["verified"],
        ai_confidence=ai_result["confidence"],
        ai_analysis=ai_result["analysis"],
        ai_severity_suggestion=ai_result.get("severity_suggestion"),
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
        "ai_severity_suggestion": inc.ai_severity_suggestion,
        "confirmations_count": inc.confirmations_count,
        "is_active": inc.is_active,
        "created_at": inc.created_at.isoformat() if inc.created_at else None,
        "resolved_at": inc.resolved_at.isoformat() if inc.resolved_at else None,
    }
