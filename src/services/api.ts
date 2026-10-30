/**
 * API Layer — SafeRoute / Sapa Jol
 *
 * Supabase (Postgres + PostgREST + Realtime + RPC) is the app's only backend.
 * The previous FastAPI middle layer (backend/) is retired: every function below
 * talks to Supabase directly via the shared client in ./supabase.
 *
 * Enum normalization: Postgres enum labels are stored UPPERCASE ('ANIMAL'),
 * while the app expects lowercase ('animal'). Insert helpers convert the
 * other way. Timestamps are returned as ISO strings.
 */
import * as Crypto from 'expo-crypto';
import { supabase } from './supabase';
import { Incident } from '../constants/incidents';

/** Demo-grade password hashing (SHA-256, salted with phone). */
export async function hashPassword(phone: string, password: string): Promise<string> {
    return Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        `saferoute:${phone}:${password}`,
    );
}

// ── Types ──────────────────────────────────────────────────────────────────────
export type AnimalType = 'saiga' | 'horse' | 'camel' | 'other';
export type AlertLevel = 'low' | 'medium' | 'high' | 'critical';

export interface HerdLocation {
    id?: number;
    herd_id: number;
    latitude: number;
    longitude: number;
    speed_kmh: number;
    heading_degrees: number | null;
    timestamp: string;
    source: string;
}

export interface Herd {
    id: number;
    name: string;
    animal_type: AnimalType;
    estimated_count: number;
    owner_name: string | null;
    is_active: boolean;
    created_at: string;
    current_location: HerdLocation | null;
}

export interface Alert {
    id: number;
    herd_id: number;
    geozone_id: number;
    level: AlertLevel;
    message_ru: string;
    message_kk: string;
    distance_to_road_km: number | null;
    estimated_arrival_minutes: number | null;
    is_active: boolean;
    notified_count: number;
    created_at: string;
    resolved_at: string | null;
    herd_name?: string;
    herd_animal_type?: string;
    geozone_name?: string;
}

export interface GeoZone {
    id: number;
    name: string;
    road_type: string;
    buffer_km: number;
    is_active: boolean;
    lat_min: number;
    lat_max: number;
    lon_min: number;
    lon_max: number;
    road_lat: number;
    road_lon: number;
}

export interface IncidentRow {
    id: number;
    incident_type: string;
    description: string | null;
    severity: number;
    photo_url: string | null;
    reporter_device_id: string | null;
    ai_verified: boolean;
    ai_confidence: number | null;
    ai_analysis: string | null;
    ai_severity_suggestion: number | null;
    latitude: number;
    longitude: number;
    route_id: string | null;
    confirmations_count: number;
    is_active: boolean;
    created_at: string | null;
    resolved_at: string | null;
}

/** PostgREST returns naive UTC timestamps; JS would parse them as local. */
function toIso(s: string | null | undefined): string {
    if (!s) return new Date().toISOString();
    return /[zZ]|[+-]\d{2}:?\d{2}$/.test(s) ? s : s + 'Z';
}

/** Postgres enum label ('ANIMAL') → app value ('animal') */
function lowerEnum<T extends string>(v: string | null | undefined, fallback: T): T {
    return (v?.toLowerCase() as T) ?? fallback;
}

function normalizeIncident(row: IncidentRow): Incident {
    return {
        id: row.id,
        incident_type: lowerEnum(row.incident_type, 'other'),
        description: row.description ?? null,
        severity: row.severity ?? 3,
        latitude: row.latitude,
        longitude: row.longitude,
        route_id: row.route_id ?? null,
        is_active: row.is_active,
        ai_verified: row.ai_verified ?? false,
        ai_analysis: row.ai_analysis ?? null,
        ai_confidence: row.ai_confidence ?? undefined,
        ai_severity_suggestion: row.ai_severity_suggestion ?? undefined,
        reporter_device_id: row.reporter_device_id ?? null,
        confirmations_count: row.confirmations_count ?? 0,
        created_at: toIso(row.created_at),
        resolved_at: row.resolved_at ? toIso(row.resolved_at) : null,
        photo_url: row.photo_url ?? undefined,
    };
}

