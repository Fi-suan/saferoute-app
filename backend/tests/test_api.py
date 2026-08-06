"""
Тесты API: базовые маршруты, аутентификация, инциденты, стада.

Покрывают в том числе баги, чинившиеся в этой ветке, чтобы они не вернулись
незамеченными.
"""


# ── Служебные маршруты ───────────────────────────────────────────────────────

def test_root_responds(client):
    res = client.get("/")
    assert res.status_code == 200
    assert res.json()["name"]


def test_health_reports_db_ok(client):
    res = client.get("/health")
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "ok"
    assert body["db"] is True


def test_geozones_seeded_on_startup(client):
    res = client.get("/api/v1/geozones/geojson")
    assert res.status_code == 200
    features = res.json()["features"]
    assert len(features) > 0, "lifespan должен был засеять геозоны"


# ── Аутентификация ───────────────────────────────────────────────────────────

def test_register_returns_token(client):
    res = client.post(
        "/api/v1/auth/register", json={"device_id": "dev-1", "role": "driver"}
    )
    assert res.status_code == 200
    assert res.json()["token"]
    assert res.json()["role"] == "driver"


def test_register_owner_keeps_owner_role(client):
    res = client.post(
        "/api/v1/auth/register", json={"device_id": "dev-owner", "role": "owner"}
    )
    assert res.json()["role"] == "owner"


def test_report_requires_auth(client):
    res = client.post(
        "/api/v1/incidents/report",
        json={"incident_type": "animal", "severity": 3,
              "latitude": 51.9, "longitude": 74.2},
    )
    assert res.status_code == 401


# ── Инциденты ────────────────────────────────────────────────────────────────

def _report(client, headers, **overrides):
    payload = {
        "incident_type": "animal", "severity": 4,
        "latitude": 51.95, "longitude": 74.21,
    }
    payload.update(overrides)
    res = client.post("/api/v1/incidents/report", json=payload, headers=headers)
    assert res.status_code == 201, res.text
    return res.json()


def test_report_and_list_active(client, driver):
    created = _report(client, driver, description="Жылқылар жолда")
    assert created["is_active"] is True

    active = client.get("/api/v1/incidents/active").json()
    assert any(i["id"] == created["id"] for i in active)


def test_created_at_carries_timezone(client, driver):
    """Регресс: колонки были TIMESTAMP WITHOUT TIME ZONE и клиент читал время как локальное."""
    created = _report(client, driver)
    assert created["created_at"].endswith(("+00:00", "Z"))


def test_invalid_latitude_rejected(client, driver):
    res = client.post(
        "/api/v1/incidents/report",
        json={"incident_type": "animal", "severity": 3,
              "latitude": 999, "longitude": 74.2},
        headers=driver,
    )
    assert res.status_code == 422


def test_oversized_photo_rejected(client, driver):
    res = client.post(
        "/api/v1/incidents/report",
        json={"incident_type": "animal", "severity": 3,
              "latitude": 51.9, "longitude": 74.2,
              "photo_base64": "A" * 2_000_001},
        headers=driver,
    )
    assert res.status_code == 422


def test_nearby_filters_by_radius(client, driver):
    _report(client, driver, latitude=51.95, longitude=74.21)
    near = client.get("/api/v1/incidents/nearby?lat=51.95&lon=74.21&radius_km=3").json()
    far = client.get("/api/v1/incidents/nearby?lat=43.24&lon=76.91&radius_km=3").json()
    assert len(near) == 1
    assert far == []


# ── Подтверждения ────────────────────────────────────────────────────────────

def test_double_confirm_from_same_device_rejected(client, driver, register):
    inc = _report(client, driver)
    h = register("confirmer-1")
    first = client.post(f"/api/v1/incidents/{inc['id']}/confirm",
                        json={"device_id": "confirmer-1", "is_resolved": False}, headers=h)
    assert first.status_code == 200
    second = client.post(f"/api/v1/incidents/{inc['id']}/confirm",
                         json={"device_id": "confirmer-1", "is_resolved": False}, headers=h)
    assert second.status_code == 400


