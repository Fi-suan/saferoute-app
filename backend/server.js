/**
 * SafeRoute / Sapa Jol — Backend Server
 *
 * Express.js + sql.js (pure JS SQLite) + OpenAI GPT-4o Vision
 * Deploy: Render.com (Web Service)
 */

const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const { WebSocketServer } = require('ws');
const path = require('path');
const http = require('http');

// ── Config ────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 8000;
const OPENAI_KEY = process.env.OPENAI_API_KEY || '';
const DATABASE_URL = process.env.DATABASE_URL;

const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false } // Required for Supabase/Render
});

// ── Database Init ─────────────────────────────────────────────────────────
async function initDB() {
    try {
        const client = await pool.connect();
        console.log('[DB] Connected to PostgreSQL');
        client.release();
    } catch (err) {
        console.error('[DB] Connection error:', err.message);
    }
}

// ── DB Helpers (Now async for PG) ─────────────────────────────────────────
async function dbAll(sql, params = []) {
    const res = await pool.query(sql, params);
    return res.rows;
}

async function dbGet(sql, params = []) {
    const res = await pool.query(sql, params);
    return res.rows[0] || null;
}

async function dbRun(sql, params = []) {
    const res = await pool.query(sql, params);
    return { lastInsertRowid: res.rows[0]?.id || null };
}

