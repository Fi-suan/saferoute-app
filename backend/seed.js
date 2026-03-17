/**
 * seed.js — Заполнение БД начальными данными (sql.js version)
 * Запуск: node seed.js
 */
const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const DB_FILE = process.env.DB_PATH || path.join(__dirname, 'saferoute.db');

async function main() {
    const SQL = await initSqlJs();
    const db = new SQL.Database();

    // Schema
    const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
    db.run(schema);

    // ── Incidents ──────────────────────────────────────────────────────────
    const incidents = [
        ['animal', 'Жылқы үйірі — трасса кеседі, шамамен 20 бас. Оң жақ жиек, жылдамдықты азайтыңыз!', 5, 51.285, 71.72, 1, 1, 0.97, 'AI: Жылқы үйірі анықталды, ~20 бас. Жол бойында 300м аймақта.', 1],
        ['hazard', 'Үлкен шұңқыр — оң жол жолағы, км 47. Диаметрі ~1.2м, тереңдігі 20см', 4, 51.32, 71.95, 1, 1, 0.91, 'AI: Жол бұзылуы анықталды. Диаметрі ~1м.', 2],
        ['animal', 'Сиыр табыны, 15 бас, жол жиегінде. Ептеп жылжып жатыр.', 4, 51.55, 72.85, 1, 1, 0.89, 'AI: Сиыр табыны анықталды, ~15 бас. Жол жиегінде.', 1],
        ['crash', 'Жеңіл көлік бүйірмен жатыр, жолдың сол жағы. Адам жоқ, полиция шақырылды.', 5, 51.78, 73.52, 1, 1, 0.95, 'AI: ЖКО анықталды. Көлік аударылған.', 0],
        ['animal', 'Түйе — бір бас, жол ортасында тұр! Көрінуі нашар (тұман).', 5, 51.92, 74.67, 1, 1, 0.92, 'AI: Түйе анықталды, жол ортасында. Тұманда көрінуі нашар.', 2],
        ['hazard', 'Мұзды учаске, км 285. Көлік тайғанаданы.', 3, 52.03, 75.18, 1, 0, 0.0, 'AI тексеруде...', 0],
        ['animal', 'Киік тобы (4-5 бас), трассаның оң жағында, жылжып жатыр.', 4, 52.15, 76.05, 1, 1, 0.93, 'AI: Киіктер анықталды, ~5 бас.', 1],
        ['hazard', 'Жерге құлаған электр сымы. ҚАУІПТІ! Жол бойы тосқауыл жоқ.', 5, 52.22, 76.55, 1, 1, 0.88, 'AI: Техногендік қауіп. Електр сымы жерде.', 0],
        ['crash', 'Екі көлік соқтығысы, жол бұғатталған. ДТП 30 мин бұрын.', 4, 51.45, 72.4, 0, 1, 0.90, 'AI: Екі көлік соқтығысы анықталды.', 3],
        ['animal', 'Ешкі отары, ~40 бас, жолдан өтуде. Баяу қозғалыста.', 3, 52.10, 75.80, 1, 1, 0.86, 'AI: Ешкі отары анықталды, ~40 бас.', 1],
    ];

    for (const row of incidents) {
        db.run(
            `INSERT INTO incidents (incident_type, description, severity, latitude, longitude,
                                    is_active, ai_verified, ai_confidence, ai_analysis, confirmations_count)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            row
        );
    }

    // ── Livestock ──────────────────────────────────────────────────────────
    const livestock = [
        ['owner-1', 'Бекзат Омаров', '+7 701 234 5678', 'horse', 23, 'Омаров үйірі', 'TT-2024-A17-001', 51.4201, 72.08, 1, 180, 'a17', 'chip'],
        ['owner-2', 'Ерлан Жақсыбеков', '+7 702 345 6789', 'cow', 31, 'Жақсыбеков табыны', null, 51.784, 73.512, 0, 2400, 'a17', 'phone'],
        ['owner-3', 'Айгүл Нұрланова', '+7 707 456 7890', 'sheep', 87, 'Нұрланова отары', 'TT-2024-A17-003', 52.034, 75.189, 1, 95, 'a17', 'chip'],
        ['owner-1', 'Бекзат Омаров', '+7 701 234 5678', 'camel', 12, 'Омаров түйелері', null, 51.92, 74.67, 0, 3100, 'a17', 'chip'],
        ['owner-4', 'Серік Байменов', '+7 705 567 8901', 'horse', 45, 'Байменов жылқысы', 'TT-2024-A1-001', 49.85, 73.1, 1, 240, 'a1', 'chip'],
        ['owner-5', 'Тасболат Сейтқали', '+7 708 678 9012', 'goat', 130, 'Сейтқали отары', null, 47.2, 72.5, 0, 5000, 'a1', 'manual'],
        ['owner-6', 'Дамир Есенов', '+7 706 789 0123', 'cow', 19, 'Есенов табыны', 'TT-2024-A21-001', 51.98, 77.85, 1, 150, 'a21', 'chip'],
    ];

    for (const row of livestock) {
        db.run(
            `INSERT INTO livestock (owner_id, owner_name, owner_phone, type, count, name, chip_id,
                                    latitude, longitude, is_near_road, distance_to_road_m, route_id, tracking_mode)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            row
        );
    }

    // Save
    const data = db.export();
    fs.writeFileSync(DB_FILE, Buffer.from(data));

    const ic = db.exec('SELECT COUNT(*) FROM incidents')[0]?.values[0][0];
    const lc = db.exec('SELECT COUNT(*) FROM livestock')[0]?.values[0][0];
    console.log(`✅ Seeded: ${ic} incidents, ${lc} livestock → ${DB_FILE}`);
    db.close();
}

main().catch(console.error);
