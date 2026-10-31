/**
 * demo-photos — прикрепляет реальные фото к демо-меткам и прогоняет их
 * через НАСТОЯЩУЮ AI-проверку (verify-photo edge function + Mistral).
 *
 *   node scripts/demo-photos.js
 */
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const { Client } = require('pg');

const sb = createClient('https://iqgawigwaempfnwtqovy.supabase.co', 'sb_publishable_mtjnCty0nl-EXsssgG0BUg_k0wZtT90', { auth: { persistSession: false } });
const PG = 'postgresql://postgres:MZkqsOdSdT1CrH3V@db.iqgawigwaempfnwtqovy.supabase.co:5432/postgres';

// фото → тип метки (Викисклад, свободные лицензии)
const ANIMAL_PHOTOS = [
    'Cattle on road. - geograph.org.uk - 97139.jpg',
    'Cattle on a road in Konark.jpg',
    'A hoard of cattle on the road in Thailand.jpg',
    'Sheep on road (1294322).jpg',
    'Sheep on the road - geograph.org.uk - 3585719.jpg',
    'Sheep on the road - geograph.org.uk - 6096281.jpg',
    'Headcarrying people with cattle on the road (181101541).jpg',
];
const HAZARD_PHOTOS = [
    'Roadworks, Hampton Road - geograph.org.uk - 3993383.jpg',
    'Roadworks, Harrogate Road, Greengates - geograph.org.uk - 7068726.jpg',
    'Roadworks at Oak Road junction - geograph.org.uk - 8377130.jpg',
    'Roadworks on the A1 at Woolsington - geograph.org.uk - 7144812.jpg',
    'Roadworks, Harrogate Road, Greengates - geograph.org.uk - 7068726.jpg', // дубль для 5-й
];
const CRASH_PHOTOS = [
    'Japanese car accident.jpg',
    'Indonesian fire fighters during a traffic accident.jpg',
    'Japanese car accident.jpg', // дубль для 3-й
];

function photoFor(type, idx) {
    if (type === 'ANIMAL') return ANIMAL_PHOTOS[idx % ANIMAL_PHOTOS.length];
    if (type === 'HAZARD') return HAZARD_PHOTOS[idx % HAZARD_PHOTOS.length];
    return CRASH_PHOTOS[idx % CRASH_PHOTOS.length];
}

const wmUrl = (name) => 'https://commons.wikimedia.org/wiki/Special:FilePath/' + encodeURIComponent(name) + '?width=800';

(async () => {
    const c = new Client({ connectionString: PG, ssl: { rejectUnauthorized: false } });
    await c.connect();
    const { rows: incidents } = await c.query(
        "select id, incident_type from incident_reports where reporter_device_id = 'demo-seed' order by id",
    );
    console.log('демо-меток:', incidents.length);

    const counters = { ANIMAL: 0, HAZARD: 0, CRASH: 0, OTHER: 0 };
    let ok = 0;
    for (const inc of incidents) {
        const file = photoFor(inc.incident_type, counters[inc.incident_type]++);
        // 1. скачать
        const res = await fetch(wmUrl(file));
        if (!res.ok) { console.log(inc.id, 'SKIP (скачивание):', file, res.status); continue; }
        const bytes = Buffer.from(await res.arrayBuffer());
        // 2. в Storage
        const sPath = `demo/inc-${inc.id}.jpg`;
        const up = await sb.storage.from('incident-photos').upload(sPath, bytes, { contentType: 'image/jpeg', upsert: true });
        if (up.error) { console.log(inc.id, 'SKIP (storage):', up.error.message); continue; }
        const pub = sb.storage.from('incident-photos').getPublicUrl(sPath).data.publicUrl;
        // 3. привязать к метке
        await c.query('update incident_reports set photo_url = $1 where id = $2', [pub, inc.id]);
        ok++;
        console.log(inc.id, inc.incident_type, '←', file.slice(0, 40), 'OK');
    }
    console.log('фото прикреплено:', ok, '/', incidents.length);

    // 4. настоящая AI-проверка каждой метки
    const { rows: withPhotos } = await c.query(
        "select id, photo_url, incident_type, description, severity, latitude, longitude from incident_reports where reporter_device_id = 'demo-seed' and photo_url is not null",
    );
    let verified = 0;
    for (const rec of withPhotos) {
        const r = await fetch('https://iqgawigwaempfnwtqovy.supabase.co/functions/v1/verify-photo', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ record: rec }),
        });
        const text = (await r.text()).slice(0, 90);
        console.log('AI проверка #' + rec.id, '→', text);
        if (r.ok) verified++;
    }
    console.log('AI-проверок прошло:', verified, '/', withPhotos.length);
    await c.end();
})().catch(e => { console.error('ERR:', e.message); process.exit(1); });