def test_still_there_votes_do_not_close_incident(client, driver, register):
    """
    Регресс: закрытие сравнивало общий счётчик подтверждений, поэтому три голоса
    «опасность есть» плюс один «нет» закрывали живой инцидент.
    """
    inc = _report(client, driver)
    for n in range(3):
        h = register(f"still-{n}")
        client.post(f"/api/v1/incidents/{inc['id']}/confirm",
                    json={"device_id": f"still-{n}", "is_resolved": False}, headers=h)

    h = register("gone-0")
    res = client.post(f"/api/v1/incidents/{inc['id']}/confirm",
                      json={"device_id": "gone-0", "is_resolved": True}, headers=h)
    assert res.json()["confirmations"] == 4
    assert res.json()["is_active"] is True


def test_three_resolve_votes_close_incident(client, driver, register):
    inc = _report(client, driver)
    for n in range(3):
        h = register(f"gone-{n}")
        res = client.post(f"/api/v1/incidents/{inc['id']}/confirm",
                          json={"device_id": f"gone-{n}", "is_resolved": True}, headers=h)
    assert res.json()["is_active"] is False
    assert client.get(f"/api/v1/incidents/{inc['id']}").json()["resolved_at"] is not None


# ── Стада ────────────────────────────────────────────────────────────────────

def _create_herd(client, headers):
    res = client.post("/api/v1/herds/",
                      json={"name": "Тест үйір", "animal_type": "horse",
                            "estimated_count": 5},
                      headers=headers)
    assert res.status_code == 201, res.text
    return res.json()["id"]


def test_driver_cannot_update_herd_location(client, driver, owner):
    herd_id = _create_herd(client, owner)
    res = client.post(f"/api/v1/herds/{herd_id}/location",
                      json={"latitude": 51.18, "longitude": 71.90, "speed_kmh": 0},
                      headers=driver)
    assert res.status_code == 403


def test_repeated_location_updates_succeed(client, owner):
    """
    Регресс: второе обновление падало с
    'can't subtract offset-naive and offset-aware datetimes'.
    """
    herd_id = _create_herd(client, owner)
    for lat, lon in [(51.18, 71.90), (51.19, 71.92), (51.20, 71.94)]:
        res = client.post(f"/api/v1/herds/{herd_id}/location",
                          json={"latitude": lat, "longitude": lon, "speed_kmh": 10},
                          headers=owner)
        assert res.status_code == 200, res.text


def test_location_update_inside_geozone_raises_alert(client, owner):
    herd_id = _create_herd(client, owner)
    res = client.post(f"/api/v1/herds/{herd_id}/location",
                      json={"latitude": 51.18, "longitude": 71.90, "speed_kmh": 5},
                      headers=owner)
    assert res.json()["alert"] is not None
    assert len(client.get("/api/v1/alerts/active").json()) == 1


def test_deactivate_herd_resolves_its_alerts(client, owner):
    herd_id = _create_herd(client, owner)
    client.post(f"/api/v1/herds/{herd_id}/location",
                json={"latitude": 51.18, "longitude": 71.90, "speed_kmh": 5},
                headers=owner)
    res = client.patch(f"/api/v1/herds/{herd_id}/deactivate", headers=owner)
    assert res.status_code == 200
    assert res.json()["alerts_resolved"] == 1
    assert client.get("/api/v1/alerts/active").json() == []


# ── GDPR ─────────────────────────────────────────────────────────────────────

def test_device_can_delete_only_own_data(client, driver, register):
    register("victim")
    res = client.delete("/api/v1/devices/victim/data", headers=driver)
    assert res.status_code == 403


def test_delete_removes_own_reports(client, driver):
    _report(client, driver)
    res = client.delete("/api/v1/devices/test-driver/data", headers=driver)
    assert res.status_code == 200
    assert res.json()["deleted"]["reports"] == 1
    assert client.get("/api/v1/incidents/active").json() == []
