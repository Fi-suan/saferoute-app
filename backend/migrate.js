/**
 * migrate.js — Создание таблиц и заполнение начальными данными
 * Запускается автоматически при каждом деплое на Render.
 * Идемпотентен: CREATE TABLE IF NOT EXISTS + ON CONFLICT DO NOTHING
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function migrate() {
    const client = await pool.connect();
    try {
        console.log('[migrate] Running schema...');
        const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
        await client.query(schema);
        console.log('[migrate] Schema OK');

        // ── Seed: только если таблица incidents пуста ──────────────────
        const { rows } = await client.query('SELECT COUNT(*) as c FROM incidents');
        if (parseInt(rows[0].c) > 0) {
            console.log(`[migrate] Already seeded (${rows[0].c} incidents), skipping.`);
            return;
        }

        console.log('[migrate] Seeding initial data...');

        // Incidents на трассе A-17 Астана — Павлодар
        const incidents = [
            ['animal', 'Жылқы үйірі — трасса кеседі, шамамен 20 бас. Жылдамдықты азайтыңыз!', 5, 51.285, 71.72, 1, 1, 0.97, 'AI: Жылқы үйірі анықталды, ~20 бас. Жол бойында 300м аймақта.'],
            ['hazard', 'Үлкен шұңқыр — оң жол жолағы, км 47. Диаметрі ~1.2м, тереңдігі 20см', 4, 51.32, 71.95, 1, 1, 0.91, 'AI: Жол бұзылуы анықталды. Диаметрі ~1м.'],
            ['animal', 'Сиыр табыны, 15 бас, жол жиегінде. Ептеп жылжып жатыр.', 4, 51.55, 72.85, 1, 1, 0.89, 'AI: Сиыр табыны анықталды, ~15 бас. Жол жиегінде.'],
            ['crash', 'Жеңіл көлік бүйірмен жатыр, жолдың сол жағы. Полиция шақырылды.', 5, 51.78, 73.52, 1, 1, 0.95, 'AI: ЖКО анықталды. Көлік аударылған.'],
            ['animal', 'Түйе — бір бас, жол ортасында тұр! Тұман, көрінуі нашар.', 5, 51.92, 74.67, 1, 1, 0.92, 'AI: Түйе анықталды, жол ортасында. Тұманда көрінуі нашар.'],
            ['hazard', 'Мұзды учаске, км 285. Бірнеше көлік тайғанаған.', 3, 52.03, 75.18, 1, 0, 0.0, 'Фото жоқ — қоғамдастық растауын күтуде.'],
            ['animal', 'Киік тобы (4-5 бас), трассаның оң жағында, жылжып жатыр.', 4, 52.15, 76.05, 1, 1, 0.93, 'AI: Киіктер анықталды, ~5 бас.'],
            ['hazard', 'Жерге құлаған электр сымы. ҚАУІПТІ!', 5, 52.22, 76.55, 1, 1, 0.88, 'AI: Техногендік қауіп. Électр сымы жерде.'],
            ['animal', 'Ешкі отары, ~40 бас, жолдан өтуде. Баяу қозғалыста.', 3, 52.10, 75.80, 1, 1, 0.86, 'AI: Ешкі отары анықталды, ~40 бас.'],
        ];

        for (const [type, desc, sev, lat, lon, active, ai_ver, ai_conf, ai_anal] of incidents) {
            await client.query(
                `INSERT INTO incidents (incident_type, description, severity, latitude, longitude,
                                        is_active, ai_verified, ai_confidence, ai_analysis)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
                [type, desc, sev, lat, lon, active, ai_ver, ai_conf, ai_anal]
            );
        }

        // Livestock
        const livestock = [
            ['owner-1', 'Бекзат Омаров', '+7 701 234 5678', 'horse', 23, 'Омаров үйірі', 'TT-2024-A17-001', 51.4201, 72.08, 1, 180, 'a17', 'chip'],
            ['owner-2', 'Ерлан Жақсыбеков', '+7 702 345 6789', 'cow', 31, 'Жақсыбеков табыны', null, 51.784, 73.512, 0, 2400, 'a17', 'phone'],
            ['owner-3', 'Айгүл Нұрланова', '+7 707 456 7890', 'sheep', 87, 'Нұрланова отары', 'TT-2024-A17-003', 52.034, 75.189, 1, 95, 'a17', 'chip'],
            ['owner-4', 'Серік Байменов', '+7 705 567 8901', 'horse', 45, 'Байменов жылқысы', 'TT-2024-A1-001', 49.85, 73.1, 1, 240, 'a1', 'chip'],
            ['owner-5', 'Тасболат Сейтқали', '+7 708 678 9012', 'goat', 130, 'Сейтқали отары', null, 47.2, 72.5, 0, 5000, 'a1', 'manual'],
            ['owner-6', 'Дамир Есенов', '+7 706 789 0123', 'cow', 19, 'Есенов табыны', 'TT-2024-A21-001', 51.98, 77.85, 1, 150, 'a21', 'chip'],
        ];

        for (const [oid, oname, ophone, type, count, name, chip, lat, lon, near, dist, route, mode] of livestock) {
            await client.query(
                `INSERT INTO livestock (owner_id, owner_name, owner_phone, type, count, name, chip_id,
                                        latitude, longitude, is_near_road, distance_to_road_m, route_id, tracking_mode)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
                [oid, oname, ophone, type, count, name, chip, lat, lon, near, dist, route, mode]
            );
        }

        console.log(`[migrate] Seeded: ${incidents.length} incidents, ${livestock.length} livestock ✅`);
    } finally {
        client.release();
        await pool.end();
    }
}

migrate().catch(err => {
    console.error('[migrate] FATAL:', err.message);
    process.exit(1);
});
