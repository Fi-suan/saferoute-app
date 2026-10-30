// push-nearby — фоновые push-уведомления о новой метке.
//
// Срабатывает по DB Webhook (Database → Webhooks → supabase_functions) на
// INSERT в incident_reports: HTTP-запрос с телом записи.
// Находит устройства в радиусе 2 км с Expo push-токеном и шлёт уведомление
// через expo push API. Ошибки логируются, но не ломают вставку.
//
// Развёртывание:
//   npx supabase functions deploy push-nearby --project-ref iqgawigwaempfnwtqovy
//   Затем в Dashboard: Database → Webhooks → создать:
//     table: incident_reports, event: INSERT,
//     type: Supabase Function: push-nearby
//
// Пример тела запроса:
//   { "type": "INSERT", "table": "incident_reports",
//     "record": { "id": 1, "latitude": 51.1, "longitude": 71.4,
//                 "description": "...", "incident_type": "ANIMAL" } }

type IncidentRecord = {
    id: number;
    latitude: number;
    longitude: number;
    description: string | null;
    incident_type: string;
    route_id: string | null;
};

const RADIUS_KM = 2.0;
// гаверсинус в километрах
function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const TYPE_LABEL: Record<string, string> = {
    CRASH: 'ЖКО',
    ANIMAL: 'Жануарлар жолда',
    HAZARD: 'Қауіпті аймақ',
    OTHER: 'Қауіп',
};

Deno.serve(async (req: Request) => {
    try {
        const payload = await req.json();
        const rec: IncidentRecord | undefined = payload?.record;
        if (!rec || typeof rec.latitude !== 'number' || typeof rec.longitude !== 'number') {
            return new Response('no record', { status: 200 });
        }

        // устройство считается «рядом», если оно пинговалось за последние сутки
        const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();

        // SUPABASE_URL/ANON_KEY доступны в Edge Functions как env по умолчанию
        const url = `${Deno.env.get('SUPABASE_URL')}/rest/v1/devices`;
        const query =
            `?select=device_id,latitude,longitude,fcm_token` +
            `&fcm_token=not.is.null&latitude=not.is.null&last_seen=gte.${since}`;
        const res = await fetch(url + query, {
            headers: {
                apikey: Deno.env.get('SUPABASE_ANON_KEY') ?? '',
                Authorization: `Bearer ${Deno.env.get('SUPABASE_ANON_KEY') ?? ''}`,
            },
        });
        if (!res.ok) return new Response('devices fetch failed', { status: 200 });

        const devices: Array<{
            device_id: string;
            latitude: number;
            longitude: number;
            fcm_token: string;
        }> = await res.json();

        const label = TYPE_LABEL[rec.incident_type] ?? 'Қауіп';
        const body = rec.description ? `${label} — ${rec.description}` : label;

        const messages = devices
            .filter((d) => haversineKm(d.latitude, d.longitude, rec.latitude, rec.longitude) <= RADIUS_KM)
            .map((d) => ({
                to: d.fcm_token,
                sound: 'default',
                title: '⚠️ Абай болыңыз!',
                body,
                channelId: 'saferoute-alerts',
                data: { incidentId: rec.id, type: 'proximity' },
            }));

        if (messages.length === 0) return new Response('no recipients', { status: 200 });

        const pushRes = await fetch('https://exp.host/--/api/v2/push/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(messages),
        });

        const result = pushRes.ok ? await pushRes.text() : 'expo push failed';
        return new Response(`sent ${messages.length}: ${result.slice(0, 200)}`, { status: 200 });
    } catch (e) {
        // webhook не должен возвращать 5xx — вставка важнее уведомления
        return new Response(`error: ${String(e).slice(0, 200)}`, { status: 200 });
    }
});
