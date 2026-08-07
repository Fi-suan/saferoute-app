"""
Хранение фотографий инцидентов в объектном хранилище.

Почему S3-совместимый API, а не что-то другое
---------------------------------------------
Фото приходит в base64 внутри запроса, проверяется моделью и до этого момента
никуда не сохранялось: колонка photo_url всегда оставалась пустой, хотя оба
экрана клиента её показывают. То есть автор репорта видел своё фото (локальный
файл), а все остальные — ничего.

Рассмотренные варианты:

* Postgres (bytea) — ничего не нужно поднимать, но у Neon на бесплатном тарифе
  0.5 ГБ на всю базу, а раздача картинок через FastAPI на Render free plan
  съедала бы и без того скудный процесс.
* Диск Render — на бесплатном тарифе он эфемерный, файлы исчезают при каждом
  деплое. Не вариант.
* AWS S3 — работает, но исходящий трафик платный и растёт непредсказуемо
  ровно тогда, когда приложением начинают пользоваться.
* Cloudflare R2 — исходящий трафик бесплатный, 10 ГБ хранения бесплатно
  (это порядка 70 тысяч фото по 150 КБ), API совместим с S3.

Выбран R2. Код обращается к нему через обычный S3-клиент, поэтому S3, MinIO и
Backblaze B2 подключаются сменой одного S3_ENDPOINT_URL.

Хранилище опционально: пока переменные окружения не заданы, всё работает ровно
как раньше — фото проверяется моделью и не сохраняется.
"""
import base64
import binascii
import logging
import uuid
from functools import lru_cache

from app.config import settings

logger = logging.getLogger(__name__)

KEY_PREFIX = "incidents"
CONTENT_TYPE = "image/jpeg"


def is_enabled() -> bool:
    return settings.photo_storage_enabled


@lru_cache(maxsize=1)
def _client():
    """Клиент S3. boto3 импортируется лениво — без хранилища он не нужен."""
    import boto3
    from botocore.config import Config as BotoConfig

    return boto3.client(
        "s3",
        endpoint_url=settings.S3_ENDPOINT_URL,
        aws_access_key_id=settings.S3_ACCESS_KEY_ID,
        aws_secret_access_key=settings.S3_SECRET_ACCESS_KEY,
        region_name=settings.S3_REGION,
        config=BotoConfig(
            signature_version="s3v4",
            # Ретраи внутри запроса на создание инцидента затянули бы ответ:
            # фото не настолько важно, чтобы держать пользователя.
            retries={"max_attempts": 2, "mode": "standard"},
            connect_timeout=5,
            read_timeout=10,
        ),
    )


def _key_for(incident_id: int) -> str:
    # Случайное имя, а не предсказуемое: бакет публичный на чтение, и по
    # перебору id не должно получаться выкачать чужие фото.
    return f"{KEY_PREFIX}/{incident_id}/{uuid.uuid4().hex}.jpg"


def upload_incident_photo(incident_id: int, photo_base64: str) -> str | None:
    """
    Кладёт фото в хранилище и возвращает публичный URL.

    Ошибки не пробрасываются: инцидент важнее фотографии, и падение хранилища
    не должно ронять создание метки на карте.
    """
    if not is_enabled():
        return None

    try:
        # validate=True — чтобы мусор не улетал в хранилище молча.
        raw = base64.b64decode(photo_base64, validate=True)
    except (binascii.Error, ValueError):
        logger.warning("Инцидент %s: фото не является корректным base64", incident_id)
        return None

    key = _key_for(incident_id)
    try:
        _client().put_object(
            Bucket=settings.S3_BUCKET,
            Key=key,
            Body=raw,
            ContentType=CONTENT_TYPE,
            # Фото не меняется — пусть кэшируется у клиента надолго.
            CacheControl="public, max-age=31536000, immutable",
        )
    except Exception as e:
        logger.warning("Инцидент %s: не удалось загрузить фото: %s", incident_id, e)
        return None

    return f"{settings.S3_PUBLIC_BASE_URL.rstrip('/')}/{key}"


def delete_incident_photos(incident_ids: list[int]) -> int:
    """
    Удаляет все фото перечисленных инцидентов — для удаления данных по запросу
    пользователя.

    Ключи ищутся по префиксу, а не выводятся из URL: публичный адрес может
    смениться, и тогда старые фото стали бы неудаляемыми.
    """
    if not is_enabled() or not incident_ids:
        return 0

    deleted = 0
    client = _client()
    for incident_id in incident_ids:
        try:
            listing = client.list_objects_v2(
                Bucket=settings.S3_BUCKET,
                Prefix=f"{KEY_PREFIX}/{incident_id}/",
            )
            keys = [{"Key": obj["Key"]} for obj in listing.get("Contents", [])]
            if not keys:
                continue
            client.delete_objects(Bucket=settings.S3_BUCKET, Delete={"Objects": keys})
            deleted += len(keys)
        except Exception as e:
            logger.warning("Не удалось удалить фото инцидента %s: %s", incident_id, e)
    return deleted


def reset_client_cache() -> None:
    """Сброс клиента — нужен тестам, которые подменяют настройки."""
    _client.cache_clear()
