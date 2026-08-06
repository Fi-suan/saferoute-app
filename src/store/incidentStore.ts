/**
 * incidentStore.ts — общее состояние инцидентов + сеть и офлайн-очередь.
 *
 * Здесь же живёт поллинг: раньше каждый экран с useIncidents заводил свой
 * setInterval, и три смонтированных вкладки давали тройную нагрузку и три
 * параллельных разбора офлайн-очереди. Теперь таймер один на приложение,
 * с подсчётом подписчиков.
 *
 * Три списка вместо одного:
 *  - active  — из /incidents/active, поллится, источник для карты;
 *  - feed    — из /incidents/feed, грузится по требованию (история);
 *  - pending — оптимистичные метки, ещё не подтверждённые сервером.
 *
 * Раньше active и feed писались в один массив, и вкладки затирали данные
 * друг друга каждые 10 секунд. Отдельная корзина pending нужна, чтобы
 * оптимистичная метка имела явный жизненный цикл и не оседала на карте
 * навсегда при неудачной отправке.
 */
import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import api from '../services/api';
import { Config } from '../config';
import { STORAGE } from '../constants/storage';
import { Incident } from '../constants/incidents';
import { getDeviceId } from '../services/deviceId';

export interface SubmitReportParams {
    incident_type: string;
    description: string;
    severity: number;
    latitude: number;
    longitude: number;
    photo_base64?: string;
    photo_uri?: string;
}

interface QueuedReport extends SubmitReportParams {
    queuedAt: string;
    /** id оптимистичной метки — чтобы снять её после успешной отправки */
    localId: number;
}

interface IncidentState {
    active: Incident[];
    feed: Incident[];
    pending: Incident[];
    isOnline: boolean;
    pendingReportsCount: number;
}

export const useIncidentStore = create<IncidentState>(() => ({
    active: [],
    feed: [],
    pending: [],
    isOnline: false,
    pendingReportsCount: 0,
}));

const set = useIncidentStore.setState;
const get = useIncidentStore.getState;

// ── Классификация ошибок ─────────────────────────────────────────────────────

/**
 * Стоит ли повторять запрос позже.
 *
 * Важно отличать «сети нет» от «сервер отверг репорт»: раньше любая ошибка
 * трактовалась как офлайн, и невалидный репорт (422) уходил в очередь, где
 * ретраился бесконечно. 401 считаем повторяемым — устройство могло ещё не
 * дорегистрироваться после холодного старта бэкенда (см. services/registration).
 */
function isRetriable(err: unknown): boolean {
    if (!axios.isAxiosError(err)) return false;
    if (!err.response) return true; // таймаут / нет сети
    const s = err.response.status;
    return s === 401 || s === 408 || s === 429 || s >= 500;
}

function describeError(err: unknown): string {
    if (axios.isAxiosError(err)) {
        const detail = (err.response?.data as { detail?: unknown } | undefined)?.detail;
        if (typeof detail === 'string') return detail;
        if (err.response) return `Сервер қатесі (${err.response.status})`;
    }
    return 'Белгісіз қате';
}

// ── Офлайн-очередь ───────────────────────────────────────────────────────────

async function loadQueue(): Promise<QueuedReport[]> {
    try {
        const raw = await AsyncStorage.getItem(STORAGE.REPORT_QUEUE);
        return raw ? JSON.parse(raw) : [];
    } catch { return []; }
}

async function saveQueue(queue: QueuedReport[]): Promise<void> {
    try {
        await AsyncStorage.setItem(STORAGE.REPORT_QUEUE, JSON.stringify(queue));
    } catch { /* ignore */ }
}

function toPayload(r: SubmitReportParams): Record<string, unknown> {
    // photo_uri и служебные поля очереди на сервер не отправляем.
    const payload: Record<string, unknown> = {
        incident_type: r.incident_type,
        description: r.description,
        severity: r.severity,
        latitude: r.latitude,
        longitude: r.longitude,
    };
    if (r.photo_base64) payload.photo_base64 = r.photo_base64;
    return payload;
}

let _flushing = false;

/** Досылает накопленные репорты. Single-flight: параллельные вызовы схлопываются. */
async function flushQueue(): Promise<void> {
    if (_flushing) return;
    _flushing = true;
    try {
        const queue = await loadQueue();
        if (queue.length === 0) {
            if (get().pendingReportsCount !== 0) set({ pendingReportsCount: 0 });
            return;
        }

        const failed: QueuedReport[] = [];
        const settled: number[] = [];
        for (const report of queue) {
            try {
                await api.post('/incidents/report', toPayload(report), { timeout: 8000 });
                settled.push(report.localId);
            } catch (err) {
                if (isRetriable(err)) {
                    failed.push(report);
                } else {
                    // Сервер отверг репорт — держать его в очереди бессмысленно.
                    console.warn('[incidents] репорт отклонён сервером, убран из очереди:', describeError(err));
                    settled.push(report.localId);
                }
            }
        }

        await saveQueue(failed);
        set((s) => ({
            pending: s.pending.filter((p) => !settled.includes(p.id)),
            pendingReportsCount: failed.length,
        }));
    } finally {
        _flushing = false;
    }
}

