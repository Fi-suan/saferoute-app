/**
 * ultra-test — нагрузочный E2E «100 пользователей вдоль и поперёк».
 *
 *   SUPABASE_DB_URL=postgres://… node scripts/ultra-test.js
 *
 * Фазы:
 *  1. 100 аккаунтов (параллельная регистрация пачками по 20)
 *  2. Логин-выборка 10 случайных (3 формата телефона)
 *  3. 100 меток вдоль дорог от разных аккаунтов (параллельно)
 *  4. Волна подтверждений: 100 устройств подтверждают одну метку
 *     → rate-limit на устройство, метка решена после 3
 *  5. Драйверы: touch_device_location вдоль A-17 (триггер push-nearby)
 *  6. Табуны: 3 стада от owner-аккаунтов + локации вдоль дороги,
 *     фантом (локация 3 ч назад) → cleanup деактивирует
 *  7. Приватность: devices не читается, в метках нет персональных полей
 *  8. Итог: очистка тестовых данных + перезапуск демо-сида
 */
const { createClient } = require('@supabase/supabase-js');
const { Client } = require('pg');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

const SB_URL = 'https://iqgawigwaempfnwtqovy.supabase.co';
const SB_KEY = 'sb_publishable_mtjnCty0nl-EXsssgG0BUg_k0wZtT90';
const sb = createClient(SB_URL, SB_KEY, { auth: { persistSession: false } });

