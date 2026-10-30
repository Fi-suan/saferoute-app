/**
 * seed-demo — демо-данные Sapa Jol (идемпотентно).
 *
 * Создаёт 7 демонстрационных меток вдоль коридора А-17 (Павлодар),
 * если их ещё нет. Для чистой базы / новой демо-среды.
 *
 *   node scripts/seed-demo.js
 */
const { createClient } = require('@supabase/supabase-js');

const sb = createClient('https://iqgawigwaempfnwtqovy.supabase.co', 'sb_publishable_mtjnCty0nl-EXsssgG0BUg_k0wZtT90', { auth: { persistSession: false } });

const DEMO_INCIDENTS = [
    { incident_type: 'ANIMAL', description: 'Kiikter zholdyn shygys zhagynda, shama 15 bas', severity: 4, lat: 52.285, lon: 76.940 },
    { incident_type: 'CRASH',  description: 'Avtokolik men ylgi mal soghylysy, A-1 trassa', severity: 4, lat: 52.270, lon: 76.960 },
    { incident_type: 'HAZARD', description: 'Zholdaghy ulken shunkyr, sol zhaghynda',        severity: 3, lat: 52.292, lon: 76.952 },
    { incident_type: 'ANIMAL', description: 'Tuyeler zhol keshedi, 5 bas',                   severity: 3, lat: 52.278, lon: 76.935 },
    { incident_type: 'CRASH',  description: 'DTP zhengil kolikter arasynda',                 severity: 2, lat: 52.265, lon: 76.970 },
    { incident_type: 'HAZARD', description: null,                                           severity: 3, lat: 52.271, lon: 76.953 },
    { incident_type: 'HAZARD', description: null,                                           severity: 3, lat: 52.271, lon: 76.953 },
];

(async () => {
    const { data: existing } = await sb
        .from('incident_reports')
        .select('id', { count: 'exact', head: true });

    const { count } = await sb
        .from('incident_reports')
        .select('id', { count: 'exact', head: true })
        .like('description', 'K%');

    // Идемпотентность: сидим, только если демо-меток нет вообще
    const { count: demoCount } = await sb
        .from('incident_reports')
        .select('id', { count: 'exact', head: true })
        .eq('route_id', 'a17')
        .gt('latitude', 52.0);

    if (demoCount > 0) {
        console.log(`Демо-метки уже есть (${demoCount} шт. в коридоре А-17) — ничего не делаю.`);
        return;
    }

    let created = 0;
    for (const inc of DEMO_INCIDENTS) {
        const { error } = await sb.from('incident_reports').insert({
            incident_type: inc.incident_type,
            description: inc.description,
            severity: inc.severity,
            latitude: inc.lat,
            longitude: inc.lon,
            reporter_device_id: 'demo-seed',
            route_id: 'a17',
            ai_verified: false,
            is_active: true,
            confirmations_count: 0,
        });
        if (!error) created++;
    }
    console.log(`Создано демо-меток: ${created}/${DEMO_INCIDENTS.length}`);
    void existing;
})();
