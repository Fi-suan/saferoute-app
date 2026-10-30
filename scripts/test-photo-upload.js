/**
 * End-to-end проверка фото: base64 → upload → public URL → вставка в инцидент.
 * Имитирует путь приложения (anon-ключ). Запуск: node scripts/test-photo-upload.js
 */
const { createClient } = require('@supabase/supabase-js');

const sb = createClient('https://iqgawigwaempfnwtqovy.supabase.co', 'sb_publishable_mtjnCty0nl-EXsssgG0BUg_k0wZtT90', { auth: { persistSession: false } });

// base64 → Uint8Array (копия логики приложения, RN без atob)
function base64ToBytes(b64) {
    const lookup = new Uint8Array(256).fill(255);
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    for (let i = 0; i < chars.length; i++) lookup[chars.charCodeAt(i)] = i;
    lookup['='.charCodeAt(0)] = 0;
    let out = new Uint8Array(Math.floor((b64.length * 3) / 4));
    let o = 0, buffer = 0, bits = 0;
    for (let i = 0; i < b64.length; i++) {
        const v = lookup[b64.charCodeAt(i)];
        if (v === 255) continue;
        buffer = (buffer << 6) | v;
        bits += 6;
        if (bits >= 8) { bits -= 8; out[o++] = (buffer >> bits) & 0xff; }
    }
    return o === out.length ? out : out.subarray(0, o);
}

(async () => {
    // 1×1 синий JPEG, сгенерированный заранее (30 bytes)
    const B64 =
        '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPDIzNP/AABEIAAEAAQMBIgACEQEDEQH/xAAfAAABBQEBAQEBAQAAAAAAAAABAgMEBQYHCAkKC//EALUQAAIBAwMCBAMFBQQEAAABfQECAwAEEQUSITFBBhNRYQcicRQygZGhCCNCscEVUtHwJDNicoIJChYXGBkaJSYnKCkqNDU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6g4SFhoeIiYqSk5SVlpeYmZqio6Slpqeoqaqys7S1tre4ubrCw8TFxsfIycrS09TV1tfY2drh4uPk5ebn6Onq8fLz9PX29/j5+v/aAAwDAQACEQMRAD8A/v4ooooA/9k=';

    const bytes = base64ToBytes(B64);
    console.log('декодировано байт:', bytes.length);

    const path = 'test-upload/photo-test.jpg';
    const up = await sb.storage.from('incident-photos').upload(path, bytes, {
        contentType: 'image/jpeg', upsert: true,
    });
    if (up.error) { console.error('FAIL upload:', up.error.message); process.exit(1); }
    console.log('OK   upload');

    const { data } = sb.storage.from('incident-photos').getPublicUrl(path);
    const res = await fetch(data.publicUrl);
    console.log(res.ok ? 'OK   публичный URL отдаёт ' + res.headers.get('content-type') : 'FAIL fetch: ' + res.status);

    // Инцидент с фото (потом удалим)
    const inc = await sb.from('incident_reports').insert({
        incident_type: 'OTHER', description: 'photo-upload-test', severity: 1,
        latitude: 51.16, longitude: 71.41, reporter_device_id: 'photo-test',
        route_id: 'a17', photo_url: data.publicUrl, is_active: true, confirmations_count: 0,
    }).select('id, photo_url').single();
    console.log(inc.data ? 'OK   инцидент #' + inc.data.id + ' с photo_url' : 'FAIL insert: ' + inc.error?.message);

    console.log('URL:', data.publicUrl);
})();
