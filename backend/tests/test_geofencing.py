"""
Тесты геометрии геозон.

Главный разбираемый здесь баг: расстояние до дороги считалось до единственной
точки road_lat/road_lon. Для трассы А-1 длиной ~1000 км это значило, что зона
срабатывала лишь в пределах 7.5 км от одной точки — примерно на 1.5% коридора.
"""
import json
import math

import pytest

from app.seed import BBOX_MARGIN_KM, bbox_from_geometry, load_roads, midpoint
from app.services.geofencing import (
    distance_to_polyline_km,
    haversine_km,
)

# Участок трассы А-1: Астана -> Караганда -> Алматы
A1 = [p for r in load_roads() if r["slug"] == "a1-astana-almaty" for p in r["geometry"]]


# ── Расстояние до ломаной ────────────────────────────────────────────────────

def test_point_on_vertex_is_zero():
    assert distance_to_polyline_km(A1[0][0], A1[0][1], A1) == pytest.approx(0.0, abs=0.01)


def test_point_on_segment_between_vertices_is_near_zero():
    """Середина отрезка лежит на дороге — расстояние должно быть около нуля."""
    (alat, alon), (blat, blon) = A1[3], A1[4]
    mid_lat, mid_lon = (alat + blat) / 2, (alon + blon) / 2
    assert distance_to_polyline_km(mid_lat, mid_lon, A1) < 0.5


def test_perpendicular_offset_from_synthetic_line():
    """
    На синтетической линии, идущей строго на восток, смещение строго на север
    перпендикулярно дороге — расстояние должно совпасть со смещением.

    Реальная трасса для такой проверки не годится: А-1 идёт с севера на юг,
    и смещение по широте пошло бы вдоль дороги, а не поперёк.
    """
    line = [[50.0, 70.0], [50.0, 71.0], [50.0, 72.0]]
    offset_km = 10.0
    point_lat = 50.0 + offset_km / 111.0
    got = distance_to_polyline_km(point_lat, 71.0, line)
    assert got == pytest.approx(offset_km, rel=0.02)


def test_distance_along_road_stays_small():
    """Точка, сдвинутая вдоль дороги, остаётся рядом с ней."""
    lat, lon = A1[5]
    along_lat = lat + 10.0 / 111.0  # А-1 здесь идёт почти строго с севера на юг
    assert distance_to_polyline_km(along_lat, lon, A1) < 5.0


def test_single_point_geometry_falls_back_to_haversine():
    """Коридоры без реальной геометрии должны работать как раньше."""
    point = [[52.1, 78.6]]
    assert distance_to_polyline_km(52.2, 78.7, point) == pytest.approx(
        haversine_km(52.2, 78.7, 52.1, 78.6), rel=1e-6
    )


def test_empty_geometry_is_infinite():
    assert distance_to_polyline_km(51.0, 71.0, []) == float("inf")


def test_never_exceeds_distance_to_nearest_vertex():
    """
    Расстояние до линии не может быть больше расстояния до ближайшей вершины:
    вершина сама лежит на линии. Проверка ловит ошибки знака в проекции.
    """
    for lat, lon in [(49.8, 73.1), (45.0, 75.0), (51.0, 71.0), (43.5, 76.8)]:
        nearest_vertex = min(haversine_km(lat, lon, p[0], p[1]) for p in A1)
        assert distance_to_polyline_km(lat, lon, A1) <= nearest_vertex + 1e-6


# ── Регресс: та самая причина, по которой всё чинилось ───────────────────────

def test_herd_on_highway_far_from_midpoint_is_detected():
    """
    Стадо на трассе под Карагандой. До средней точки коридора — почти 200 км,
    поэтому старая логика (расстояние до одной точки) алерт не давала.
    """
    karaganda_on_road = (49.80, 73.10)
    old_point = midpoint(A1)

    old_distance = haversine_km(*karaganda_on_road, *old_point)
    new_distance = distance_to_polyline_km(*karaganda_on_road, A1)

    assert old_distance > 100, "исходные данные теста устарели"
    assert new_distance < 1.0
    # Порог срабатывания зоны — buffer_km * 1.5 = 7.5 км
    assert old_distance > 7.5 and new_distance <= 7.5


# ── Bounding box ─────────────────────────────────────────────────────────────

