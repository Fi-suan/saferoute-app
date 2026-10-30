// verify-photo — AI-проверка фото инцидента (Mistral vision).
//
// Вызывается DB-триггером (миграция 010) на INSERT инцидента с фото.
// Отправляет публичный URL фото в Mistral chat/completions (vision-модель),
// получает вердикт и обновляет метку через service role (RLS не мешает):
//   ai_verified, ai_confidence, ai_analysis (казахский разбор), 
//   ai_severity_suggestion.
// Приложение видит обновление через realtime — бейдж «AI» появляется сам.
//
// Требует секрет: MISTRAL_API_KEY
//   Dashboard → Edge Functions → Secrets → Add secret: MISTRAL_API_KEY
//   (или: npx supabase secrets set MISTRAL_API_KEY=...)
//
// Развёртывание:
//   npx supabase functions deploy verify-photo --project-ref iqgawigwaempfnwtqovy

type IncidentRecord = {
    id: number;
    photo_url: string | null;
    incident_type: string;
    description: string | null;
    severity: number;
};

const MODEL = 'pixtral-12b-2409';

const PROMPT = `You verify user-submitted road-hazard photos for a road-safety app in Kazakhstan.
Given the photo and the reported incident type, respond in STRICT JSON:
{"is_valid": boolean,      // true if the photo plausibly shows the reported road hazard
 "category": "CRASH"|"ANIMAL"|"HAZARD"|"OTHER",
 "confidence": 0.0-1.0,    // how sure you are
 "severity": 1-5,          // suggested severity
 "analysis_kk": "1-2 short sentences in Kazakh explaining what you see"}
Empty/blurred/unrelated images are NOT valid. Be strict but practical.`;

Deno.serve(async (req: Request) => {
    const apiKey = Deno.env.get('MISTRAL_API_KEY');
    if (!apiKey) return new Response('MISTRAL_API_KEY not set', { status: 200 });

    try {
        const payload = await req.json();
        const rec: IncidentRecord | undefined = payload?.record;
        if (!rec?.photo_url) return new Response('no photo', { status: 200 });

        // 1. Вердикт от Mistral (pixtral читает URL напрямую)
        const mlRes = await fetch('https://api.mistral.ai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: MODEL,
                messages: [
                    {
                        role: 'user',
                        content: [
                            { type: 'text', text: PROMPT },
                            { type: 'image_url', image_url: rec.photo_url },
                        ],
                    },
                ],
                temperature: 0.1,
                max_tokens: 300,
            }),
        });
        if (!mlRes.ok) {
            return new Response(`mistral error ${mlRes.status}`, { status: 200 });
        }
        const ml = await mlRes.json();
        let text: string = ml?.choices?.[0]?.message?.content ?? '';
        // модель иногда оборачивает JSON в ```json … ```
        text = text.replace(/```json|```/g, '').trim();

        let verdict: any;
        try {
            verdict = JSON.parse(text);
        } catch {
            return new Response('unparsable verdict', { status: 200 });
        }

        const confidence = typeof verdict.confidence === 'number' ? verdict.confidence : 0;
        const isValid = verdict.is_valid === true && confidence >= 0.75;

        // Критерии мусора: модель уверенно говорит «это не дорожная опасность»
        // (is_valid=false и уверенность >= 0.6) — метка автоматически убирается
        // с карты; при неуверенном отказе решение остаётся за сообществом.
        const autoRejected = verdict.is_valid === false && confidence >= 0.6;

        // 2. Пишем результат в метку (service role обходит RLS)
        const url = `${Deno.env.get('SUPABASE_URL')}/rest/v1/incident_reports?id=eq.${rec.id}`;
        const updateRes = await fetch(url, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                apikey: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
                Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''}`,
                Prefer: 'return=minimal',
            },
            body: JSON.stringify({
                ai_verified: isValid,
                ai_confidence: Math.round(confidence * 100) / 100,
                ai_analysis: verdict.analysis_kk ?? null,
                ai_severity_suggestion:
                    typeof verdict.severity === 'number' ? Math.max(1, Math.min(5, Math.round(verdict.severity))) : null,
                ...(autoRejected ? { is_active: false, resolved_at: new Date().toISOString() } : {}),
            }),
        });

        return new Response(
            `incident ${rec.id}: valid=${isValid} autoRejected=${autoRejected} conf=${confidence} updated=${updateRes.ok}`,
            { status: 200 },
        );
    } catch (e) {
        // триггер не должен мешать вставке — всегда 200
        return new Response(`error: ${String(e).slice(0, 200)}`, { status: 200 });
    }
});
