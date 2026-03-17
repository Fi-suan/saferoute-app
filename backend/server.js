/**
 * SafeRoute / Sapa Jol — Backend Server
 *
 * Express.js + sql.js (pure JS SQLite) + OpenAI GPT-4o Vision
 * Deploy: Render.com (Web Service)
 */

const express = require('express');
const cors = require('cors');
const initSqlJs = require('sql.js');
const { WebSocketServer } = require('ws');
const fs = require('fs');
const path = require('path');
const http = require('http');

// ── Config ────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 8000;
const OPENAI_KEY = process.env.OPENAI_API_KEY || '';
const DB_FILE = process.env.DB_PATH || path.join(__dirname, 'saferoute.db');

let db; // sql.js database instance

// ── Helper: save DB to disk periodically ──────────────────────────────────
function saveDB() {
    if (!db) return;
    try {
        const data = db.export();
        const buffer = Buffer.from(data);
        fs.writeFileSync(DB_FILE, buffer);
    } catch (e) {
        console.error('[DB] Save error:', e.message);
    }
}

// ── Database Init ─────────────────────────────────────────────────────────
async function initDB() {
    const SQL = await initSqlJs();

    // Load existing DB or create new
    if (fs.existsSync(DB_FILE)) {
        const fileBuffer = fs.readFileSync(DB_FILE);
        db = new SQL.Database(fileBuffer);
        console.log('[DB] Loaded existing database');
    } else {
        db = new SQL.Database();
        console.log('[DB] Created new database');
    }

    // Run schema
    const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
    db.run(schema);
    saveDB();
}

// ── DB Helpers (sql.js uses different API) ────────────────────────────────
function dbAll(sql, params = []) {
    const stmt = db.prepare(sql);
    if (params.length) stmt.bind(params);
    const rows = [];
    while (stmt.step()) rows.push(stmt.getAsObject());
    stmt.free();
    return rows;
}

function dbGet(sql, params = []) {
    const rows = dbAll(sql, params);
    return rows[0] || null;
}

function dbRun(sql, params = []) {
    db.run(sql, params);
    saveDB();
    return { lastInsertRowid: dbGet('SELECT last_insert_rowid() as id')?.id };
}

// ── Express App ───────────────────────────────────────────────────────────
const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// ── Health Check ──────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
    const row = dbGet('SELECT COUNT(*) as c FROM incidents');
    res.json({ status: 'ok', incidents: row?.c || 0, timestamp: new Date().toISOString() });
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
app.get('/api/v1/incidents/active', (_req, res) => {
    const rows = dbAll('SELECT * FROM incidents WHERE is_active = 1 ORDER BY created_at DESC LIMIT 100');
    res.json(rows.map(normalizeIncident));
});

// GET /api/v1/incidents/feed
app.get('/api/v1/incidents/feed', (_req, res) => {
    const rows = dbAll('SELECT * FROM incidents ORDER BY created_at DESC LIMIT 200');
    res.json(rows.map(normalizeIncident));
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

        dbRun(
            `INSERT INTO incidents (incident_type, description, severity, latitude, longitude,
                                    reporter_device_id, ai_verified, ai_confidence, ai_analysis, photo_url)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [incident_type, description || null, severity || 3, latitude, longitude,
                reporter_device_id || null, aiResult.verified ? 1 : 0, aiResult.confidence,
                aiResult.analysis, photoUrl]
        );

        const created = dbGet('SELECT * FROM incidents ORDER BY id DESC LIMIT 1');
        broadcast({ type: 'new_incident', incident: normalizeIncident(created) });
        res.status(201).json(normalizeIncident(created));
    } catch (err) {
        console.error('[Report]', err);
        res.status(500).json({ error: err.message });
    }
});

// POST /api/v1/incidents/:id/confirm
app.post('/api/v1/incidents/:id/confirm', (req, res) => {
    const { id } = req.params;
    const { device_id, is_resolved } = req.body;

    if (!device_id) return res.status(400).json({ error: 'device_id міндетті' });

    try {
        const existing = dbGet(
            'SELECT id FROM confirmations WHERE incident_id = ? AND device_id = ?', [id, device_id]
        );
        if (existing) return res.status(409).json({ error: 'Бұрын растағансыз' });

        dbRun('INSERT INTO confirmations (incident_id, device_id, is_resolved) VALUES (?, ?, ?)',
            [id, device_id, is_resolved ? 1 : 0]);

        const count = dbGet('SELECT COUNT(*) as c FROM confirmations WHERE incident_id = ?', [id]);
        dbRun('UPDATE incidents SET confirmations_count = ? WHERE id = ?', [count.c, id]);

        if (is_resolved && count.c >= 3) {
            dbRun("UPDATE incidents SET is_active = 0, resolved_at = datetime('now') WHERE id = ?", [id]);
            broadcast({ type: 'incident_resolved', id: Number(id) });
        }

        const updated = dbGet('SELECT * FROM incidents WHERE id = ?', [id]);
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
app.get('/api/v1/livestock', (_req, res) => {
    const rows = dbAll('SELECT * FROM livestock ORDER BY last_updated DESC');
    res.json(rows.map(normalizeLivestock));
});

// POST /api/v1/devices/register
app.post('/api/v1/devices/register', (req, res) => {
    const { device_id, fcm_token, phone_number, latitude, longitude } = req.body;
    if (!device_id) return res.status(400).json({ error: 'device_id міндетті' });

    const existing = dbGet('SELECT id FROM devices WHERE device_id = ?', [device_id]);
    if (existing) {
        dbRun(`UPDATE devices SET fcm_token = COALESCE(?, fcm_token),
               phone_number = COALESCE(?, phone_number),
               latitude = COALESCE(?, latitude), longitude = COALESCE(?, longitude),
               last_seen = datetime('now') WHERE device_id = ?`,
            [fcm_token || null, phone_number || null, latitude || null, longitude || null, device_id]);
    } else {
        dbRun('INSERT INTO devices (device_id, fcm_token, phone_number, latitude, longitude) VALUES (?,?,?,?,?)',
            [device_id, fcm_token || null, phone_number || null, latitude || null, longitude || null]);
    }
    res.json({ ok: true });
});

// POST /api/v1/devices/location
app.post('/api/v1/devices/location', (req, res) => {
    const { device_id, latitude, longitude } = req.body;
    dbRun("UPDATE devices SET latitude = ?, longitude = ?, last_seen = datetime('now') WHERE device_id = ?",
        [latitude, longitude, device_id]);
    res.json({ ok: true });
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

wss.on('connection', (ws) => {
    clients.add(ws);
    console.log(`[WS] Client connected (total: ${clients.size})`);
    const incidents = dbAll('SELECT * FROM incidents WHERE is_active = 1 ORDER BY created_at DESC LIMIT 50');
    ws.send(JSON.stringify({ type: 'snapshot', incidents: incidents.map(normalizeIncident), timestamp: new Date().toISOString() }));
    ws.on('close', () => { clients.delete(ws); });
});

function broadcast(data) {
    const msg = JSON.stringify(data);
    for (const client of clients) {
        if (client.readyState === 1) client.send(msg);
    }
}

// ── Auto-save DB every 30 seconds ─────────────────────────────────────────
setInterval(saveDB, 30000);

// ── Start ─────────────────────────────────────────────────────────────────
async function main() {
    await initDB();
    server.listen(PORT, () => {
        console.log(`\n  🛡️  SafeRoute API on port ${PORT}`);
        console.log(`  🤖 AI: ${OPENAI_KEY ? 'GPT-4o Vision ACTIVE' : 'NO API KEY — mock AI'}\n`);
    });
}
main().catch(console.error);
