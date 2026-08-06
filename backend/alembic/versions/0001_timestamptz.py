"""Перевод временных колонок в TIMESTAMPTZ

Модели пишут timezone-aware UTC (utcnow), но колонки объявлялись как
TIMESTAMP WITHOUT TIME ZONE, поэтому Postgres отбрасывал смещение, а обратно
отдавал naive datetime. Из-за этого арифметика со временем падала
(services/geofencing.get_movement_vector), а created_at уезжал клиенту без
таймзоны и трактовался как локальное время.

Существующие значения писались в UTC, поэтому конвертируем через
`USING <col> AT TIME ZONE 'UTC'`.

На SQLite (тесты, локальная разработка) миграция пропускается: таймзон там нет,
а ALTER COLUMN TYPE не поддерживается. Чтение прикрыто models.as_utc().

Revision ID: 0001_timestamptz
Revises:
Create Date: 2026-08-06
"""

import sqlalchemy as sa
from alembic import op

revision = "0001_timestamptz"
down_revision = None
branch_labels = None
depends_on = None


# (таблица, колонка) — все DateTime-поля моделей
COLUMNS = [
    ("herds", "created_at"),
    ("herd_locations", "timestamp"),
    ("geozones", "created_at"),
    ("alerts", "created_at"),
    ("alerts", "resolved_at"),
    ("devices", "last_seen"),
    ("incident_reports", "created_at"),
    ("incident_reports", "resolved_at"),
    ("incident_confirmations", "created_at"),
]


def _alter_to(target_type: str) -> None:
    """
    Переводит колонки в указанный тип.

    Пропускаем не-Postgres и отсутствующие таблицы: на чистой БД миграция
    может отработать раньше, чем lifespan вызовет create_all, и тогда
    таблиц ещё нет — create_all создаст их сразу с правильным типом.
    """
    bind = op.get_bind()
    if bind.dialect.name != "postgresql":
        return
    existing = set(sa.inspect(bind).get_table_names())
    for table, column in COLUMNS:
        if table not in existing:
            continue
        op.execute(
            f"ALTER TABLE {table} ALTER COLUMN {column} "
            f"TYPE {target_type} USING {column} AT TIME ZONE 'UTC'"
        )


def upgrade() -> None:
    _alter_to("TIMESTAMP WITH TIME ZONE")


def downgrade() -> None:
    _alter_to("TIMESTAMP WITHOUT TIME ZONE")
