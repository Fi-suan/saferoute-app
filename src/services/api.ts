import axios from 'axios';
import { Config } from '../config';
import { getAuthToken } from './auth';

const api = axios.create({
    baseURL: `${Config.BACKEND_URL}/api/v1`,
    timeout: 10000,
    headers: { 'Content-Type': 'application/json' },
});

// Attach JWT token to every request
api.interceptors.request.use(async (config) => {
    const token = await getAuthToken();
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// ── Types ──────────────────────────────────────────────────────────────────────
export type AnimalType = 'saiga' | 'horse' | 'camel' | 'other';
export type AlertLevel = 'low' | 'medium' | 'high' | 'critical';

export interface HerdLocation {
    id: number;
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
}

// ── Herds ──────────────────────────────────────────────────────────────────────
export const getHerds = () => api.get<Herd[]>('/herds').then(r => r.data);
export const getHerdTrack = (id: number, limit = 50) =>
    api.get<HerdLocation[]>(`/herds/${id}/track?limit=${limit}`).then(r => r.data);

// ── Alerts ─────────────────────────────────────────────────────────────────────
export const getActiveAlerts = () => api.get<Alert[]>('/alerts/active').then(r => r.data);
export const getAlertHistory = (limit = 50) =>
    api.get<Alert[]>(`/alerts/history?limit=${limit}`).then(r => r.data);

// ── GeoZones ───────────────────────────────────────────────────────────────────
export const getGeozonesGeoJSON = () => api.get('/geozones/geojson').then(r => r.data);

// ── Devices ────────────────────────────────────────────────────────────────────
export const registerDevice = (data: {
    device_id: string;
    role?: string;
    fcm_token?: string;
    phone_number?: string;
    latitude?: number;
    longitude?: number;
}) => api.post('/auth/register', data).then(r => r.data);

export const updateDeviceLocation = (device_id: string, latitude: number, longitude: number) =>
    api.post('/devices/location', { device_id, latitude, longitude }).then(r => r.data);

// ── User Data Deletion (GDPR) ─────────────────────────────────────────────────
export const deleteUserData = (device_id: string) =>
    api.delete(`/devices/${device_id}/data`).then(r => r.data);

// ── Simulator ──────────────────────────────────────────────────────────────────
export const triggerSimulatorTick = (steps = 1) =>
    api.post(`/simulator/tick?steps=${steps}`).then(r => r.data);

export const getSimulatorStatus = () => api.get('/simulator/status').then(r => r.data);

export default api;
