-- SafeRoute / Sapa Jol — Database Schema
-- SQLite

CREATE TABLE IF NOT EXISTS incidents (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    incident_type   TEXT NOT NULL CHECK(incident_type IN ('animal','crash','hazard')),
    description     TEXT,
    severity        INTEGER NOT NULL DEFAULT 3 CHECK(severity BETWEEN 1 AND 5),
    latitude        REAL NOT NULL,
    longitude       REAL NOT NULL,
    is_active       INTEGER NOT NULL DEFAULT 1,
    ai_verified     INTEGER NOT NULL DEFAULT 0,
    ai_confidence   REAL,
    ai_analysis     TEXT,
    photo_url       TEXT,
    reporter_device_id TEXT,
    confirmations_count INTEGER NOT NULL DEFAULT 0,
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    resolved_at     TEXT
);

CREATE TABLE IF NOT EXISTS confirmations (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    incident_id     INTEGER NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
    device_id       TEXT NOT NULL,
    is_resolved     INTEGER NOT NULL DEFAULT 0,
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(incident_id, device_id)
);

CREATE TABLE IF NOT EXISTS devices (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    device_id       TEXT NOT NULL UNIQUE,
    fcm_token       TEXT,
    phone_number    TEXT,
    latitude        REAL,
    longitude       REAL,
    last_seen       TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS livestock (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    owner_id        TEXT NOT NULL,
    owner_name      TEXT NOT NULL,
    owner_phone     TEXT,
    type            TEXT NOT NULL CHECK(type IN ('horse','cow','camel','sheep','goat')),
    count           INTEGER NOT NULL DEFAULT 1,
    name            TEXT NOT NULL,
    chip_id         TEXT,
    latitude        REAL NOT NULL,
    longitude       REAL NOT NULL,
    is_near_road    INTEGER NOT NULL DEFAULT 0,
    distance_to_road_m INTEGER NOT NULL DEFAULT 9999,
    route_id        TEXT,
    tracking_mode   TEXT NOT NULL DEFAULT 'manual' CHECK(tracking_mode IN ('chip','manual','phone')),
    last_updated    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_incidents_active ON incidents(is_active);
CREATE INDEX IF NOT EXISTS idx_incidents_type ON incidents(incident_type);
CREATE INDEX IF NOT EXISTS idx_livestock_near ON livestock(is_near_road);
