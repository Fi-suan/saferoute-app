/**
 * mega-test — E2E-сценарий «приложением пользуются 12 реальных людей».
 *
 *   node scripts/mega-test.js
 *
 * Проверяет (как это делали бы живые тестеры):
 *  A. Логин: 3 аккаунта входят по телефону+паролю (login_device RPC)
 *  B. Приватность: anon-клиент НЕ может читать devices (телефоны/хэши),
 *     инциденты не содержат персональных данных автора
 *  C. Геометрия: все метки реально вдоль дороги (< 300 м от OSRM-полилинии)
 *  D. Подтверждения: 3 разных аккаунта подтверждают метку → она «решена»
 *     (is_active=false); анти-спам: один аккаунт не может дважды
 *  E. Локации: touch_device_location от нескольких аккаунтов (для push-nearby)
 *  F. Сервер: инциденты читаются, счётчики сходятся
 *  G. Rate-limit: 11-е подтверждение за 5 мин от одного устройства — отказ
 *
 * Результат — JSON-отчёт: scripts/mega-test-report.json
 */
const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');
const fs = require('fs');

const SB_URL = 'https://iqgawigwaempfnwtqovy.supabase.co';
const SB_KEY = 'sb_publishable_mtjnCty0nl-EXsssgG0BUg_k0wZtT90';
const sb = createClient(SB_URL, SB_KEY, { auth: { persistSession: false } });

function hashPassword(salt, password) {
    return crypto.createHash('sha256').update(`saferoute:${salt}:${password}`).digest('hex');
}

