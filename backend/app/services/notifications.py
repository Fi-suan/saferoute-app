"""
Рассылка предупреждений водителям поблизости.

Раньше здесь была заглушка, возвращавшая 0: алерты создавались в базе, но до
людей не доходили — водитель узнавал об опасности, только пока приложение
открыто на карте.
"""
import logging
from datetime import timedelta

from sqlalchemy.orm import Session

from app.config import settings
from app.models import Alert, Device, Role, utcnow
from app.services.geofencing import haversine_km
from app.services.push import build_message, is_expo_token, send_messages

logger = logging.getLogger(__name__)

# Устройства, не выходившие на связь дольше этого срока, в рассылку не берём:
# их последняя известная координата уже ничего не значит.
DEVICE_STALE_DAYS = 30


def _candidate_drivers(db: Session) -> list[Device]:
    cutoff = utcnow() - timedelta(days=DEVICE_STALE_DAYS)
    return (
        db.query(Device)
        .filter(
            Device.role == Role.DRIVER,
            Device.is_active.is_(True),
            Device.fcm_token.isnot(None),
            Device.latitude.isnot(None),
            Device.longitude.isnot(None),
            Device.last_seen >= cutoff,
        )
        .all()
    )


def notify_nearby_drivers(
    db: Session,
    alert: Alert,
    herd_lat: float,
    herd_lon: float,
) -> int:
    """
    Отправляет предупреждение водителям в радиусе ALERT_RADIUS_KM от стада.

    Вызывать только для ВНОВЬ созданных алертов. Позиция стада в ручном режиме
    обновляется раз в 10 секунд, и рассылка на каждое обновление означала бы
    уведомление каждые 10 секунд одним и тем же людям.

    @returns сколько сообщений принял Expo.
    """
    drivers = _candidate_drivers(db)
    if not drivers:
        return 0

    messages = []
    for driver in drivers:
        if not is_expo_token(driver.fcm_token):
            continue
        distance = haversine_km(driver.latitude, driver.longitude, herd_lat, herd_lon)
        if distance > settings.ALERT_RADIUS_KM:
            continue
        messages.append(
            build_message(
                token=driver.fcm_token,
                title="⚠️ Абай болыңыз!",
                body=alert.message_kk,
                data={
                    "alertId": alert.id,
                    "herdId": alert.herd_id,
                    "level": alert.level.value,
                    "distanceKm": round(distance, 1),
                },
            )
        )

    if not messages:
        return 0

    accepted, dead_tokens = send_messages(messages)

    if dead_tokens:
        # Приложение удалено — токен больше не наш, чистим, чтобы не пытаться снова.
        db.query(Device).filter(Device.fcm_token.in_(dead_tokens)).update(
            {"fcm_token": None}, synchronize_session=False
        )

    alert.notified_count = (alert.notified_count or 0) + accepted
    db.commit()

    logger.info(
        "Алерт %s: разослано %d из %d кандидатов, мёртвых токенов %d",
        alert.id, accepted, len(messages), len(dead_tokens),
    )
    return accepted