// ── Herds ──────────────────────────────────────────────────────────────────────
export async function getHerds(): Promise<Herd[]> {
    const [herdsRes, locsRes] = await Promise.all([
        supabase.from('herds').select('*').eq('is_active', true),
        supabase.from('herd_latest_locations').select('*'),
    ]);
    if (herdsRes.error || !herdsRes.data) return [];

    const locByHerd = new Map<number, HerdLocation>();
    for (const l of (locsRes.data ?? []) as any[]) {
        locByHerd.set(l.herd_id, {
            herd_id: l.herd_id,
            latitude: l.latitude,
            longitude: l.longitude,
            speed_kmh: l.speed_kmh ?? 0,
            heading_degrees: l.heading_degrees ?? null,
            timestamp: l.timestamp ?? new Date().toISOString(),
            source: l.source ?? 'simulator',
        });
    }

    return (herdsRes.data as any[]).map((h) => ({
        id: h.id,
        name: h.name,
        animal_type: lowerEnum<AnimalType>(h.animal_type, 'other'),
        estimated_count: h.estimated_count ?? 1,
        owner_name: h.owner_name ?? null,
        is_active: h.is_active,
        created_at: h.created_at ?? new Date().toISOString(),
        current_location: locByHerd.get(h.id) ?? null,
    }));
}

export async function getHerdTrack(id: number, limit = 50): Promise<HerdLocation[]> {
    const { data, error } = await supabase
        .from('herd_locations')
        .select('*')
        .eq('herd_id', id)
        .order('timestamp', { ascending: false })
        .limit(limit);
    if (error || !data) return [];
    return (data as any[]).map((l) => ({
        id: l.id,
        herd_id: l.herd_id,
        latitude: l.latitude,
        longitude: l.longitude,
        speed_kmh: l.speed_kmh ?? 0,
        heading_degrees: l.heading_degrees ?? null,
        timestamp: l.timestamp,
        source: l.source ?? 'simulator',
    }));
}

/** Owner manual mode: create a herd so other users see it on the map */
export async function createHerd(params: {
    name: string;
    animal_type: string;
    estimated_count: number;
    owner_name?: string | null;
}): Promise<number | null> {
    const KNOWN: AnimalType[] = ['saiga', 'horse', 'camel'];
    const raw = params.animal_type.toLowerCase() as AnimalType;
    const animalType = KNOWN.includes(raw) ? raw : 'other';
    const { data, error } = await supabase
        .from('herds')
        .insert({
            name: params.name,
            animal_type: animalType.toUpperCase(),
            estimated_count: params.estimated_count,
            owner_name: params.owner_name ?? 'manual',
            is_active: true,
        })
        .select('id')
        .single();
    if (error || !data) return null;
    return data.id;
}

export async function insertHerdLocation(
    herdId: number,
    point: { latitude: number; longitude: number; speed_kmh?: number; source?: string },
): Promise<boolean> {
    const { error } = await supabase.from('herd_locations').insert({
        herd_id: herdId,
        latitude: point.latitude,
        longitude: point.longitude,
        speed_kmh: point.speed_kmh ?? 0,
        source: point.source ?? 'manual',
    });
    return !error;
}

export async function deactivateHerd(herdId: number): Promise<void> {
    await supabase.from('herds').update({ is_active: false }).eq('id', herdId);
}

// ── Alerts ─────────────────────────────────────────────────────────────────────
async function fetchAlerts(eqActive: boolean, limit = 50): Promise<Alert[]> {
    let q = supabase
        .from('alerts')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);
    if (eqActive) q = q.eq('is_active', true);
    const { data, error } = await q;
    if (error || !data) return [];
    return (data as any[]).map((a) => ({
        id: a.id,
        herd_id: a.herd_id,
        geozone_id: a.geozone_id,
        level: lowerEnum<AlertLevel>(a.level, 'medium'),
        message_ru: a.message_ru ?? '',
        message_kk: a.message_kk ?? '',
        distance_to_road_km: a.distance_to_road_km ?? null,
        estimated_arrival_minutes: a.estimated_arrival_minutes ?? null,
        is_active: a.is_active,
        notified_count: a.notified_count ?? 0,
        created_at: a.created_at ?? new Date().toISOString(),
        resolved_at: a.resolved_at ?? null,
    }));
}

export const getActiveAlerts = () => fetchAlerts(true);
export const getAlertHistory = (limit = 50) => fetchAlerts(false, limit);