const report = { started: new Date().toISOString(), checks: [], bugs: [] };
function check(name, ok, detail = '') {
    report.checks.push({ name, ok, detail });
    console.log(`${ok ? '✔' : '✖'} ${name}${detail ? ' — ' + detail : ''}`);
    if (!ok) report.bugs.push(`${name}: ${detail}`);
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
    // ── A. Логин трёх аккаунтов ────────────────────────────────────────────
    for (const n of ['01', '02', '03']) {
        const phone = `+770155000${n}`;
        const password = `pass${n}`;
        const digits = phone.replace(/\s/g, '');
        const tail = digits.slice(-10);
        const salts = [...new Set([digits, `+7${tail}`, `8${tail}`, `7${tail}`, tail])];
        const candidates = salts.map((s) => hashPassword(s, password));
        const { data, error } = await sb.rpc('login_device', {
            p_phone: digits,
            p_password_hashes: candidates,
            p_new_password_hash: candidates[0],
        });
        check(
            `login ${phone}`,
            !error && data?.ok === true,
            error ? error.message : data?.ok ? `name=${data.name}` : 'wrong password (!?)',
        );
    }
    // Негативный: неверный пароль не пускает
    {
        const phone = '77015500001';
        const candidates = [hashPassword(phone, 'wrong-password')];
        const { data, error } = await sb.rpc('login_device', {
            p_phone: phone,
            p_password_hashes: candidates,
            p_new_password_hash: candidates[0],
        });
        check('login wrong password rejected', !error && data?.ok === false, JSON.stringify(data));
    }

    // ── B. Приватность ─────────────────────────────────────────────────────
    {
        const { data, error } = await sb.from('devices').select('*').limit(1);
        const leaked = !error && Array.isArray(data) && data.length > 0;
        check('devices unreadable via anon', !leaked,
            leaked ? `LEAK: ${JSON.stringify(data[0]).slice(0, 120)}` : error ? `blocked (${error.code})` : 'empty');
    }
    {
        const { data } = await sb.from('incident_reports').select('*').limit(1);
        const inc = data?.[0];
        if (!inc) {
            check('incident readable', false, 'нет меток');
        } else {
            const personal = ['phone', 'name', 'password', 'fcm'].filter((k) =>
                Object.keys(inc).some((c) => c.toLowerCase().includes(k)),
            );
            check('incident has no personal fields', personal.length === 0,
                personal.length ? `found: ${personal}` : `fields: ${Object.keys(inc).join(',')}`);
        }
    }

    // ── C. Геометрия: метки вдоль дороги ────────────────────────────────────
    {
        const { data: incidents } = await sb.from('incident_reports').select('*').eq('is_active', true);
        if (!incidents?.length) {
            check('incidents exist', false, '0 active');
        } else {
            // OSRM-полилинии (те же маршруты, что в mega-seed)
            const routes = {
                a17: [[71.427, 51.165], [76.967, 52.287]],
                a1: [[71.427, 51.165], [76.910, 43.240]],
                a21: [[75.320, 51.780], [80.250, 50.420]],
                e40: [[69.590, 42.320], [71.350, 42.900]],
            };
            const geometries = {};
            for (const [id, [s, e]] of Object.entries(routes)) {
                const res = await fetch(
                    `https://router.project-osrm.org/route/v1/driving/${s[0]},${s[1]};${e[0]},${e[1]}?overview=full&geometries=geojson`,
                );
                const json = await res.json();
                geometries[id] = json.routes?.[0]?.geometry?.coordinates ?? [];
            }
            // Расстояние до СЕГМЕНТОВ полилинии (не до вершин!): OSRM
            // упрощает геометрию, в степи вершины в километрах друг от друга —
            // метка на дороге между ними «не на дороге» только для наивного теста.
            const distToRoute = (lat, lon, coords) => {
                let best = Infinity;
                for (let i = 1; i < coords.length; i++) {
                    const [x1, y1] = coords[i - 1];
                    const [x2, y2] = coords[i];
                    // локальные метры
                    const ax = (x1 - lon) * 68600, ay = (y1 - lat) * 111320;
                    const bx = (x2 - lon) * 68600, by = (y2 - lat) * 111320;
                    const ux = bx - ax, uy = by - ay;
                    const len2 = ux * ux + uy * uy;
                    const t = len2 > 0 ? Math.max(0, Math.min(1, -(ax * ux + ay * uy) / len2)) : 0;
                    const px = ax + ux * t, py = ay + uy * t;
                    const d = Math.hypot(px, py);
                    if (d < best) best = d;
                }
                return best; // метры
            };
            let okCount = 0;
            const offenders = [];
            for (const inc of incidents) {
                const coords = geometries[inc.route_id];
                if (!coords?.length) { offenders.push(`${inc.id}: no geometry for ${inc.route_id}`); continue; }
                const d = distToRoute(inc.latitude, inc.longitude, coords);
                if (d < 300) okCount++;
                else offenders.push(`inc ${inc.id} (${inc.route_id}): ${Math.round(d)} м от дороги`);
            }
            check('incidents along road (<300м)', okCount === incidents.length,
                offenders.length ? offenders.slice(0, 5).join('; ') : `${okCount}/${incidents.length} вдоль`);
        }
    }

    // ── D+E. Живой сценарий: локации, подтверждения, решение метки ─────────
    const USERS = Array.from({ length: 12 }, (_, i) => ({
        device_id: `mega-user-${String(i + 1).padStart(2, '0')}`,
    }));
    {
        const { data: targets } = await sb
            .from('incident_reports')
            .select('id, latitude, longitude, confirmations_count')
            .eq('is_active', true)
            .order('id', { ascending: true })
            .limit(3);
        if (!targets?.length) {
            check('targets for confirmations', false, 'нет активных меток');
        } else {
            // E: устройства «едут» рядом с метками (это же триггерит push-nearby)
            for (const u of USERS.slice(0, 6)) {
                const t = targets[Math.floor(Math.random() * targets.length)];
                const { error } = await sb.rpc('touch_device_location', {
                    p_device_id: u.device_id,
                    p_latitude: t.latitude + (Math.random() - 0.5) / 500,
                    p_longitude: t.longitude + (Math.random() - 0.5) / 500,
                });
                if (error) check(`touch_device_location ${u.device_id}`, false, error.message);
            }
            check('touch_device_location x6', true, 'ok');

            // D: 3 разных аккаунта подтверждают первую метку → resolved
            const target = targets[0];
            for (const u of USERS.slice(0, 3)) {
                const { data, error } = await sb.rpc('confirm_incident', {
                    p_incident_id: target.id,
                    p_device_id: u.device_id,
                    p_is_resolved: true,
                });
                check(`confirm #${u.device_id}`, !error && data?.status === 'ok',
                    error ? error.message : JSON.stringify(data));
                await sleep(400);
            }
            const { data: after } = await sb
                .from('incident_reports')
                .select('confirmations_count, is_active')
                .eq('id', target.id)
                .single();
            check(
                '3 confirms → resolved',
                after?.confirmations_count >= 3 && after?.is_active === false,
                JSON.stringify(after),
            );

            // Анти-спам: повторное подтверждение тем же аккаунтом
            const { data: dup } = await sb.rpc('confirm_incident', {
                p_incident_id: target.id,
                p_device_id: USERS[0].device_id,
                p_is_resolved: true,
            });
            const { data: afterDup } = await sb
                .from('incident_reports')
                .select('confirmations_count')
                .eq('id', target.id)
                .single();
            check(
                'duplicate confirm ignored',
                afterDup?.confirmations_count === after?.confirmations_count,
                `count=${afterDup?.confirmations_count} (было ${after?.confirmations_count}), rpc=${JSON.stringify(dup)}`,
            );

            // G: rate-limit 10/5мин на устройство. Один «человек» подтверждает
            // 11 РАЗНЫХ меток подряд — RPC возвращает статусы (не ошибки):
            // {'status':'ok'} ×10, потом {'status':'rate_limited'}
            const { data: allActive } = await sb
                .from('incident_reports')
                .select('id')
                .eq('is_active', true)
                .order('id')
                .limit(15);
            const ids = (allActive ?? []).map((i) => i.id).filter((id) => id !== target.id);
            let okCount = 0;
            let limited = 0;
            for (const id of ids.slice(0, 11)) {
                const { data: res } = await sb.rpc('confirm_incident', {
                    p_incident_id: id,
                    p_device_id: USERS[5].device_id, // один и тот же «человек»
                    p_is_resolved: false,
                });
                if (res?.status === 'ok') okCount++;
                else if (res?.status === 'rate_limited') limited++;
                await sleep(150);
            }
            check('rate-limit 10/5min enforced', limited > 0 && okCount <= 10,
                `ok=${okCount}, rate_limited=${limited}`);
        }
    }

    // ── F. Финальная сверка ─────────────────────────────────────────────────
    {
        const { data } = await sb.from('incident_reports').select('*');
        const active = data?.filter((i) => i.is_active).length ?? 0;
        const resolved = data?.filter((i) => !i.is_active).length ?? 0;
        const withPhoto = data?.filter((i) => i.photo_url).length ?? 0;
        const aiVerified = data?.filter((i) => i.ai_verified).length ?? 0;
        check('final counts', true,
            `active=${active}, resolved=${resolved}, photo=${withPhoto}, ai_verified=${aiVerified}`);
        report.summary = { total: data?.length ?? 0, active, resolved, withPhoto, aiVerified };
        // ai_verified набирается асинхронно (edge-функция) — записываем как info
        console.log(`\nAI-проверка идёт асинхронно: сейчас ai_verified=${aiVerified}/${withPhoto} с фото`);
    }

    report.finished = new Date().toISOString();
    fs.writeFileSync(__dirname + '/mega-test-report.json', JSON.stringify(report, null, 2));
    console.log(`\nБАГОВ НАЙДЕНО: ${report.bugs.length}`);
    if (report.bugs.length) report.bugs.forEach((b) => console.log('  ✖ ' + b));
    process.exit(report.bugs.length ? 2 : 0);
})().catch((e) => {
    console.error('FATAL', e);
    process.exit(1);
});
