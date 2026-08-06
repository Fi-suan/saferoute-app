"""
Тесты рассылки push.

Сеть не используется: транспорт httpx подменяется заглушкой, поэтому
проверяется ровно то, что мы контролируем — отбор получателей, разбиение на
пачки, разбор ответа Expo и защита от повторных уведомлений.
"""
import json

import httpx
import pytest

from app.models import Device, Role, utcnow
from app.services import push


@pytest.fixture()
def expo(monkeypatch):
    """
    Заглушка Expo Push. Собирает отправленные сообщения и отдаёт заранее
    заданные талоны.
    """
    class Fake:
        def __init__(self):
            self.requests: list[list[dict]] = []
            self.ticket_for = lambda msg: {"status": "ok", "id": "tk"}
            self.status_code = 200

        @property
        def sent(self) -> list[dict]:
            return [m for batch in self.requests for m in batch]

        def handler(self, request: httpx.Request) -> httpx.Response:
            batch = json.loads(request.content)
            self.requests.append(batch)
            if self.status_code != 200:
                return httpx.Response(self.status_code, text="upstream down")
            return httpx.Response(200, json={"data": [self.ticket_for(m) for m in batch]})

    fake = Fake()
    push.set_transport(httpx.MockTransport(fake.handler))
    yield fake
    push.set_transport(None)


def _driver(db, device_id, lat, lon, token="ExponentPushToken[abc]", last_seen=None):
    d = Device(
        device_id=device_id, role=Role.DRIVER, fcm_token=token,
        latitude=lat, longitude=lon, is_active=True,
        last_seen=last_seen or utcnow(),
    )
    db.add(d)
    db.commit()
    return d


# ── Токены ───────────────────────────────────────────────────────────────────

@pytest.mark.parametrize("token,expected", [
    ("ExponentPushToken[xxx]", True),
    ("ExpoPushToken[xxx]", True),
    ("some-raw-fcm-token", False),
    ("", False),
    (None, False),
])
def test_is_expo_token(token, expected):
    assert push.is_expo_token(token) is expected


# ── Отправка ─────────────────────────────────────────────────────────────────

def test_send_messages_reports_accepted(expo):
    messages = [push.build_message(f"ExponentPushToken[{i}]", "t", "b") for i in range(3)]
    accepted, dead = push.send_messages(messages)
    assert accepted == 3
    assert dead == []
    assert len(expo.requests) == 1


def test_send_messages_splits_into_batches_of_100(expo):
    messages = [push.build_message(f"ExponentPushToken[{i}]", "t", "b") for i in range(250)]
    accepted, _ = push.send_messages(messages)
    assert accepted == 250
    assert [len(b) for b in expo.requests] == [100, 100, 50]


def test_device_not_registered_tokens_are_reported(expo):
    dead_token = "ExponentPushToken[gone]"
    expo.ticket_for = lambda m: (
        {"status": "error", "message": "not registered",
         "details": {"error": "DeviceNotRegistered"}}
        if m["to"] == dead_token else {"status": "ok", "id": "tk"}
    )
    messages = [
        push.build_message("ExponentPushToken[live]", "t", "b"),
        push.build_message(dead_token, "t", "b"),
    ]
    accepted, dead = push.send_messages(messages)
    assert accepted == 1
    assert dead == [dead_token]


def test_upstream_failure_is_swallowed(expo):
    expo.status_code = 503
    accepted, dead = push.send_messages([push.build_message("ExponentPushToken[x]", "t", "b")])
    assert accepted == 0
    assert dead == []


def test_empty_message_list_sends_nothing(expo):
    assert push.send_messages([]) == (0, [])
    assert expo.requests == []


def test_message_carries_high_priority_and_channel():
    msg = push.build_message("ExponentPushToken[x]", "Заголовок", "Текст", {"alertId": 7})
    assert msg["priority"] == "high"
    assert msg["channelId"] == "saferoute-alerts"
    assert msg["data"]["alertId"] == 7


# ── Отбор получателей ────────────────────────────────────────────────────────

def _make_alert(db, herd_id, geozone_id):
    from app.models import Alert, AlertLevel
    a = Alert(
        herd_id=herd_id, geozone_id=geozone_id, level=AlertLevel.HIGH,
        message_ru="ru", message_kk="kk", distance_to_road_km=1.0, is_active=True,
    )
    db.add(a)
    db.commit()
    db.refresh(a)
    return a


@pytest.fixture()
def alert_setup(client):
    """Стадо, геозона и алерт — минимум, чтобы позвать рассылку."""
    from app.database import SessionLocal
    from app.models import GeoZone, Herd

    db = SessionLocal()
    herd = Herd(name="Үйір", estimated_count=10)
    db.add(herd)
    zone = db.query(GeoZone).first()
    db.commit()
    db.refresh(herd)
    alert = _make_alert(db, herd.id, zone.id)
    yield db, alert
    db.close()


