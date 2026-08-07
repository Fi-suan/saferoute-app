"""
Тесты хранения фотографий.

Используется moto — он поднимает S3 в процессе и отвечает как настоящий,
поэтому проверяется реальный путь через boto3, а не заглушка вокруг него.
"""
import base64

import boto3
import pytest
from moto import mock_aws

from app.config import settings
from app.services import storage

BUCKET = "saferoute-test"
PUBLIC_BASE = "https://photos.saferoute.kz"

# Минимальный валидный JPEG (SOI + EOI) — содержимое неважно, важны байты.
JPEG_BYTES = b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x00\x00\x01\x00\x01\x00\x00\xff\xd9"
JPEG_B64 = base64.b64encode(JPEG_BYTES).decode()


@pytest.fixture()
def s3(monkeypatch):
    """Включает хранилище и поднимает S3 в процессе."""
    with mock_aws():
        # endpoint_url не задаём: moto перехватывает обращения к штатным
        # адресам AWS. Для R2 он в проде задаётся через переменную окружения.
        monkeypatch.setattr(settings, "S3_ENDPOINT_URL", None)
        monkeypatch.setattr(settings, "S3_BUCKET", BUCKET)
        monkeypatch.setattr(settings, "S3_ACCESS_KEY_ID", "key")
        monkeypatch.setattr(settings, "S3_SECRET_ACCESS_KEY", "secret")
        monkeypatch.setattr(settings, "S3_PUBLIC_BASE_URL", PUBLIC_BASE)
        monkeypatch.setattr(settings, "S3_REGION", "us-east-1")
        storage.reset_client_cache()

        client = boto3.client("s3", region_name="us-east-1")
        client.create_bucket(Bucket=BUCKET)
        yield client

        storage.reset_client_cache()


# ── Выключенное хранилище ────────────────────────────────────────────────────

def test_disabled_by_default():
    """Без переменных окружения ничего не сохраняется и ничего не падает."""
    assert storage.is_enabled() is False
    assert storage.upload_incident_photo(1, JPEG_B64) is None
    assert storage.delete_incident_photos([1]) == 0


# ── Загрузка ─────────────────────────────────────────────────────────────────

def test_upload_returns_public_url_and_stores_bytes(s3):
    url = storage.upload_incident_photo(42, JPEG_B64)

    assert url is not None
    assert url.startswith(f"{PUBLIC_BASE}/incidents/42/")
    assert url.endswith(".jpg")

    key = url[len(PUBLIC_BASE) + 1:]
    obj = s3.get_object(Bucket=BUCKET, Key=key)
    assert obj["Body"].read() == JPEG_BYTES, "в хранилище должны лечь декодированные байты"
    assert obj["ContentType"] == "image/jpeg"
    assert "immutable" in obj["CacheControl"]


def test_object_key_is_unguessable(s3):
    """Ключ не должен выводиться из id: бакет публичен на чтение."""
    first = storage.upload_incident_photo(7, JPEG_B64)
    second = storage.upload_incident_photo(7, JPEG_B64)
    assert first != second


def test_invalid_base64_is_rejected_before_upload(s3):
    assert storage.upload_incident_photo(1, "не-base64!!!") is None
    assert s3.list_objects_v2(Bucket=BUCKET).get("KeyCount", 0) == 0


def test_upload_failure_returns_none_instead_of_raising(s3, monkeypatch):
    """Падение хранилища не должно ронять создание инцидента."""
    monkeypatch.setattr(settings, "S3_BUCKET", "bucket-which-does-not-exist")
    assert storage.upload_incident_photo(1, JPEG_B64) is None


# ── Удаление ─────────────────────────────────────────────────────────────────

def test_delete_removes_all_photos_of_incident(s3):
    storage.upload_incident_photo(5, JPEG_B64)
    storage.upload_incident_photo(5, JPEG_B64)
    storage.upload_incident_photo(6, JPEG_B64)

    deleted = storage.delete_incident_photos([5])
    assert deleted == 2

    remaining = [o["Key"] for o in s3.list_objects_v2(Bucket=BUCKET)["Contents"]]
    assert all(k.startswith("incidents/6/") for k in remaining)


def test_delete_is_safe_for_incident_without_photos(s3):
    assert storage.delete_incident_photos([999]) == 0


# ── Через API ────────────────────────────────────────────────────────────────

def test_report_with_photo_gets_public_url(client, driver, s3):
    res = client.post(
        "/api/v1/incidents/report",
        json={"incident_type": "animal", "severity": 3,
              "latitude": 51.9, "longitude": 74.2, "photo_base64": JPEG_B64},
        headers=driver,
    )
    assert res.status_code == 201
    assert res.json()["photo_url"].startswith(f"{PUBLIC_BASE}/incidents/")


def test_report_without_photo_has_no_url(client, driver, s3):
    res = client.post(
        "/api/v1/incidents/report",
        json={"incident_type": "animal", "severity": 3,
              "latitude": 51.9, "longitude": 74.2},
        headers=driver,
    )
    assert res.json()["photo_url"] is None


def test_photo_not_stored_when_model_rejected_it(client, driver, s3, monkeypatch):
    """Модель посмотрела и сказала «это не дорога» — такое не храним."""
    async def rejecting(*args, **kwargs):
        return {"checked": True, "verified": False, "confidence": 0.9,
                "severity_suggestion": 1, "analysis": "селфи", "factors": []}

    from app.routers import incidents
    monkeypatch.setattr(incidents, "verify_photo_with_ai", rejecting)

    res = client.post(
        "/api/v1/incidents/report",
        json={"incident_type": "animal", "severity": 3,
              "latitude": 51.9, "longitude": 74.2, "photo_base64": JPEG_B64},
        headers=driver,
    )
    assert res.status_code == 201
    assert res.json()["photo_url"] is None
    assert s3.list_objects_v2(Bucket=BUCKET).get("KeyCount", 0) == 0


def test_photo_stored_when_model_did_not_run(client, driver, s3):
    """
    Без ключа OpenAI проверка не выполняется и verified=false.
    Это не повод терять фото — решать будет сообщество.
    """
    res = client.post(
        "/api/v1/incidents/report",
        json={"incident_type": "animal", "severity": 3,
              "latitude": 51.9, "longitude": 74.2, "photo_base64": JPEG_B64},
        headers=driver,
    )
    assert res.json()["ai_verified"] is False
    assert res.json()["photo_url"] is not None


def test_deleting_user_data_removes_photos(client, driver, s3):
    client.post(
        "/api/v1/incidents/report",
        json={"incident_type": "animal", "severity": 3,
              "latitude": 51.9, "longitude": 74.2, "photo_base64": JPEG_B64},
        headers=driver,
    )
    assert s3.list_objects_v2(Bucket=BUCKET)["KeyCount"] == 1

    res = client.delete("/api/v1/devices/test-driver/data", headers=driver)
    assert res.status_code == 200
    assert res.json()["deleted"]["photos"] == 1
    assert s3.list_objects_v2(Bucket=BUCKET).get("KeyCount", 0) == 0