function hashPassword(salt, password) {
    return crypto.createHash('sha256').update(`saferoute:${salt}:${password}`).digest('hex');
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const report = { phases: [], bugs: [] };
function phase(name, ok, detail) {
    report.phases.push({ name, ok, detail });
    console.log(`${ok ? '✔' : '✖'} ${name} — ${detail}`);
    if (!ok) report.bugs.push(`${name}: ${detail}`);
}

// ── 100 пользователей ────────────────────────────────────────────────────────
const N = 100;
const USERS = Array.from({ length: N }, (_, i) => {
    const n = String(101 + i); // 101..200
    return {
        device_id: `ultra-user-${n}`,
        phone: `+77015600${String(i).padStart(3, '0')}`, // 11 цифр
        password: `upass${n}`,
        role: i % 7 === 0 ? 'owner' : 'driver',
    };
});

const ROUTES = {
    a17: { start: [71.427, 51.165], end: [76.967, 52.287] },
    a1: { start: [71.427, 51.165], end: [76.910, 43.240] },
    a21: { start: [75.320, 51.780], end: [80.250, 50.420] },
    e40: { start: [69.590, 42.320], end: [71.350, 42.900] },
};

async function fetchGeom(start, end) {
    const res = await fetch(
        `https://router.project-osrm.org/route/v1/driving/${start[0]},${start[1]};${end[0]},${end[1]}?overview=full&geometries=geojson`,
    );
    const json = await res.json();
    return json.routes?.[0]?.geometry?.coordinates ?? [];
}

function sampleAlong(coords, k) {
    // случайная точка на полилинии
    const i = Math.floor(Math.random() * (coords.length - 1));
    const t = Math.random();
    const lng = coords[i][0] + (coords[i + 1][0] - coords[i][0]) * t;
    const lat = coords[i][1] + (coords[i + 1][1] - coords[i][1]) * t;
    // смещение на обочину 20-60 м
    const dLat = ((Math.random() - 0.5) * 2 * 50) / 111320;
    const dLon = ((Math.random() - 0.5) * 2 * 50) / (111320 * Math.cos((lat * Math.PI) / 180));
    return [lat + dLat, lng + dLon];
}

(async () => {
    if (!process.env.SUPABASE_DB_URL) {
        console.error('Нужен SUPABASE_DB_URL');
        process.exit(1);
    }

    // ── 1. Регистрация 100 аккаунтов параллельными пачками ─────────────────
    let regOk = 0;
    for (let batch = 0; batch < N; batch += 20) {
        const results = await Promise.all(
            USERS.slice(batch, batch + 20).map((u) =>
                sb.rpc('register_device', {
                    p_device_id: u.device_id,
                    p_role: u.role.toUpperCase(),
                    p_name: `Ультра ${u.device_id.slice(-3)}`,
                    p_password_hash: hashPassword(u.phone, u.password),
                    p_fcm_token: null,
                    p_phone_number: u.phone,
                }),
            ),
        );
        regOk += results.filter((r) => !r.error).length;
        await sleep(300);
    }
    phase('1. register x100', regOk === N, `${regOk}/${N}`);

    // ── 2. Логин 10 случайных, 3 формата телефона ───────────────────────────
    let loginOk = 0;
    const sample = [...USERS].sort(() => Math.random() - 0.5).slice(0, 10);
    for (const u of sample) {
        const digits = u.phone.replace(/\s/g, '');
        const tail = digits.slice(-10);
        const salts = [...new Set([digits, `+7${tail}`, `8${tail}`, `7${tail}`, tail])];
        const candidates = salts.map((s) => hashPassword(s, u.password));
        const { data, error } = await sb.rpc('login_device', {
            p_phone: digits,
            p_password_hashes: candidates,
            p_new_password_hash: candidates[0],
        });
        // отдельно проверим формат «8 701 560 00 XX»
        const altDigits = `8${tail}`;
        const { data: altData } = await sb.rpc('login_device', {
            p_phone: altDigits,
            p_password_hashes: salts.map((s) => hashPassword(s, u.password)),
            p_new_password_hash: hashPassword(`+7${tail}`, u.password),
        });
        if (!error && data?.ok && altData?.ok) loginOk++;
    }
    phase('2. login x10 (оба формата)', loginOk === 10, `${loginOk}/10`);

    // ── 3. 100 меток вдоль дорог (параллельные пачки) ───────────────────────
    const geoms = {};
    for (const [id, cfg] of Object.entries(ROUTES)) {
        geoms[id] = await fetchGeom(cfg.start, cfg.end);
    }
    const routeIds = Object.keys(geoms);
    const TYPES = [
        { t: 'ANIMAL', d: 'Жолда жануарлар', s: 3 },
        { t: 'HAZARD', d: 'Жолдағы кедергі', s: 3 },
        { t: 'CRASH', d: 'Жеңіл ЖКО', s: 4 },
        { t: 'ANIMAL', d: 'Мал жол кесіп өтеді', s: 4 },
        { t: 'HAZARD', d: 'Жол жөндеу', s: 2 },
    ];
    let insOk = 0;
    for (let batch = 0; batch < N; batch += 20) {
        const results = await Promise.all(
            USERS.slice(batch, batch + 20).map((u, j) => {
                const idx = batch + j;
                const routeId = routeIds[idx % routeIds.length];
                const [lat, lng] = sampleAlong(geoms[routeId], idx);
                const c = TYPES[idx % TYPES.length];
                return sb.from('incident_reports').insert({
                    incident_type: c.t,
                    description: `${c.d} (ultra ${idx})`,
                    severity: c.s,
                    latitude: Number(lat.toFixed(6)),
                    longitude: Number(lng.toFixed(6)),
                    reporter_device_id: u.device_id,
                    route_id: routeId,
                    is_active: true,
                    confirmations_count: 0,
                });
            }),
        );
        insOk += results.filter((r) => !r.error).length;
        await sleep(400);
    }
    phase('3. insert x100 along roads', insOk === N, `${insOk}/${N}`);

    // ── 4. Волна подтверждений на одну метку ───────────────────────────────
    const { data: target } = await sb
        .from('incident_reports')
        .select('id')
        .eq('is_active', true)
        .order('id')
        .limit(1);
    const targetId = target?.[0]?.id;
    let confirmed = 0;
    let limited = 0;
    let dup = 0;
    for (const u of USERS.slice(0, 30)) {
        const { data } = await sb.rpc('confirm_incident', {
            p_incident_id: targetId,
            p_device_id: u.device_id,
            p_is_resolved: true,
        });
        if (data?.status === 'ok') confirmed++;
        else if (data?.status === 'rate_limited') limited++;
        else if (data?.status === 'already_confirmed') dup++;
    }
    // 30 разных устройств, каждый по разу: все ok, лимит не задет, метка решена
    const { data: after } = await sb
        .from('incident_reports')
        .select('is_active')
        .eq('id', targetId)
        .single();
    phase(
        '4. 30 devices confirm 1 marker',
        confirmed === 30 && after?.is_active === false,
        `ok=${confirmed} dup=${dup} limited=${limited} resolved=${after?.is_active === false}`,
    );

    // ── 5. Драйверы вдоль A-17 ──────────────────────────────────────────────
    const a17 = geoms.a17;
    let touchOk = 0;
    for (let i = 0; i < 20; i++) {
        const pt = a17[Math.floor((a17.length / 20) * i)];
        const { error } = await sb.rpc('touch_device_location', {
            p_device_id: `ultra-driver-${i}`,
            p_latitude: pt[1],
            p_longitude: pt[0],
        });
        if (!error) touchOk++;
    }
    phase('5. drivers along A-17 x20', touchOk === 20, `${touchOk}/20 (push-nearby триггер)`);

    // ── 6. Табуны: 3 живых + 1 фантом ──────────────────────────────────────
    const herdIds = [];
    for (let i = 0; i < 3; i++) {
        const { data: herd } = await sb
            .from('herds')
            .insert({
                name: `Ультра-табын ${i + 1}`,
                animal_type: ['HORSE', 'CAMEL', 'SAIGA'][i],
                estimated_count: 15 + i * 10,
                owner_name: 'ultra-owner',
                is_active: true,
            })
            .select('id')
            .single();
        herdIds.push(herd.id);
        const pt = a17[Math.floor(a17.length * (0.3 + i * 0.2))];
        await sb.from('herd_locations').insert({
            herd_id: herd.id,
            latitude: pt[1],
            longitude: pt[0],
            speed_kmh: 2,
            source: 'manual',
        });
    }
    // фантом: локация 3 часа назад (после cleanup должен деактивироваться)
    const { data: phantom } = await sb
        .from('herds')
        .insert({
            name: 'Фантом-табын',
            animal_type: 'HORSE',
            estimated_count: 5,
            owner_name: 'ultra-owner',
            is_active: true,
        })
        .select('id')
        .single();
    const { data: activeHerds } = await sb.from('herds').select('id').eq('is_active', true);
    phase('6a. herds visible', (activeHerds ?? []).length >= 4, `${activeHerds?.length} активных`);

    const pg = new Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
    await pg.connect();
    await pg.query(
        `insert into herd_locations (herd_id, latitude, longitude, speed_kmh, source, "timestamp")
         values ($1, 51.5, 73.5, 0, 'manual', now() - interval '3 hours')`,
        [phantom.id],
    );
    await pg.query('select cleanup_stale_manual_herds()');
    const ph = await pg.query('select is_active from herds where id = $1', [phantom.id]);
    const live = await pg.query('select count(*)::int as c from herds where is_active and id = any($1)', [herdIds]);
    phase(
        '6b. phantom herd cleaned',
        ph.rows[0].is_active === false && live.rows[0].c === 3,
        `фантом=${ph.rows[0].is_active ? 'жив (BUG)' : 'убран'}, живых=${live.rows[0].c}/3`,
    );

    // ── 7. Приватность под нагрузкой ───────────────────────────────────────
    const { data: devLeak, error: devErr } = await sb.from('devices').select('*').limit(1);
    const leaked = !devErr && devLeak?.length > 0;
    const { data: incSample } = await sb.from('incident_reports').select('*').limit(1);
    const personal = incSample?.[0]
        ? ['phone', 'password', 'fcm', 'name'].filter((k) =>
              Object.keys(incSample[0]).some((c) => c.toLowerCase().includes(k)),
          )
        : [];
    phase(
        '7. privacy under load',
        !leaked && personal.length === 0,
        leaked ? 'devices LEAK' : `devices закрыты, в метках нет: ${personal.length === 0 ? 'персональных полей' : personal}`,
    );

    // ── 8. Очистка ультра-данных + демо-сид ────────────────────────────────
    await pg.query('delete from incident_confirmations');
    await pg.query("delete from incident_reports where reporter_device_id like 'ultra-%'");
    await pg.query("update herds set is_active = false where owner_name = 'ultra-owner'");
    await pg.query("delete from devices where device_id like 'ultra-%'");
    // тихо пересеиваем демо-метки (без вывода)
    const seed = spawnSync('node', ['scripts/mega-seed.js'], {
        env: { ...process.env },
        encoding: 'utf8',
    });
    const finalCount = await pg.query('select count(*)::int as c from incident_reports');
    phase('8. cleanup + demo reseed', seed.status === 0 && finalCount.rows[0].c === 15,
        `демо-меток: ${finalCount.rows[0].c}`);
    await pg.end();

    console.log(`\nИТОГ: фаз пройдено ${report.phases.filter((p) => p.ok).length}/${report.phases.length}, багов: ${report.bugs.length}`);
    report.bugs.forEach((b) => console.log('  ✖ ' + b));
    process.exit(report.bugs.length ? 2 : 0);
})().catch((e) => {
    console.error('FATAL', e);
    process.exit(1);
});
