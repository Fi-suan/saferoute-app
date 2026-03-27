"""
Notification Service — FCM push (no Twilio, no external SMS deps).
Falls back silently if Firebase not configured.
"""
import logging
from typing import List
from sqlalchemy.orm import Session
from app.models import Device, Role, Alert
from app.config import settings
from app.services.geofencing import haversine_km

logger = logging.getLogger(__name__)


def send_push_notification(fcm_token: str, alert: Alert) -> bool:
    """Send FCM push — gracefully skips if firebase-admin not installed"""
    try:
        import firebase_admin
        from firebase_admin import credentials, messaging

        if not firebase_admin._apps:
            if not settings.FIREBASE_CREDENTIALS_PATH:
                return False
            cred = credentials.Certificate(settings.FIREBASE_CREDENTIALS_PATH)
            firebase_admin.initialize_app(cred)

        msg = messaging.Message(
            token=fcm_token,
            notification=messaging.Notification(
                title="Sapa Jol: Жол қауіпі",
                body=alert.message_kk,
            ),
            data={
                "alert_id": str(alert.id),
                "alert_level": alert.level.value,
                "herd_id": str(alert.herd_id),
                "distance_km": str(alert.distance_to_road_km or ""),
            },
        )
        messaging.send(msg)
        return True
    except ImportError:
        # firebase-admin not installed — silent skip
        return False
    except Exception as e:
        logger.error(f"FCM send failed: {e}")
        return False


def notify_nearby_drivers(db: Session, alert: Alert, herd_lat: float, herd_lon: float) -> int:
    from datetime import datetime, timedelta
    cutoff = datetime.utcnow() - timedelta(minutes=30)
    devices: List[Device] = (
        db.query(Device)
        .filter(
            Device.role == Role.DRIVER,
            Device.is_active == True,
            Device.last_seen >= cutoff,
        )
        .all()
    )

    notified = 0
    for device in devices:
        if device.latitude is None or device.longitude is None:
            continue
        if haversine_km(device.latitude, device.longitude, herd_lat, herd_lon) > settings.ALERT_RADIUS_KM:
            continue
        if device.fcm_token and send_push_notification(device.fcm_token, alert):
            notified += 1

    if notified > 0:
        alert.notified_count = (alert.notified_count or 0) + notified
        db.commit()
    return notified
