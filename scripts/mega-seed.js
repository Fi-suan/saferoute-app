/**
 * mega-seed — полная замена демо-данных «как будто 12 реальных пользователей».
 *
 *   node scripts/mega-seed.js [--wipe-only]
 *
 * Что делает:
 * 1. УДАЛЯЕТ все инциденты (по просьбе владельца — старые стояли «не вдоль дороги»)
 * 2. Создаёт 12 аккаунтов через register_device RPC (телефон + пароль-хэш)
 * 3. Тянет реальную геометрию дорог из OSRM (route polyline)
 * 4. Ставит 15 меток ВДОЛЬ ДОРОГИ: точка на полилинии + смещение на обочину
 *    25–70 м перпендикулярно — как снимал бы человек с дороги
 * 5. Фото — из существующего Storage-пула (AI-триггер verify-photo перезапустится)
 * 6. Репортёры — случайные из 12 аккаунтов (метки «от разных людей»)
 */
const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');
const { Client } = require('pg');

const SB_URL = 'https://iqgawigwaempfnwtqovy.supabase.co';
const SB_KEY = 'sb_publishable_mtjnCty0nl-EXsssgG0BUg_k0wZtT90';
const sb = createClient(SB_URL, SB_KEY, { auth: { persistSession: false } });
const PG_URL = process.env.SUPABASE_DB_URL; // postgres://… (не коммитим пароль)

// ── Аккаунты «реальных пользователей» ──────────────────────────────────────
// Пароли простые и известны только нам (тестовые): pass01..pass12
const USERS = Array.from({ length: 12 }, (_, i) => {
    const n = String(i + 1).padStart(2, '0');
    return {
        device_id: `mega-user-${n}`,
        phone: `+770155000${n}`, // +77015500001..+77015500012 (11 цифр, как реальные KZ)
        password: `pass${n}`,
        name: `Тестер ${n}`,
        role: i % 4 === 3 ? 'owner' : 'driver',
    };
});

// Формат хэша — как в src/services/api.ts (expo-crypto):
// SHA256(`saferoute:${phone}:${password}`)
function hashPassword(salt, password) {
    return crypto.createHash('sha256').update(`saferoute:${salt}:${password}`).digest('hex');
}

// ── Маршруты: OSRM-геометрия ────────────────────────────────────────────────
const ROUTES = {
    a17: { start: [71.427, 51.165], end: [76.967, 52.287], count: 6 },  // Астана → Павлодар
    a1:  { start: [71.427, 51.165], end: [76.910, 43.240], count: 3 },  // Астана → Алматы
    a21: { start: [75.320, 51.780], end: [80.250, 50.420], count: 3 },  // Екібастұз → Семей
    e40: { start: [69.590, 42.320], end: [71.350, 42.900], count: 3 },  // Шымкент → Тараз
};


async function fetchRouteGeometry(start, end) {
    const url = `https://router.project-osrm.org/route/v1/driving/${start[0]},${start[1]};${end[0]},${end[1]}?overview=full&geometries=geojson`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`OSRM ${res.status}`);
    const json = await res.json();
    if (json.code !== 'Ok' || !json.routes?.[0]) throw new Error(`OSRM code=${json.code}`);
    return json.routes[0].geometry.coordinates; // [[lng, lat], ...]
}

/** Точки, равномерно распределённые по длине полилинии */
function pointsAlong(coords, count) {
    const segs = [];
    let total = 0;
    for (let i = 1; i < coords.length; i++) {
        const d = Math.hypot(coords[i][0] - coords[i - 1][0], coords[i][1] - coords[i - 1][1]);
        segs.push(d);
        total += d;
    }
    const out = [];
    for (let k = 0; k < count; k++) {
        let target = (total * (k + 0.5)) / count;
        let idx = 0;
        let acc = 0;
        for (let i = 0; i < segs.length; i++) {
            if (acc + segs[i] >= target) { idx = i; break; }
            acc += segs[i];
        }
        const t = segs[idx] > 0 ? (target - acc) / segs[idx] : 0;
        const lng = coords[idx][0] + (coords[idx + 1][0] - coords[idx][0]) * t;
        const lat = coords[idx][1] + (coords[idx + 1][1] - coords[idx][1]) * t;
        out.push([lng, lat, coords[idx], coords[idx + 1]]);
    }
    return out;
}

/** Смещение перпендикулярно дороге (метры) — «обочина» */
function offsetMeters(lat, lng, segA, segB, meters) {
    const rad = Math.PI / 180;
    const dx = (segB[0] - segA[0]) * Math.cos(lat * rad); // грубая поправка на широту
    const dy = segB[1] - segA[1];
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len; // перпендикуляр
    const ny = dx / len;
    const side = Math.random() < 0.5 ? 1 : -1;
    const dLat = (ny * meters * side) / 111_320;
    const dLng = (nx * meters * side) / (111_320 * Math.cos(lat * rad));
    return [lat + dLat, lng + dLng];
}