// ── GeoZones ───────────────────────────────────────────────────────────────────
export async function getGeozones(): Promise<GeoZone[]> {
    const { data, error } = await supabase.from('geozones').select('*').eq('is_active', true);
    if (error || !data) return [];
    return (data as any[]).map((z) => ({
        id: z.id,
        name: z.name,
        road_type: z.road_type ?? 'highway',
        buffer_km: z.buffer_km ?? 5,
        is_active: z.is_active,
        lat_min: z.lat_min ?? 0,
        lat_max: z.lat_max ?? 0,
        lon_min: z.lon_min ?? 0,
        lon_max: z.lon_max ?? 0,
        road_lat: z.road_lat ?? 0,
        road_lon: z.road_lon ?? 0,
    }));
}

/** Rectangle GeoJSON built client-side (same shape as the old backend endpoint) */
export async function getGeozonesGeoJSON(): Promise<{ type: string; features: unknown[] }> {
    const zones = await getGeozones();
    return {
        type: 'FeatureCollection',
        features: zones.map((zone) => ({
            type: 'Feature',
            properties: {
                id: zone.id,
                name: zone.name,
                road_type: zone.road_type,
                buffer_km: zone.buffer_km,
                layer: 'buffer_zone',
            },
            geometry: {
                type: 'Polygon',
                coordinates: [
                    [
                        [zone.lon_min, zone.lat_min],
                        [zone.lon_max, zone.lat_min],
                        [zone.lon_max, zone.lat_max],
                        [zone.lon_min, zone.lat_max],
                        [zone.lon_min, zone.lat_min],
                    ],
                ],
            },
        })),
    };
}

// ── Incidents ──────────────────────────────────────────────────────────────────

/** base64 → Uint8Array без atob (в RN его нет). */
function base64ToBytes(b64: string): Uint8Array {
    const lookup = new Uint8Array(256).fill(255);
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    for (let i = 0; i < chars.length; i++) lookup[chars.charCodeAt(i)] = i;
    lookup['='.charCodeAt(0)] = 0;

    let out = new Uint8Array(Math.floor((b64.length * 3) / 4));
    let o = 0;
    let buffer = 0;
    let bits = 0;
    for (let i = 0; i < b64.length; i++) {
        const v = lookup[b64.charCodeAt(i)];
        if (v === 255) continue;
        buffer = (buffer << 6) | v;
        bits += 6;
        if (bits >= 8) {
            bits -= 8;
            out[o++] = (buffer >> bits) & 0xff;
        }
    }
    return o === out.length ? out : out.subarray(0, o);
}

/** Загружает фото отчёта в Supabase Storage, возвращает публичный URL. */
export async function uploadIncidentPhoto(
    base64: string,
    deviceId: string,
): Promise<string | null> {
    try {
        const path = `${deviceId}/${Date.now()}.jpg`;
        const { error } = await supabase.storage
            .from('incident-photos')
            .upload(path, base64ToBytes(base64), { contentType: 'image/jpeg', upsert: false });
        if (error) return null;
        const { data } = supabase.storage.from('incident-photos').getPublicUrl(path);
        return data.publicUrl ?? null;
    } catch {
        return null;
    }
}

export async function fetchIncidents(tab: 'active' | 'all' = 'active'): Promise<Incident[]> {
    let q = supabase
        .from('incident_reports')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);
    if (tab === 'active') q = q.eq('is_active', true);
    const { data, error } = await q;
    if (error || !data) return [];
    return (data as IncidentRow[]).map(normalizeIncident);
}

export async function submitIncidentReport(params: {
    incident_type: string;
    description: string;
    severity: number;
    latitude: number;
    longitude: number;
    reporter_device_id: string;
    route_id?: string | null;
    photo_url?: string | null;
}): Promise<Incident | null> {
    const type = params.incident_type.toLowerCase();
    const { data, error } = await supabase
        .from('incident_reports')
        .insert({
            incident_type: type.toUpperCase(),
            description: params.description || null,
            severity: params.severity,
            latitude: params.latitude,
            longitude: params.longitude,
            reporter_device_id: params.reporter_device_id,
            route_id: params.route_id ?? null,
            photo_url: params.photo_url ?? null,
            ai_verified: false,
            ai_analysis: 'AI тексеруі демо режимінде өшірілген — қоғамдастық растауын күтуде.',
            is_active: true,
            confirmations_count: 0,
        })
        .select()
        .single();
    if (error || !data) return null;
    return normalizeIncident(data as IncidentRow);
}