// ── Загрузка с сервера ───────────────────────────────────────────────────────

let _activeInFlight: Promise<void> | null = null;
let _feedInFlight: Promise<void> | null = null;

/** Активные инциденты — то, что показывает карта. При обрыве связи список сохраняется. */
export function refreshActive(): Promise<void> {
    if (_activeInFlight) return _activeInFlight;
    _activeInFlight = (async () => {
        try {
            const res = await api.get<Incident[]>('/incidents/active', { timeout: 8000 });
            if (Array.isArray(res.data)) {
                set({ active: res.data, isOnline: true });
                await flushQueue();
            }
        } catch {
            set({ isOnline: false });
        } finally {
            _activeInFlight = null;
        }
    })();
    return _activeInFlight;
}

/** Лента вместе с закрытыми инцидентами. Без поллинга — история не портится за 10 секунд. */
export function refreshFeed(): Promise<void> {
    if (_feedInFlight) return _feedInFlight;
    _feedInFlight = (async () => {
        try {
            const res = await api.get<Incident[]>('/incidents/feed', { timeout: 8000 });
            if (Array.isArray(res.data)) {
                set({ feed: res.data, isOnline: true });
                await flushQueue();
            }
        } catch {
            set({ isOnline: false });
        } finally {
            _feedInFlight = null;
        }
    })();
    return _feedInFlight;
}

// ── Общий поллер ─────────────────────────────────────────────────────────────

let _pollTimer: ReturnType<typeof setInterval> | null = null;
let _pollSubscribers = 0;

/**
 * Подписывает экран на общий поллинг активных инцидентов.
 * @returns функцию отписки — таймер гаснет, когда уходит последний подписчик.
 */
export function acquireActivePolling(): () => void {
    _pollSubscribers += 1;
    if (_pollSubscribers === 1) {
        refreshActive();
        _pollTimer = setInterval(() => { refreshActive(); }, Config.INCIDENTS_POLL_INTERVAL_MS);
    }
    return () => {
        _pollSubscribers = Math.max(0, _pollSubscribers - 1);
        if (_pollSubscribers === 0 && _pollTimer) {
            clearInterval(_pollTimer);
            _pollTimer = null;
        }
    };
}

// ── Действия ─────────────────────────────────────────────────────────────────

export interface SubmitResult {
    ok: boolean;
    error?: string;
    queued?: boolean;
}

export async function submitReport(params: SubmitReportParams): Promise<SubmitResult> {
    const localId = -Date.now();
    const optimistic: Incident = {
        id: localId,
        incident_type: params.incident_type as Incident['incident_type'],
        description: params.description || null,
        severity: params.severity,
        latitude: params.latitude,
        longitude: params.longitude,
        is_active: true,
        ai_verified: false,
        ai_analysis: 'AI тексеруде...',
        ai_confidence: undefined,
        confirmations_count: 0,
        created_at: new Date().toISOString(),
        resolved_at: null,
        photo_uri: params.photo_uri,
    };
    set((s) => ({ pending: [optimistic, ...s.pending] }));

    try {
        const res = await api.post<Incident>('/incidents/report', toPayload(params), { timeout: 8000 });
        set((s) => ({
            pending: s.pending.filter((p) => p.id !== localId),
            active: [res.data, ...s.active.filter((i) => i.id !== res.data.id)],
        }));
        refreshActive();
        return { ok: true };
    } catch (err) {
        if (!isRetriable(err)) {
            // Метку надо снять — иначе она зависнет на карте навсегда.
            set((s) => ({ pending: s.pending.filter((p) => p.id !== localId) }));
            return { ok: false, error: describeError(err) };
        }
        const queue = await loadQueue();
        queue.push({ ...params, queuedAt: new Date().toISOString(), localId });
        await saveQueue(queue);
        set({ pendingReportsCount: queue.length });
        return { ok: true, queued: true };
    }
}

function applyConfirm(i: Incident, isResolved: boolean): Incident {
    const count = i.confirmations_count + 1;
    return {
        ...i,
        confirmations_count: count,
        is_active: isResolved ? count < Config.CONFIRMATIONS_TO_RESOLVE : true,
    };
}

export async function confirmIncident(id: number, isResolved: boolean): Promise<void> {
    const deviceId = await getDeviceId();
    set((s) => ({
        active: s.active.map((i) => (i.id === id ? applyConfirm(i, isResolved) : i)),
        feed: s.feed.map((i) => (i.id === id ? applyConfirm(i, isResolved) : i)),
    }));
    try {
        // device_id обязателен по схеме, но сервер берёт его из токена.
        await api.post(
            `/incidents/${id}/confirm`,
            { device_id: deviceId, is_resolved: isResolved },
            { timeout: 4000 },
        );
        await refreshActive();
    } catch { /* стор уже обновлён оптимистично */ }
}

// Счётчик неотправленных репортов виден сразу после запуска.
loadQueue()
    .then((q) => set({ pendingReportsCount: q.length }))
    .catch(() => { /* ignore */ });
