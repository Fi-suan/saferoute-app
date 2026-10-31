/**
 * qa-probe — read-only QA-проверка фактического состояния БД после mega-seed.
 * НЕ удаляет, НЕ сеет. Разрешённые RPC: login_device (тест форматов), touch_device_location.
 */
const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

const SB_URL = 'https://iqgawigwaempfnwtqovy.supabase.co';
const SB_KEY = 'sb_publishable_mtjnCty0nl-EXsssgG0BUg_k0wZtT90';
const sb = createClient(SB_URL, SB_KEY, { auth: { persistSession: false } });

const hashPassword = (salt, password) =>
    crypto.createHash('sha256').update(`saferoute:${salt}:${password}`).digest('hex');

function haversineM(lat1, lon1, lat2, lon2) {
    const R = 6371000;
    const r = Math.PI / 180;
    const a = Math.sin((lat2 - lat1) * r / 2) ** 2 +
        Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin((lon2 - lon1) * r / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

(async () => {
    // ── 1. Все инциденты ──────────────────────────────────────────────────
    const { data: incidents, error } = await sb.from('incident_reports').select('*').order('id');
    if (error) throw new Error('fetch failed: ' + error.message);
    console.log(`\n=== 1. ИНЦИДЕНТЫ: ${incidents.length} шт. ===`);
    console.log('Колонки таблицы:', Object.keys(incidents[0] || {}).join(', '));
    for (const i of incidents) {
        const ageMin = i.created_at ? Math.round((Date.now() - new Date(i.created_at + (/[zZ]/.test(i.created_at) ? '' : 'Z')).getTime()) / 60000) : '?';
        console.log(
            `#${i.id} ${String(i.route_id).padEnd(4)} ${String(i.incident_type).padEnd(6)} sev=${i.severity} ` +
            `active=${i.is_active ? 1 : 0} conf=${i.confirmations_count} ai_verified=${i.ai_verified ? 1 : 0} ` +
            `ai_rej=${i.ai_rejected === null || i.ai_rejected === undefined ? '-' : (i.ai_rejected ? 1 : 0)} ` +
            `sugg=${i.ai_severity_suggestion ?? '-'} conf_ai=${i.ai_confidence ?? '-'} age=${ageMin}м ` +
            `(${i.latitude.toFixed(5)},${i.longitude.toFixed(5)})\n     analysis: ${String(i.ai_analysis).slice(0, 110)}`
        );
    }

    // ── 2. Road status по логике computeRoadStatus (src/hooks/useRoute.ts) ──
    console.log(`\n=== 2. ROAD STATUS (реплика computeRoadStatus) ===`);
    const byRoute = {};
    for (const i of incidents) (byRoute[i.route_id] ??= []).push(i);
    for (const [rid, list] of Object.entries(byRoute)) {
        const active = list.filter(i => i.is_active);
        const closed = active.some(i => i.severity >= 5 && i.incident_type === 'HAZARD');
        const dangerous = active.filter(i => i.severity >= 4);
        const caution = dangerous.length >= 2 || active.some(i => i.incident_type === 'CRASH' && i.severity >= 4);
        const status = closed ? 'closed (Жабық)' : caution ? 'caution (Сақтық!)' : 'open (Жол таза)';
        console.log(`  ${rid}: ${status}  [active=${active.length}/${list.length}, sev>=4: ${dangerous.map(d => d.id + ':' + d.severity + ':' + d.incident_type).join(', ')}]`);
        const sev5 = active.filter(i => i.severity >= 5);
        if (sev5.length) console.log(`    ⚠ sev>=5 активные: ${sev5.map(s => s.id + ':' + s.incident_type + ':' + s.severity).join(', ')} — НЕ дают 'closed' если тип не HAZARD`);
    }

    // ── 3. AI-вердикты ────────────────────────────────────────────────────
    console.log(`\n=== 3. AI-ПРОВЕРКА ===`);
    const withPhoto = incidents.filter(i => i.photo_url);
    const pending = incidents.filter(i => /тексеруде/.test(String(i.ai_analysis)));
    const verified = incidents.filter(i => i.ai_verified);
    const rejected = incidents.filter(i => i.ai_rejected === true);
    const noPhoto = incidents.filter(i => !i.photo_url);
    console.log(`  фото=${withPhoto.length}/${incidents.length}, ai_verified=${verified.length}, «тексеруде» (застряли)=${pending.length}, ai_rejected=${rejected.length}, без фото=${noPhoto.length}`);
    console.log(`  застрявшие id: ${pending.map(p => p.id).join(', ') || '—'}`);
    console.log(`  rejected: ${rejected.map(r => `#${r.id} active=${r.is_active} sev=${r.severity}`).join(', ') || '—'}`);
    const lowConf = incidents.filter(i => i.ai_verified && i.ai_confidence !== null && i.ai_confidence < 0.5);
    if (lowConf.length) console.log(`  ⚠ низкая уверенность: ${lowConf.map(l => `#${l.id} conf=${l.ai_confidence}`).join(', ')}`);
    // sugg vs severity расхождения
    const suggDiff = incidents.filter(i => i.ai_severity_suggestion !== null && Math.abs((i.ai_severity_suggestion ?? 0) - i.severity) >= 2);
    if (suggDiff.length) console.log(`  ⚠ sugg отличается от severity на >=2: ${suggDiff.map(s => `#${s.id} sev=${s.severity} sugg=${s.ai_severity_suggestion}`).join(', ')}`);

    // ── 4. Расстояния между метками (id-порядок = порядок вдоль дороги из seed) ──
    console.log(`\n=== 4. ГЕОМЕТРИЯ МЕТОК ===`);
    for (const [rid, list] of Object.entries(byRoute)) {
        list.sort((a, b) => a.id - b.id);
        const dists = [];
        for (let i = 1; i < list.length; i++)
            dists.push(Math.round(haversineM(list[i - 1].latitude, list[i - 1].longitude, list[i].latitude, list[i].longitude)));
        console.log(`  ${rid}: соседние метки (км): ${dists.map(d => (d / 1000).toFixed(1)).join(' | ')}`);
        let min = Infinity, pair = '';
        for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
            const d = haversineM(list[i].latitude, list[i].longitude, list[j].latitude, list[j].longitude);
            if (d < min) { min = d; pair = `#${list[i].id}-#${list[j].id}`; }
        }
        console.log(`     мин. пара: ${pair} = ${(min / 1000).toFixed(2)} км`);
    }

    // ── 5. OSRM A-17: смещение меток от дороги + симуляция «езды» ─────────
    console.log(`\n=== 5. ПРОКСИМИТИ A-17 (OSRM) ===`);
    const res = await fetch('https://router.project-osrm.org/route/v1/driving/71.427,51.165;76.967,52.287?overview=full&geometries=geojson');
    const json = await res.json();
    const coords = json.routes?.[0]?.geometry?.coordinates ?? [];
    console.log(`  OSRM polyline: ${coords.length} точек`);
    const distToRoute = (lat, lon) => {
        let best = Infinity;
        for (let i = 1; i < coords.length; i++) {
            const [x1, y1] = coords[i - 1], [x2, y2] = coords[i];
            const ax = (x1 - lon) * 68600, ay = (y1 - lat) * 111320;
            const bx = (x2 - lon) * 68600, by = (y2 - lat) * 111320;
            const ux = bx - ax, uy = by - ay, len2 = ux * ux + uy * uy;
            const t = len2 > 0 ? Math.max(0, Math.min(1, -(ax * ux + ay * uy) / len2)) : 0;
            best = Math.min(best, Math.hypot(ax + ux * t, ay + uy * t));
        }
        return best;
    };
    const a17 = byRoute.a17 ?? [];
    for (const inc of a17) {
        console.log(`  метка #${inc.id}: ${Math.round(distToRoute(inc.latitude, inc.longitude))} м от оси (обочина)`);
    }
    // Точки «езды»: вершины полилинии через каждые ~10 км
    const drivePts = [];
    let acc = 0;
    const step = 10000;
    for (let i = 1; i < coords.length; i++) {
        const [x1, y1] = coords[i - 1], [x2, y2] = coords[i];
        const d = Math.hypot((x2 - x1) * 68600, (y2 - y1) * 111320);
        acc += d;
        if (acc >= step) { drivePts.push([coords[i][1], coords[i][0]]); acc = 0; }
    }
    console.log(`  симуляция езды: ${drivePts.length} точек (~10 км шаг), touch от mega-user-07`);
    for (let k = 0; k < drivePts.length; k++) {
        const [lat, lon] = drivePts[k];
        const { error: terr } = await sb.rpc('touch_device_location', { p_device_id: 'mega-user-07', p_latitude: lat, p_longitude: lon });
        if (terr) console.log(`  touch #${k} ERR: ${terr.message}`);
        // какие активные a17-метки в 2 км / 500 м
        for (const inc of a17.filter(i => i.is_active)) {
            const d = haversineM(lat, lon, inc.latitude, inc.longitude);
            if (d <= 2000) console.log(`   drv pt#${k} (${lat.toFixed(4)},${lon.toFixed(4)}) → #${inc.id}: ${Math.round(d)} м ${d <= 500 ? '→ CONFIRM-диалог' : '→ 2км-алерт'}`);
        }
    }
    // Метки, до которых НИКОГДА не доедет 2км-алерт (если смещение > 2 км)
    const neverAlert = a17.filter(i => distToRoute(i.latitude, i.longitude) > 2000);
    console.log(`  метки дальше 2 км от дороги (не алертятся при езде по дороге): ${neverAlert.map(n => n.id).join(', ') || 'нет'}`);

    // ── 6. Логин: форматы телефона для mega-user-07 (+7701550007 / pass07) ──
    console.log(`\n=== 6. ЛОГИН ФОРМАТЫ (аккаунт +7701550007, пароль pass07) ===`);
    const formats = ['8 701 550 00 07', '7015500007', '+7 701 550 00 07'];
    for (const f of formats) {
        const digits = f.replace(/\s/g, '');
        const tail = digits.slice(-10);
        const salts = [...new Set([digits, `+7${tail}`, `8${tail}`, `7${tail}`, tail])];
        const candidates = salts.map(s => hashPassword(s, 'pass07'));
        const { data, error: lerr } = await sb.rpc('login_device', {
            p_phone: digits,
            p_password_hashes: candidates,
            p_new_password_hash: candidates[0],
        });
        console.log(`  "${f}" → digits="${digits}" salts=[${salts.join(',')}] → ${lerr ? 'ERR ' + lerr.message : (data?.ok ? `OK (name=${data.name}, role=${data.role})` : 'REJECTED ' + JSON.stringify(data))}`);
    }
    // контрольный: канонический логин после экспериментов (и восстановление соли, если RPC перезаписал хэш)
    {
        const digits = '+7701550007';
        const tail = '7015500007';
        const salts = [...new Set([digits, `+7${tail}`, `8${tail}`, `7${tail}`, tail])];
        const candidates = salts.map(s => hashPassword(s, 'pass07'));
        const { data, error: lerr } = await sb.rpc('login_device', {
            p_phone: digits,
            p_password_hashes: candidates,
            p_new_password_hash: candidates[0],
        });
        console.log(`  канон. "+7701550007" → ${lerr ? 'ERR ' + lerr.message : (data?.ok ? 'OK' : 'REJECTED ' + JSON.stringify(data))}`);
    }

    // ── 7. Итого по подтверждениям ────────────────────────────────────────
    console.log(`\n=== 7. ПОДТВЕРЖДЕНИЯ ===`);
    const { data: confs } = await sb.from('incident_confirmations').select('incident_id, device_id, is_resolved, created_at').order('id');
    const byInc = {};
    for (const c of confs ?? []) (byInc[c.incident_id] ??= []).push(c.device_id);
    for (const [id, devs] of Object.entries(byInc))
        console.log(`  #${id}: ${devs.length} подтверждений от [${devs.join(', ')}]`);
    const unresolved3 = incidents.filter(i => i.confirmations_count >= 3 && i.is_active);
    if (unresolved3.length) console.log(`  ⚠ БАГ: count>=3 но active: ${unresolved3.map(u => u.id).join(', ')}`);

    console.log('\nDONE');
    process.exit(0);
})().catch(e => { console.error('FATAL', e); process.exit(1); });