// ── Express App ───────────────────────────────────────────────────────────
const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// ── Health Check ──────────────────────────────────────────────────────────
app.get('/health', async (_req, res) => {
    try {
        const row = await dbGet('SELECT COUNT(*) as c FROM incidents');
        res.json({ status: 'ok', incidents: parseInt(row?.c || 0), timestamp: new Date().toISOString() });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── AI Validation (GPT-4o Vision) ─────────────────────────────────────────
async function validateWithAI(base64Image, incidentType, description) {
    if (!OPENAI_KEY) {
        return {
            verified: false,
            confidence: 0.5,
            analysis: 'AI тексеру қол жетімді емес (API кілті жоқ). Қоғамдастық растауын күтуде.',
        };
    }

    try {
        const { default: OpenAI } = await import('openai');
        const openai = new OpenAI({ apiKey: OPENAI_KEY });

        const response = await openai.chat.completions.create({
            model: 'gpt-4o',
            max_tokens: 300,
            messages: [
                {
                    role: 'system',
                    content: `Ты — AI-аналитик дорожной безопасности Казахстана для приложения SafeRoute (Sapa Jol).
Анализируй фото дорожных инцидентов. Отвечай СТРОГО в JSON:
{
  "verified": true/false,
  "confidence": 0.0-1.0,
  "animal_type": "horse"|"cow"|"camel"|"sheep"|"saiga"|null,
  "analysis_kk": "анализ на казахском (1-2 предложения)"
}
Тип инцидента: ${incidentType}. Описание: ${description || 'жоқ'}.
Будь строгим: нечёткое фото или несоответствие типу → verified: false.`
                },
                {
                    role: 'user',
                    content: [
                        { type: 'text', text: 'Мына фотоны талда:' },
                        {
                            type: 'image_url',
                            image_url: { url: `data:image/jpeg;base64,${base64Image}`, detail: 'low' },
                        },
                    ],
                },
            ],
        });

        const text = response.choices[0]?.message?.content || '';
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            return {
                verified: !!parsed.verified,
                confidence: Math.min(1, Math.max(0, parsed.confidence || 0.5)),
                analysis: parsed.analysis_kk || 'AI талдауы аяқталды.',
                animal_type: parsed.animal_type || null,
            };
        }
        return { verified: false, confidence: 0.3, analysis: text.slice(0, 200) };
    } catch (err) {
        console.error('[AI] Error:', err.message);
        return {
            verified: false,
            confidence: 0.0,
            analysis: `AI қатесі: ${err.message?.slice(0, 80)}`,
        };
    }
}

// ── API Routes ────────────────────────────────────────────────────────────

// GET /api/v1/incidents/active
app.get('/api/v1/incidents/active', async (_req, res) => {
    try {
        const rows = await dbAll('SELECT * FROM incidents WHERE is_active = 1 ORDER BY created_at DESC LIMIT 100');
        res.json(rows.map(normalizeIncident));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/v1/incidents/feed
app.get('/api/v1/incidents/feed', async (_req, res) => {
    try {
        const rows = await dbAll('SELECT * FROM incidents ORDER BY created_at DESC LIMIT 200');
        res.json(rows.map(normalizeIncident));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/v1/incidents/report
app.post('/api/v1/incidents/report', async (req, res) => {
    try {
        const { incident_type, description, severity, latitude, longitude, reporter_device_id, photo_base64 } = req.body;

        if (!incident_type || !latitude || !longitude) {
            return res.status(400).json({ error: 'incident_type, latitude, longitude міндетті' });
        }

        let aiResult = { verified: false, confidence: 0.0, analysis: 'Фото жоқ — қоғамдастық растауын күтуде.' };
        let photoUrl = null;

        if (photo_base64) {
            aiResult = await validateWithAI(photo_base64, incident_type, description);
            photoUrl = 'uploaded';
        }

        const created = await dbGet(
            `INSERT INTO incidents (incident_type, description, severity, latitude, longitude,
                                    reporter_device_id, ai_verified, ai_confidence, ai_analysis, photo_url)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
             RETURNING *`,
            [incident_type, description || null, severity || 3, latitude, longitude,
                reporter_device_id || null, aiResult.verified ? 1 : 0, aiResult.confidence,
                aiResult.analysis, photoUrl]
        );

        broadcast({ type: 'new_incident', incident: normalizeIncident(created) });
        res.status(201).json(normalizeIncident(created));
    } catch (err) {
        console.error('[Report]', err);
        res.status(500).json({ error: err.message });
    }
});

// POST /api/v1/incidents/:id/confirm
app.post('/api/v1/incidents/:id/confirm', async (req, res) => {
    const { id } = req.params;
    const { device_id, is_resolved } = req.body;

    if (!device_id) return res.status(400).json({ error: 'device_id міндетті' });

    try {
        const existing = await dbGet(
            'SELECT id FROM confirmations WHERE incident_id = $1 AND device_id = $2', [id, device_id]
        );
        if (existing) return res.status(409).json({ error: 'Бұрын растағансыз' });

        await dbRun('INSERT INTO confirmations (incident_id, device_id, is_resolved) VALUES ($1, $2, $3)',
            [id, device_id, is_resolved ? 1 : 0]);

        const countRow = await dbGet('SELECT COUNT(*) as c FROM confirmations WHERE incident_id = $1', [id]);
        const count = parseInt(countRow.c);

        await dbRun('UPDATE incidents SET confirmations_count = $1 WHERE id = $2', [count, id]);

        if (is_resolved && count >= 3) {
            await dbRun("UPDATE incidents SET is_active = 0, resolved_at = NOW() WHERE id = $1", [id]);
            broadcast({ type: 'incident_resolved', id: Number(id) });
        }

        const updated = await dbGet('SELECT * FROM incidents WHERE id = $1', [id]);
        broadcast({ type: 'incident_updated', incident: normalizeIncident(updated) });
        res.json(normalizeIncident(updated));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/v1/ai/validate
app.post('/api/v1/ai/validate', async (req, res) => {
    const { photo_base64, incident_type, description } = req.body;
    if (!photo_base64) return res.status(400).json({ error: 'photo_base64 міндетті' });
    const result = await validateWithAI(photo_base64, incident_type || 'unknown', description || '');
    res.json(result);
});

// GET /api/v1/livestock
app.get('/api/v1/livestock', async (_req, res) => {
    try {
        const rows = await dbAll('SELECT * FROM livestock ORDER BY last_updated DESC');
        res.json(rows.map(normalizeLivestock));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/v1/devices/register
app.post('/api/v1/devices/register', async (req, res) => {
    const { device_id, fcm_token, phone_number, latitude, longitude } = req.body;
    if (!device_id) return res.status(400).json({ error: 'device_id міндетті' });

    try {
        const existing = await dbGet('SELECT id FROM devices WHERE device_id = $1', [device_id]);
        if (existing) {
            await dbRun(`UPDATE devices SET fcm_token = COALESCE($1, fcm_token),
                   phone_number = COALESCE($2, phone_number),
                   latitude = COALESCE($3, latitude), longitude = COALESCE($4, longitude),
                   last_seen = NOW() WHERE device_id = $5`,
                [fcm_token || null, phone_number || null, latitude || null, longitude || null, device_id]);
        } else {
            await dbRun('INSERT INTO devices (device_id, fcm_token, phone_number, latitude, longitude) VALUES ($1,$2,$3,$4,$5)',
                [device_id, fcm_token || null, phone_number || null, latitude || null, longitude || null]);
        }
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/v1/devices/location
app.post('/api/v1/devices/location', async (req, res) => {
    try {
        const { device_id, latitude, longitude } = req.body;
        await dbRun("UPDATE devices SET latitude = $1, longitude = $2, last_seen = NOW() WHERE device_id = $3",
            [latitude, longitude, device_id]);
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── Normalizers ───────────────────────────────────────────────────────────
function normalizeIncident(row) {
    if (!row) return null;
    return {
        ...row, is_active: !!row.is_active, ai_verified: !!row.ai_verified,
        ai_confidence: row.ai_confidence != null ? row.ai_confidence : undefined
    };
}

function normalizeLivestock(row) {
    if (!row) return null;
    return {
        id: `ls-${row.id}`, ownerId: row.owner_id, ownerName: row.owner_name,
        ownerPhone: row.owner_phone || '', type: row.type, count: row.count,
        name: row.name, chipId: row.chip_id || undefined,
        latitude: row.latitude, longitude: row.longitude,
        lastUpdated: row.last_updated, isNearRoad: !!row.is_near_road,
        distanceToRoadM: row.distance_to_road_m, routeId: row.route_id || undefined,
        trackingMode: row.tracking_mode,
    };
}

// ── HTTP + WebSocket Server ───────────────────────────────────────────────
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws/live' });
const clients = new Set();

wss.on('connection', async (ws) => {
    clients.add(ws);
    console.log(`[WS] Client connected (total: ${clients.size})`);
    try {
        const incidents = await dbAll('SELECT * FROM incidents WHERE is_active = 1 ORDER BY created_at DESC LIMIT 50');
        ws.send(JSON.stringify({ type: 'snapshot', incidents: incidents.map(normalizeIncident), timestamp: new Date().toISOString() }));
    } catch (err) {
        console.error('[WS] Snapshot error:', err);
    }
    ws.on('close', () => { clients.delete(ws); });
});

function broadcast(data) {
    const msg = JSON.stringify(data);
    for (const client of clients) {
        if (client.readyState === 1) client.send(msg);
    }
}


// ── Start ─────────────────────────────────────────────────────────────────
async function main() {
    await initDB();
    server.listen(PORT, () => {
        console.log(`\n  🛡️  SafeRoute API on port ${PORT}`);
        console.log(`  🤖 AI: ${OPENAI_KEY ? 'GPT-4o Vision ACTIVE' : 'NO API KEY — mock AI'}\n`);
    });
}
main().catch(console.error);