// ── Пары «фото ↔ содержание» ────────────────────────────────────────────────
// Каждый фото inc-NN.jpg из Storage-пула ранее ПРОШЁЛ AI-проверку именно с
// этим типом и описанием (Pixtral сверяет фото с описанием: неправильная
// пара = честный reject — проверено мега-тестом). Не перемешивать!
const PAIRS = [
    { p: 33, t: 'HAZARD', d: 'Жол жөндеу жұмыстары, күтушылар бар',            s: 3 },
    { p: 34, t: 'ANIMAL', d: 'Жолда жылқылар, шамамен 10 бас',                s: 4 },
    { p: 35, t: 'HAZARD', d: 'Жолдағы мұз, сақтық тансыңыз',                  s: 4 },
    { p: 36, t: 'CRASH',  d: 'Жеңіл ЖКО, оң жолақ бұғалды',                   s: 4 },
    { p: 37, t: 'ANIMAL', d: 'Қой отары жол кесіп өтеді',                     s: 3 },
    { p: 38, t: 'ANIMAL', d: 'Киіктер жақындайды',                            s: 5 },
    { p: 39, t: 'HAZARD', d: 'Жолда шұңқыр',                                   s: 3 },
    { p: 40, t: 'ANIMAL', d: 'Түйелер жолда',                                  s: 3 },
    { p: 41, t: 'CRASH',  d: 'Жол шетіндегі аялдамада ЖКО',                    s: 4 },
    { p: 42, t: 'ANIMAL', d: 'Сиыр табыны жол бойында',                        s: 3 },
    { p: 43, t: 'HAZARD', d: 'Тас тасымалы, жол тар',                          s: 3 },
    { p: 44, t: 'ANIMAL', d: 'Жолда жылқылар, айнала абай болыңыз',            s: 3 },
    { p: 45, t: 'HAZARD', d: 'Жол жөндеу, қысқартылған жолақ',                 s: 2 },
    { p: 46, t: 'ANIMAL', d: 'Қой отары, кешкі уақыт',                         s: 3 },
    { p: 47, t: 'CRASH',  d: 'Жеңіл ЖКО, жол бос',                             s: 3 },
];

(async () => {
    // 1. Снос ВСЕХ инцидентов. ВАЖНО: через postgres, а не через anon-клиент:
    //    RLS silently режет anon DELETE до пустого no-op'а (нашёл мега-тестом).
    if (!PG_URL) {
        console.error('Нужен SUPABASE_DB_URL (postgres://postgres:…@db…:5432/postgres)');
        process.exit(1);
    }
    const pg = new Client({ connectionString: PG_URL, ssl: { rejectUnauthorized: false } });
    await pg.connect();
    const r1 = await pg.query('delete from incident_confirmations');
    const r2 = await pg.query('delete from incident_reports');
    await pg.end();
    console.log(`Все инциденты удалены (confirmations: ${r1.rowCount}, incidents: ${r2.rowCount}).`);
    if (process.argv.includes('--wipe-only')) return;

    // 2. Аккаунты (идемпотентно: register_device не затирает null-поля)
    for (const u of USERS) {
        const { error } = await sb.rpc('register_device', {
            p_device_id: u.device_id,
            p_role: u.role.toUpperCase(),
            p_name: u.name,
            p_password_hash: hashPassword(u.phone, u.password),
            p_fcm_token: null,
            p_phone_number: u.phone,
        });
        console.log(`  account ${u.device_id} (${u.role}): ${error ? 'ERR ' + error.message : 'ok'}`);
    }

    // 3-5. Метки вдоль дорог (пары фото↔описание идут по кругу без перемешивания)
    let pairIdx = 0;
    let created = 0;
    let total = 0;
    for (const [routeId, cfg] of Object.entries(ROUTES)) {
        let coords;
        try {
            coords = await fetchRouteGeometry(cfg.start, cfg.end);
            console.log(`  route ${routeId}: OSRM geometry ${coords.length} pts`);
        } catch (e) {
            console.error(`  route ${routeId}: OSRM FAILED (${e.message}) — пропускаем`);
            continue;
        }
        const pts = pointsAlong(coords, cfg.count);
        for (const [lng, lat, segA, segB] of pts) {
            const [oLat, oLng] = offsetMeters(lat, lng, segA, segB, 25 + Math.random() * 45);
            const inc = PAIRS[pairIdx % PAIRS.length];
            pairIdx++;
            const user = USERS[total % USERS.length];
            const photoUrl = `${SB_URL}/storage/v1/object/public/incident-photos/demo/inc-${inc.p}.jpg`;
            const { error } = await sb.from('incident_reports').insert({
                incident_type: inc.t,
                description: inc.d,
                severity: inc.s,
                latitude: Number(oLat.toFixed(6)),
                longitude: Number(oLng.toFixed(6)),
                reporter_device_id: user.device_id,
                route_id: routeId,
                photo_url: photoUrl,
                ai_verified: false,
                ai_analysis: 'AI метканы тексеруде...',
                is_active: true,
                confirmations_count: 0,
            });
            total++;
            if (!error) created++;
            else console.error(`  insert failed: ${error.message}`);
        }
    }
    console.log(`Создано меток вдоль дорог: ${created}/${total}`);
    console.log('Аккаунтов:', USERS.length, '| телефоны:', USERS[0].phone, '..', USERS[11].phone);
})();
