/** qa-probe2 — уточнения: login-нормализация, created_at, #92 */
const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');
const SB_URL = 'https://iqgawigwaempfnwtqovy.supabase.co';
const SB_KEY = 'sb_publishable_mtjnCty0nl-EXsssgG0BUg_k0wZtT90';
const sb = createClient(SB_URL, SB_KEY, { auth: { persistSession: false } });
const hashPassword = (salt, p) => crypto.createHash('sha256').update(`saferoute:${salt}:${p}`).digest('hex');

(async () => {
    // A. Фолбэк по последним 10 цифрам: p_phone с мусорным префиксом, но tail = stored
    // stored phone = "+7701550007" (10 цифр), tail = "7701550007"
    // кандидат-хэш = соль регистрации "+7701550007"
    {
        const { data, error } = await sb.rpc('login_device', {
            p_phone: '87701550007',
            p_password_hashes: [hashPassword('+7701550007', 'pass07')],
            p_new_password_hash: null,
        });
        console.log(`A. фолбэк tail-10 ("87701550007", хэш от reg-соли) → ${error ? 'ERR ' + error.message : JSON.stringify(data)}`);
    }
    // B. То же, но хэши — как их построило бы приложение из введённого "8 701 550 00 07"
    {
        const digits = '87015500007'; // как в реальном 11-значном номере
        const tail = digits.slice(-10);
        const salts = [...new Set([digits, `+7${tail}`, `8${tail}`, `7${tail}`, tail])];
        const candidates = salts.map(s => hashPassword(s, 'pass07'));
        const { data, error } = await sb.rpc('login_device', {
            p_phone: digits, p_password_hashes: candidates, p_new_password_hash: candidates[0],
        });
        console.log(`B. app-кандидаты для 11-значного ввода → ${error ? 'ERR ' + error.message : JSON.stringify(data)}`);
    }
    // C. created_at: сырые строки + как их парсит приложение (toIso)
    const { data: incs } = await sb.from('incident_reports').select('id, created_at, is_active').order('id').limit(3);
    for (const i of incs ?? []) {
        const raw = String(i.created_at);
        const appIso = /[zZ]|[+-]\d{2}:?\d{2}$/.test(raw) ? raw : raw + 'Z';
        const parsed = new Date(appIso).getTime();
        const ageMin = isNaN(parsed) ? 'INVALID' : Math.round((Date.now() - parsed) / 60000);
        console.log(`C. #${i.id} created_at raw="${raw}" → app парсит="${appIso}" age=${ageMin}м`);
    }
    // D. #92: полный ai_analysis — застряла ли в «тексеруде» или это слово в тексте
    const { data: i92 } = await sb.from('incident_reports').select('id, ai_analysis, ai_verified, ai_confidence, is_active').eq('id', 92).single();
    console.log(`D. #92 ai_verified=${i92.ai_verified} conf=${i92.ai_confidence} active=${i92.is_active}`);
    console.log(`   полный analysis: ${i92.ai_analysis}`);
    console.log(`   начинается с "AI метканы тексеруде"? ${/^AI метканы тексеруде/.test(String(i92.ai_analysis))}`);
    // E. сводка: у скольких меток analysis всё ещё placeholder
    const { data: all } = await sb.from('incident_reports').select('id, ai_analysis, ai_verified, is_active, ai_confidence, photo_url');
    const stuck = (all ?? []).filter(i => /^AI метканы тексеруде/.test(String(i.ai_analysis ?? '')));
    console.log(`E. реально «застряли в тексеруде»: ${stuck.length} ${stuck.map(s => s.id).join(',') || '(нет)'}`);
    const processed = (all ?? []).filter(i => !/^AI метканы тексеруде/.test(String(i.ai_analysis ?? '')));
    console.log(`   обработаны Pixtral: ${processed.length}/15, ai_verified=1 у ${processed.filter(p => p.ai_verified).length}, отклонены уверенно (conf>=0.6, verified=0): ${processed.filter(p => !p.ai_verified && (p.ai_confidence ?? 0) >= 0.6).map(p => `#${p.id} active=${p.is_active}`).join(', ') || '—'}`);
    console.log(`   отклонены неуверенно (conf<0.6, verified=0, остались active): ${processed.filter(p => !p.ai_verified && (p.ai_confidence ?? 0) < 0.6).map(p => `#${p.id} active=${p.is_active} conf=${p.ai_confidence}`).join(', ') || '—'}`);
    process.exit(0);
})().catch(e => { console.error('FATAL', e); process.exit(1); });
