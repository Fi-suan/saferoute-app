/** Quick DB inspection for debugging */
const { createClient } = require('@supabase/supabase-js');
const sb = createClient('https://iqgawigwaempfnwtqovy.supabase.co', 'sb_publishable_mtjnCty0nl-EXsssgG0BUg_k0wZtT90', { auth: { persistSession: false } });

(async () => {
    const { data, error } = await sb
        .from('incident_reports')
        .select('id, description, incident_type, severity, latitude, longitude, confirmations_count, is_active, created_at, resolved_at')
        .order('id', { ascending: false })
        .limit(30);
    if (error) { console.error('ERR', error.message); process.exit(1); }
    console.log('id | active | conf | lat, lon | created_at | resolved_at | desc');
    for (const r of data) {
        console.log(`${r.id} | ${r.is_active} | ${r.confirmations_count} | ${r.latitude.toFixed(3)}, ${r.longitude.toFixed(3)} | ${r.created_at} | ${r.resolved_at ?? '—'} | ${r.description}`);
    }
    // also check confirmations for recent incidents
    const { data: conf } = await sb
        .from('incident_confirmations')
        .select('incident_id, device_id, is_resolved, confirmed_at')
        .order('confirmed_at', { ascending: false })
        .limit(15);
    console.log('\n— recent confirmations —');
    for (const c of conf ?? []) console.log(`inc ${c.incident_id} | dev ${String(c.device_id).slice(0, 14)}… | resolved=${c.is_resolved} | ${c.confirmed_at}`);
})();
