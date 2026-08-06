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


def _has_geozones() -> bool:
    return "geozones" in sa.inspect(op.get_bind()).get_table_names()


def upgrade() -> None:
    # На чистой БД таблиц ещё нет — их создаст create_all уже с этими колонками.
    if not _has_geozones():
        return
    op.add_column("geozones", sa.Column("road_geometry", sa.Text(), nullable=True))
    op.add_column("geozones", sa.Column("slug", sa.String(length=100), nullable=True))
    op.create_index("ix_geozones_slug", "geozones", ["slug"], unique=True)


def downgrade() -> None:
    if not _has_geozones():
        return
    op.drop_index("ix_geozones_slug", table_name="geozones")
    op.drop_column("geozones", "slug")
    op.drop_column("geozones", "road_geometry")
