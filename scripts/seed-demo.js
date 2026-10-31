/**
 * seed-demo — демо-метки Sapa Jol по маршрутам (идемпотентно).
 *
 * 6 меток вдоль А-17 (Астана → Павлодар) + по 3 на А-1, А-21, Е-40.
 * Существует только для чистой базы / пересоздания демо-среды.
 *
 *   node scripts/seed-demo.js
 */
const { createClient } = require('@supabase/supabase-js');

const sb = createClient('https://iqgawigwaempfnwtqovy.supabase.co', 'sb_publishable_mtjnCty0nl-EXsssgG0BUg_k0wZtT90', { auth: { persistSession: false } });

const DEMO = [
    // ── A-17: Астана → Павлодар (6) ──
    { t: 'HAZARD', d: 'Астана маңы: жол жөндеу жұмыстары, күтушылар бар',     s: 3, lat: 51.128, lon: 71.430, r: 'a17' },
    { t: 'ANIMAL', d: 'Жолда жылқылар, шамамен 10 бас',                        s: 4, lat: 51.350, lon: 72.100, r: 'a17' },
    { t: 'HAZARD', d: 'Жолдағы мұз, сақтық тансыңыз',                          s: 4, lat: 51.550, lon: 72.850, r: 'a17' },
    { t: 'CRASH',  d: 'Жеңіл ЖКО, оң жолақ бұғалды',                          s: 4, lat: 51.750, lon: 73.600, r: 'a17' },
    { t: 'ANIMAL', d: 'Қой отары жол кесіп өтеді',                             s: 3, lat: 51.950, lon: 74.350, r: 'a17' },
    { t: 'ANIMAL', d: 'Павлодар маңы: киіктер жақындайды',                     s: 5, lat: 52.280, lon: 76.950, r: 'a17' },
    // ── A-1: Астана → Алматы (3) ──
    { t: 'HAZARD', d: 'Қарағанды маңы: жолда шұңқыр',                          s: 3, lat: 49.930, lon: 73.100, r: 'a1' },
    { t: 'ANIMAL', d: 'Балқаш маңы: түйелер жолда',                            s: 3, lat: 46.800, lon: 74.900, r: 'a1' },
    { t: 'CRASH',  d: 'Алматыға жақын: ЖКО',                                    s: 4, lat: 44.500, lon: 76.900, r: 'a1' },
    // ── A-21: Екібастұз → Семей (3) ──
    { t: 'ANIMAL', d: 'Екібастұз маңы: сиыр табыны',                           s: 3, lat: 51.750, lon: 75.300, r: 'a21' },
    { t: 'HAZARD', d: 'Жолда тас тасымалы, жол тар',                           s: 3, lat: 51.200, lon: 77.500, r: 'a21' },
    { t: 'ANIMAL', d: 'Семей маңы: жылқылар',                                   s: 3, lat: 50.900, lon: 79.900, r: 'a21' },
    // ── E-40: Шымкент → Тараз (3) ──
    { t: 'HAZARD', d: 'Шымкент маңы: жол жөндеу',                              s: 2, lat: 42.900, lon: 70.300, r: 'e40' },
    { t: 'ANIMAL', d: 'Тараз маңы: қой отары',                                  s: 3, lat: 43.100, lon: 71.000, r: 'e40' },
    { t: 'CRASH',  d: 'Жеңіл ЖКО',                                              s: 3, lat: 42.500, lon: 69.900, r: 'e40' },
];

(async () => {
    // Идемпотентность: сидим, только если демо-меток нет
    const { count } = await sb
        .from('incident_reports')
        .select('id', { count: 'exact', head: true })
        .eq('reporter_device_id', 'demo-seed');

    if (count > 0) {
        console.log(`Демо-метки уже есть (${count} шт.) — ничего не делаю.`);
        return;
    }

    let created = 0;
    for (const inc of DEMO) {
        const { error } = await sb.from('incident_reports').insert({
            incident_type: inc.t,
            description: inc.d,
            severity: inc.s,
            latitude: inc.lat,
            longitude: inc.lon,
            reporter_device_id: 'demo-seed',
            route_id: inc.r,
            ai_verified: false,
            ai_analysis: 'Фото жоқ — қауымдастық растауын күтуде.',
            is_active: true,
            confirmations_count: 0,
        });
        if (!error) created++;
    }
    console.log(`Создано демо-меток: ${created}/${DEMO.length}`);
})();
