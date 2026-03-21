import logging
from typing import List, Optional
from sqlalchemy.orm import Session
from app.models import DriverDevice, Alert, AlertLevel
from app.config import settings
from app.services.geofencing import haversine_km

logger = logging.getLogger(__name__)


def send_push_notification(fcm_token: str, alert: Alert, lang: str = "kk") -> bool:
    """Отправить push-уведомление через FCM"""
    try:
        import firebase_admin
        from firebase_admin import credentials, messaging

        if not firebase_admin._apps:
            if settings.FIREBASE_CREDENTIALS_PATH:
                cred = credentials.Certificate(settings.FIREBASE_CREDENTIALS_PATH)
                firebase_admin.initialize_app(cred)
            else:
                logger.warning("Firebase credentials not configured")
                return False

        level_colors = {AlertLevel.LOW: "#27ae60", AlertLevel.MEDIUM: "#f39c12", AlertLevel.HIGH: "#e67e22", AlertLevel.CRITICAL: "#c0392b"}
        message_text = alert.message_kk if lang == "kk" else alert.message_ru
        title = "⚠️ Sapa Jol: Жол қауіпі" if lang == "kk" else "⚠️ Sapa Jol: Опасность на дороге"

        msg = messaging.Message(
            token=fcm_token,
            notification=messaging.Notification(title=title, body=message_text),
            android=messaging.AndroidConfig(priority="high", notification=messaging.AndroidNotification(color=level_colors.get(alert.level, "#e67e22"), sound="default", channel_id="saferoute_alerts")),
            data={"alert_id": str(alert.id), "alert_level": alert.level.value, "herd_id": str(alert.herd_id), "distance_km": str(alert.distance_to_road_km or "")},
        )
        messaging.send(msg)
        return True
    except Exception as e:
        logger.error(f"FCM send failed: {e}")
        return False


def notify_nearby_drivers(db: Session, alert: Alert, herd_lat: float, herd_lon: float) -> int:
    from datetime import datetime, timedelta
    cutoff = datetime.utcnow() - timedelta(minutes=30)
    devices: List[DriverDevice] = db.query(DriverDevice).filter(DriverDevice.is_active == True, DriverDevice.last_seen >= cutoff).all()

    notified = 0
    for device in devices:
        if device.latitude is None or device.longitude is None:
            continue
        dist = haversine_km(device.latitude, device.longitude, herd_lat, herd_lon)
        if dist > settings.ALERT_RADIUS_KM:
            continue
        if device.fcm_token:
            if send_push_notification(device.fcm_token, alert):
                notified += 1

    alert.notified_count = (alert.notified_count or 0) + notified
    db.commit()
    return notified
