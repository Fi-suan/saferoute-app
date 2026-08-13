"""Осевая линия дороги и slug у геозоны

Расстояние до дороги считалось до единственной точки road_lat/road_lon.
Для коридора в сотни километров это давало бессмысленный результат: зона
трассы А-1 срабатывала лишь в пределах ~7.5 км от одной точки, то есть
примерно на 1.5% своей длины.

road_geometry хранит осевую линию как JSON [[lat, lon], ...].
slug — стабильный ключ, по которому сид обновляет существующие зоны;
раньше сид просто выходил, если таблица не пуста, и правки данных
до работающей базы не доезжали.

Revision ID: 0002_geozone_geometry
Revises: 0001_timestamptz
Create Date: 2026-08-06
"""

import sqlalchemy as sa
from alembic import op

revision = "0002_geozone_geometry"
down_revision = "0001_timestamptz"
branch_labels = None
depends_on = None


def _inspector():
    return sa.inspect(op.get_bind())


def _geozone_columns() -> set[str]:
    insp = _inspector()
    if "geozones" not in insp.get_table_names():
        return set()
    return {c["name"] for c in insp.get_columns("geozones")}


def _geozone_indexes() -> set[str]:
    insp = _inspector()
    if "geozones" not in insp.get_table_names():
        return set()
    return {i["name"] for i in insp.get_indexes("geozones")}


def upgrade() -> None:
    # На чистой БД таблиц ещё нет — их создаст create_all уже с этими колонками.
    #
    # Проверяем не только наличие таблицы, но и каждую колонку: приложение
    # вызывает create_all в lifespan, поэтому база вполне может уже иметь новую
    # схему, а alembic_version при этом отставать (так бывает, если БД подняли
    # запуском приложения, а миграции прогнали позже). Без этой проверки
    # add_column падал бы с DuplicateColumn, и `alembic upgrade head && uvicorn`
    # не пускал бы сервис вообще.
    columns = _geozone_columns()
    if not columns:
        return
    if "road_geometry" not in columns:
        op.add_column("geozones", sa.Column("road_geometry", sa.Text(), nullable=True))
    if "slug" not in columns:
        op.add_column("geozones", sa.Column("slug", sa.String(length=100), nullable=True))
    if "ix_geozones_slug" not in _geozone_indexes():
        op.create_index("ix_geozones_slug", "geozones", ["slug"], unique=True)


def downgrade() -> None:
    columns = _geozone_columns()
    if not columns:
        return
    if "ix_geozones_slug" in _geozone_indexes():
        op.drop_index("ix_geozones_slug", table_name="geozones")
    if "slug" in columns:
        op.drop_column("geozones", "slug")
    if "road_geometry" in columns:
        op.drop_column("geozones", "road_geometry")
