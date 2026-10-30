/**
 * confirm-runner — «второй пользователь» для тестов Sapa Jol с одного телефона.
 *
 * Вызывает тот же серверный RPC confirm_incident, что и приложение другого
 * пользователя. Использование:
 *
 *   node scripts/confirm-runner.js <ID инцидента>
 *
 * Скрипт:
 *   1) показывает состояние инцидента и «возраст» строки (для замера времени доставки);
 *   2) три раза подтверждает от имени трёх разных device_id (пауза между
 *      подтверждениями — нажми Enter, чтобы успеть заскринить счётчик на телефоне);
 *   3) печатает итоговое состояние (счётчик 3/3, is_active=false, resolved_at).
 *
 * Таблица Supabase обновляется на телефоне в реальном времени — наблюдай карту.
 */
const { createClient } = require('@supabase/supabase-js');
const readline = require('readline');

const SUPABASE_URL = 'https://iqgawigwaempfnwtqovy.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_mtjnCty0nl-EXsssgG0BUg_k0wZtT90';

const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });

const ask = (q) =>
    new Promise(res => {
        const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
        rl.question(q, a => { rl.close(); res(a); });
    });

function fmtAge(from) {
    const sec = (Date.now() - new Date(from).getTime()) / 1000;
    return `${sec.toFixed(1)} сек после создания (created_at: ${new Date(from).toLocaleTimeString()})`;
}

(async () => {
    const incidentId = process.argv[2] || (await ask('Инцидент ID: ')).trim();
    if (!incidentId) {
        console.error('Укажи ID инцидента: node scripts/confirm-runner.js <ID>');
        process.exit(1);
    }

    const { data: inc } = await sb
        .from('incident_reports')
        .select('id, description, severity, confirmations_count, is_active, created_at')
        .eq('id', incidentId)
        .single();

    if (!inc) {
        console.error(`Инцидент #${incidentId} не найден. Открой его на карте — ID виден в карточке.`);
        process.exit(1);
    }

    console.log('\n──────────────────────────────────────────────');
    console.log(`Инцидент #${inc.id}  [серьёзность ${inc.severity}/5]`);
    console.log(`Описание: ${inc.description ?? '—'}`);
    console.log(`Состояние: подтверждений ${inc.confirmations_count}, активен: ${inc.is_active}`);
    console.log(`Замер времени доставки: сейчас ${fmtAge(inc.created_at)}`);
    console.log('──────────────────────────────────────────────');

    const users = [
        { id: 'test-user-2', label: 'Пользователь 2 (Айбек)' },
        { id: 'test-user-3', label: 'Пользователь 3 (Дана)' },
        { id: 'test-user-4', label: 'Пользователь 4 (Ерлан)' },
    ];

    for (const u of users) {
        await ask(`\n[${u.label}] — нажми Enter, чтобы подтвердить (успей включить запись экрана телефона)...`);
        const t0 = new Date();
        const { data: res } = await sb.rpc('confirm_incident', {
            p_incident_id: inc.id,
            p_device_id: u.id,
            p_is_resolved: true,
        });
        console.log(`[${u.label}] ${new Date().toLocaleTimeString()} → ${JSON.stringify(res)} (задержка RPC: ${Date.now() - t0.getTime()} мс)`);
    }

    const { data: after } = await sb
        .from('incident_reports')
        .select('confirmations_count, is_active, resolved_at')
        .eq('id', inc.id)
        .single();
    console.log('\n──────────────────────────────────────────────');
    console.log('ИТОГ:', JSON.stringify(after, null, 1));
    console.log(after.is_active ? 'Инцидент ещё активен (маловато подтверждений?)' : 'Инцидент АВТОМАТИЧЕСКИ РЕШЁН — проверь, что маркер погас на карте.');
    console.log('──────────────────────────────────────────────');
    process.exit(0);
})().catch(e => {
    console.error('Ошибка:', e.message);
    process.exit(1);
});