def test_bbox_covers_all_geometry():
    lat_min, lat_max, lon_min, lon_max = bbox_from_geometry(A1, 25.0)
    for lat, lon in A1:
        assert lat_min <= lat <= lat_max
        assert lon_min <= lon <= lon_max


def test_bbox_margin_accounts_for_longitude_convergence():
    """
    На широте ~47° градус долготы примерно в 1.5 раза короче градуса широты,
    поэтому запас по долготе в градусах должен быть заметно больше.
    """
    lat_min, lat_max, lon_min, lon_max = bbox_from_geometry(A1, 25.0)
    lat_margin = min(p[0] for p in A1) - lat_min
    lon_margin = min(p[1] for p in A1) - lon_min
    assert lon_margin > lat_margin * 1.2


# ── Данные ───────────────────────────────────────────────────────────────────

def test_roads_file_is_wellformed():
    roads = load_roads()
    assert len(roads) >= 4
    slugs = [r["slug"] for r in roads]
    assert len(slugs) == len(set(slugs)), "slug должны быть уникальны"

    for road in roads:
        assert road["geometry"], f"{road['slug']}: пустая геометрия"
        assert road["geometry_source"] in {"waypoints", "midpoint"}
        for lat, lon in road["geometry"]:
            # Казахстан целиком укладывается в эти границы
            assert 40 <= lat <= 56, f"{road['slug']}: широта {lat} вне Казахстана"
            assert 46 <= lon <= 88, f"{road['slug']}: долгота {lon} вне Казахстана"


def test_polyline_segments_have_no_absurd_gaps():
    """Соседние точки осевой линии не должны отстоять на сотни километров."""
    for road in load_roads():
        pts = road["geometry"]
        for a, b in zip(pts, pts[1:], strict=False):
            gap = haversine_km(a[0], a[1], b[0], b[1])
            assert gap < 200, f"{road['slug']}: разрыв {gap:.0f} км между точками"


# ── Сид ──────────────────────────────────────────────────────────────────────

def test_seed_populates_geometry_and_bbox(client):
    """Зоны засеяны через lifespan; у линейных должна быть геометрия."""
    from app.database import SessionLocal
    from app.models import GeoZone

    db = SessionLocal()
    try:
        zones = db.query(GeoZone).filter(GeoZone.is_active.is_(True)).all()
        assert len(zones) >= 4
        by_slug = {z.slug: z for z in zones}
        assert "a1-astana-almaty" in by_slug

        a1 = by_slug["a1-astana-almaty"]
        assert len(a1.geometry_points()) > 1
        assert a1.lat_min < a1.lat_max and a1.lon_min < a1.lon_max
        # bbox должен покрывать всю линию
        for lat, lon in a1.geometry_points():
            assert a1.lat_min <= lat <= a1.lat_max
            assert a1.lon_min <= lon <= a1.lon_max
    finally:
        db.close()


def test_seed_is_idempotent(client):
    """Повторный сид не плодит дубли и не гасит только что созданные зоны."""
    from app.database import SessionLocal
    from app.models import GeoZone
    from app.seed import seed_geozones

    db = SessionLocal()
    try:
        before = db.query(GeoZone).count()
        seed_geozones(db)
        seed_geozones(db)
        after = db.query(GeoZone).count()
        assert after == before
        assert db.query(GeoZone).filter(GeoZone.is_active.is_(True)).count() == before
    finally:
        db.close()


def test_geojson_exposes_road_centerline(client):
    res = client.get("/api/v1/geozones/geojson")
    assert res.status_code == 200
    layers = [f["properties"]["layer"] for f in res.json()["features"]]
    assert "buffer_zone" in layers
    assert "road_centerline" in layers

    line = next(
        f for f in res.json()["features"]
        if f["properties"]["layer"] == "road_centerline"
    )
    assert line["geometry"]["type"] == "LineString"
    lon, lat = line["geometry"]["coordinates"][0]
    # GeoJSON — [lon, lat]; для Казахстана долгота заметно больше широты
    assert 46 <= lon <= 88 and 40 <= lat <= 56


def test_bbox_margin_constant_is_sane():
    assert 5.0 <= BBOX_MARGIN_KM <= 50.0
    assert math.isfinite(BBOX_MARGIN_KM)
    json.dumps(load_roads())  # данные сериализуемы
