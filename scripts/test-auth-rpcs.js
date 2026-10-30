/**
 * Проверка миграции 007 через anon-ключ (как реальный клиент приложения).
 * Запуск: node scripts/test-auth-rpcs.js
 */
const { createClient } = require('@supabase/supabase-js');

const sb = createClient('https://iqgawigwaempfnwtqovy.supabase.co', 'sb_publishable_mtjnCty0nl-EXsssgG0BUg_k0wZtT90', { auth: { persistSession: false } });

async function check(name, cond, extra) {
    console.log(`${cond ? 'OK  ' : 'FAIL'} ${name}${extra ? ' — ' + JSON.stringify(extra) : ''}`);
    if (!cond) process.exitCode = 1;
}

(async () => {
    const TEST_DEV = 'rpc-test-device-' + Date.now();
    const PHONE = '+7' + (7000000000 + Math.floor(Math.random() * 999999999));

    // 1. Прямой select из devices должен быть запрещён (RLS без политик)
    const direct = await sb.from('devices').select('phone_number').limit(1);
    check('devices не читается напрямую', direct.error !== null || (direct.data ?? []).length === 0, direct.error?.message);

    // 2. Регистрация через RPC
    const reg = await sb.rpc('register_device', {
        p_device_id: TEST_DEV, p_role: 'OWNER', p_name: 'Тест Адам',
        p_phone_number: PHONE, p_password_hash: 'abc123hash',
    });
    check('register_device', !reg.error, reg.error?.message);

    // 3. Повторная регистрация не затирает телефон/имя (coalesce)
    const reg2 = await sb.rpc('register_device', { p_device_id: TEST_DEV, p_role: 'DRIVER' });
    check('re-register не ломает профиль', !reg2.error);

    // 4. Вход: неверный хэш
    const bad = await sb.rpc('login_device', { p_phone: PHONE, p_password_hash: 'wrong' });
    check('login с неверным паролем отклонён', bad.data?.ok === false && bad.data?.reason === 'bad_password', bad.data);

    // 5. Вход: верный хэш (роль DRIVER — шаг 3 перерегистрировал её осознанно)
    const ok = await sb.rpc('login_device', { p_phone: PHONE, p_password_hash: 'abc123hash' });
    check('login с верным паролем', ok.data?.ok === true && ok.data?.role === 'DRIVER' && ok.data?.name === 'Тест Адам', ok.data);

    // 6. Вход с другим форматом номера (последние 10 цифр)
    const tail = await sb.rpc('login_device', { p_phone: PHONE.replace('+7', '8'), p_password_hash: 'abc123hash' });
    check('login по хвосту 10 цифр', tail.data?.ok === true, tail.data);

    // 7. touch_device_location
    const touch = await sb.rpc('touch_device_location', { p_device_id: TEST_DEV, p_latitude: 51.1, p_longitude: 71.4 });
    check('touch_device_location', !touch.error);

    // 8. update_fcm_token не затирает профиль
    const fcm = await sb.rpc('update_fcm_token', { p_device_id: TEST_DEV, p_fcm_token: 'tok-123' });
    check('update_fcm_token', !fcm.error);
    const relogin = await sb.rpc('login_device', { p_phone: PHONE, p_password_hash: 'abc123hash' });
    check('после fcm-update вход жив', relogin.data?.ok === true, relogin.data);

    // 9. Рейт-лимит: 10+ подтверждений за 5 минут → rate_limited
    const lim = await sb.rpc('confirm_incident', {
        p_incident_id: 999999, p_device_id: 'flood-test-' + Date.now(), p_is_resolved: true,
    });
    check('confirm_rate_limit: одиночный вызов не rate_limited', lim.data?.status !== 'rate_limited', lim.data);

    console.log('\nЗамер: хэш пароля больше недоступен анониму — вход верифицируется на сервере.');

    // Чистим тестовое устройство (через pg это сделал бы прямой доступ; тут оставляем — anon не может)
    console.log('Тестовое устройство:', TEST_DEV, '(удалить: node scripts/db-inspect.js не умеет; см. cleanup-test-users.sql)');
})();
