"""
Общая обвязка тестов.

Каждый тест получает пустую SQLite-БД во временной папке. Переменные окружения
выставляются до импорта app, потому что app.config читает их на импорте модуля.
"""
import os
import tempfile

import pytest

os.environ.setdefault("JWT_SECRET", "test-secret-long-enough-for-hmac-sha256")
os.environ.setdefault("DEBUG", "true")

_TMPDIR = tempfile.mkdtemp(prefix="saferoute-tests-")
os.environ["DATABASE_URL"] = f"sqlite:///{_TMPDIR}/test.db"

from fastapi.testclient import TestClient  # noqa: E402

from app.database import Base, engine  # noqa: E402
from app.main import app  # noqa: E402
from app.routers import auth as auth_router  # noqa: E402
from app.routers import incidents as incidents_router  # noqa: E402


@pytest.fixture()
def client():
    """
    TestClient с чистой схемой.

    Контекстный менеджер обязателен: без него FastAPI не выполняет lifespan,
    а значит не создаёт таблицы и не засевает геозоны.

    Лимитеры выключены — в тестах все запросы приходят с одного адреса и
    упирались бы в них (регистрация 5/мин, репорты 10/мин).
    """
    Base.metadata.drop_all(bind=engine)
    auth_router.limiter.enabled = False
    incidents_router.limiter.enabled = False
    with TestClient(app) as c:
        yield c
    auth_router.limiter.enabled = True
    incidents_router.limiter.enabled = True


@pytest.fixture()
def register(client):
    """Регистрирует устройство и отдаёт заголовки с токеном."""
    def _register(device_id: str, role: str = "driver") -> dict[str, str]:
        res = client.post(
            "/api/v1/auth/register", json={"device_id": device_id, "role": role}
        )
        assert res.status_code in (200, 201), res.text
        return {"Authorization": f"Bearer {res.json()['token']}"}

    return _register


@pytest.fixture()
def driver(register):
    return register("test-driver", "driver")


@pytest.fixture()
def owner(register):
    return register("test-owner", "owner")