def test_driver_within_radius_is_notified(expo, alert_setup):
    from app.services.notifications import notify_nearby_drivers
    db, alert = alert_setup
    _driver(db, "near", 51.18, 71.45)

    sent = notify_nearby_drivers(db, alert, 51.18, 71.45)
    assert sent == 1
    assert expo.sent[0]["body"] == alert.message_kk


def test_driver_outside_radius_is_skipped(expo, alert_setup):
    from app.services.notifications import notify_nearby_drivers
    db, alert = alert_setup
    _driver(db, "far", 43.24, 76.91)  # Алматы — сотни километров

    assert notify_nearby_drivers(db, alert, 51.18, 71.45) == 0
    assert expo.requests == []


def test_stale_device_is_skipped(expo, alert_setup):
    from datetime import timedelta

    from app.services.notifications import DEVICE_STALE_DAYS, notify_nearby_drivers
    db, alert = alert_setup
    old = utcnow() - timedelta(days=DEVICE_STALE_DAYS + 1)
    _driver(db, "stale", 51.18, 71.45, last_seen=old)

    assert notify_nearby_drivers(db, alert, 51.18, 71.45) == 0


def test_non_expo_token_is_skipped(expo, alert_setup):
    from app.services.notifications import notify_nearby_drivers
    db, alert = alert_setup
    _driver(db, "raw", 51.18, 71.45, token="raw-fcm-token")

    assert notify_nearby_drivers(db, alert, 51.18, 71.45) == 0


def test_owner_is_not_notified(expo, alert_setup):
    """Пастуху не нужно предупреждение о его же стаде."""
    from app.services.notifications import notify_nearby_drivers
    db, alert = alert_setup
    owner = Device(device_id="owner", role=Role.OWNER, fcm_token="ExponentPushToken[o]",
                   latitude=51.18, longitude=71.45, is_active=True, last_seen=utcnow())
    db.add(owner)
    db.commit()

    assert notify_nearby_drivers(db, alert, 51.18, 71.45) == 0


def test_dead_token_is_cleared_from_device(expo, alert_setup):
    from app.services.notifications import notify_nearby_drivers
    db, alert = alert_setup
    _driver(db, "gone", 51.18, 71.45, token="ExponentPushToken[gone]")
    expo.ticket_for = lambda m: {"status": "error", "message": "x",
                                 "details": {"error": "DeviceNotRegistered"}}

    notify_nearby_drivers(db, alert, 51.18, 71.45)
    assert db.query(Device).filter(Device.device_id == "gone").first().fcm_token is None


def test_notified_count_is_recorded(expo, alert_setup):
    from app.services.notifications import notify_nearby_drivers
    db, alert = alert_setup
    _driver(db, "d1", 51.18, 71.45, token="ExponentPushToken[1]")
    _driver(db, "d2", 51.19, 71.46, token="ExponentPushToken[2]")

    notify_nearby_drivers(db, alert, 51.18, 71.45)
    db.refresh(alert)
    assert alert.notified_count == 2


# ── Главный регресс ──────────────────────────────────────────────────────────

def test_repeated_location_updates_notify_only_once(expo, client, register):
    """
    В ручном режиме позиция стада уходит на сервер каждые 10 секунд.
    Рассылка обязана срабатывать только на создание алерта, иначе водители
    получали бы уведомление каждые 10 секунд.
    """
    from app.database import SessionLocal

    owner = register("owner-push", "owner")
    db = SessionLocal()
    _driver(db, "nearby-driver", 51.18, 71.45)
    db.close()

    herd_id = client.post(
        "/api/v1/herds/",
        json={"name": "Үйір", "animal_type": "horse", "estimated_count": 10},
        headers=owner,
    ).json()["id"]

    first = client.post(f"/api/v1/herds/{herd_id}/location",
                        json={"latitude": 51.18, "longitude": 71.45, "speed_kmh": 3},
                        headers=owner)
    assert first.json()["notifying"] is True

    for lat in (51.181, 51.182, 51.183):
        again = client.post(f"/api/v1/herds/{herd_id}/location",
                            json={"latitude": lat, "longitude": 71.45, "speed_kmh": 3},
                            headers=owner)
        assert again.json()["alert"] is not None, "алерт должен оставаться активным"
        assert again.json()["notifying"] is False, "повторная рассылка по тому же алерту"

    assert len(expo.sent) == 1, f"ожидалось одно уведомление, отправлено {len(expo.sent)}"