/** Live incident by id (used by the detail screen for realtime updates) */
export async function getIncidentById(id: number): Promise<Incident | null> {
    const { data, error } = await supabase
        .from('incident_reports')
        .select('*')
        .eq('id', id)
        .maybeSingle();
    if (error || !data) return null;
    return normalizeIncident(data as IncidentRow);
}

export async function confirmIncidentOnServer(
    incidentId: number,
    deviceId: string,
    isResolved: boolean,
): Promise<void> {
    await supabase.rpc('confirm_incident', {
        p_incident_id: incidentId,
        p_device_id: deviceId,
        p_is_resolved: isResolved,
    });
}

// ── Devices ────────────────────────────────────────────────────────────────────
export interface RegisterDeviceParams {
    device_id: string;
    role?: string;
    name?: string;
    password_hash?: string;
    fcm_token?: string;
    phone_number?: string;
    latitude?: number;
    longitude?: number;
}

/** Register/refresh device row via SECURITY DEFINER RPC.
 *  Null поля не затирают существующие (в отличие от старого PostgREST upsert). */
export async function registerDevice(data: RegisterDeviceParams): Promise<{ ok: boolean }> {
    const { error } = await supabase.rpc('register_device', {
        p_device_id: data.device_id,
        p_role: data.role === 'owner' ? 'OWNER' : 'DRIVER',
        p_name: data.name ?? null,
        p_password_hash: data.password_hash ?? null,
        p_fcm_token: data.fcm_token ?? null,
        p_phone_number: data.phone_number?.replace(/\s/g, '') ?? null,
    });
    return { ok: !error };
}

/** Refresh FCM token without touching account fields. */
export async function updateFcmToken(deviceId: string, fcmToken: string): Promise<void> {
    await supabase.rpc('update_fcm_token', { p_device_id: deviceId, p_fcm_token: fcmToken });
}

export type AppRole = 'driver' | 'livestock_owner';

export interface LoginResult {
    name: string;
    phone: string;
    role: AppRole;
}

/** Sign in an existing account by phone + password.
 *  Hash comparison happens server-side (login_device RPC); the devices table
 *  is not readable by clients at all. The hash salt is the phone as typed at
 *  registration, so we send candidate hashes for every plausible format. */
export async function loginWithPhone(phone: string, password: string): Promise<LoginResult | null> {
    const digits = phone.replace(/\s/g, '');
    const tail = digits.slice(-10);
    const salts = [...new Set([digits, `+7${tail}`, `8${tail}`, `7${tail}`, tail])];
    const candidates: string[] = [];
    for (const salt of salts) {
        candidates.push(await hashPassword(salt, password));
    }
    const { data, error } = await supabase.rpc('login_device', {
        p_phone: digits,
        p_password_hashes: candidates,
    });
    if (error || !data?.ok) return null;
    return {
        name: data.name || 'Пайдаланушы',
        phone: data.phone ?? digits,
        role: data.role?.toLowerCase?.() === 'owner' ? 'livestock_owner' : 'driver',
    };
}

/** Kept for call-site compatibility — registration no longer returns a token */
export async function ensureDeviceRegistered(
    role: string = 'driver',
    phoneNumber?: string,
): Promise<string | null> {
    try {
        const { getDeviceId } = await import('./deviceId');
        const deviceId = await getDeviceId();
        await registerDevice({
            device_id: deviceId,
            role: role === 'livestock_owner' ? 'owner' : 'driver',
            phone_number: phoneNumber,
        });
    } catch (e) {
        console.warn('[Auth] ensureDeviceRegistered error:', e);
    }
    return null;
}

export async function updateDeviceLocation(
    device_id: string,
    latitude: number,
    longitude: number,
): Promise<void> {
    await supabase.rpc('touch_device_location', {
        p_device_id: device_id,
        p_latitude: latitude,
        p_longitude: longitude,
    });
}

// ── User Data Deletion (GDPR) ─────────────────────────────────────────────────
export async function deleteUserData(device_id: string): Promise<void> {
    await supabase.rpc('delete_user_data', { p_device_id: device_id });
}
