"""
Notification Service — stub (push notifications not yet configured).
"""
import logging
from sqlalchemy.orm import Session
from app.models import Alert

logger = logging.getLogger(__name__)


def notify_nearby_drivers(db: Session, alert: Alert, herd_lat: float, herd_lon: float) -> int:
    """Placeholder — returns 0 until push notification provider is configured."""
    logger.debug("Push notifications not configured — skipping notify_nearby_drivers")
    return 0
