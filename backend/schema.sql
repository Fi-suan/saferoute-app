-- SafeRoute / Sapa Jol — PostgreSQL Schema
-- Запуск: node migrate.js (автоматически при деплое на Render)

CREATE TABLE IF NOT EXISTS incidents (
    id                  SERIAL PRIMARY KEY,
    incident_type       TEXT NOT NULL CHECK(incident_type IN ('animal','crash','hazard')),
    description         TEXT,
    severity            INTEGER NOT NULL DEFAULT 3 CHECK(severity BETWEEN 1 AND 5),
    latitude            DOUBLE PRECISION NOT NULL,
    longitude           DOUBLE PRECISION NOT NULL,
    is_active           INTEGER NOT NULL DEFAULT 1,
    ai_verified         INTEGER NOT NULL DEFAULT 0,
    ai_confidence       DOUBLE PRECISION,
    ai_analysis         TEXT,
    photo_url           TEXT,
    reporter_device_id  TEXT,
    confirmations_count INTEGER NOT NULL DEFAULT 0,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at         TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS confirmations (
    id          SERIAL PRIMARY KEY,
    incident_id INTEGER NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
    device_id   TEXT NOT NULL,
    is_resolved INTEGER NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(incident_id, device_id)
);

CREATE TABLE IF NOT EXISTS devices (
    id           SERIAL PRIMARY KEY,
    device_id    TEXT NOT NULL UNIQUE,
    fcm_token    TEXT,
    phone_number TEXT,
    latitude     DOUBLE PRECISION,
    longitude    DOUBLE PRECISION,
    last_seen    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS livestock (
    id                  SERIAL PRIMARY KEY,
    owner_id            TEXT NOT NULL,
    owner_name          TEXT NOT NULL,
    owner_phone         TEXT,
    type                TEXT NOT NULL CHECK(type IN ('horse','cow','camel','sheep','goat')),
    count               INTEGER NOT NULL DEFAULT 1,
    name                TEXT NOT NULL,
    chip_id             TEXT,
    latitude            DOUBLE PRECISION NOT NULL,
    longitude           DOUBLE PRECISION NOT NULL,
    is_near_road        INTEGER NOT NULL DEFAULT 0,
    distance_to_road_m  INTEGER NOT NULL DEFAULT 9999,
    route_id            TEXT,
    tracking_mode       TEXT NOT NULL DEFAULT 'manual' CHECK(tracking_mode IN ('chip','manual','phone')),
    last_updated        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_incidents_active ON incidents(is_active);
CREATE INDEX IF NOT EXISTS idx_incidents_type ON incidents(incident_type);
CREATE INDEX IF NOT EXISTS idx_incidents_created ON incidents(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_livestock_near ON livestock(is_near_road);
