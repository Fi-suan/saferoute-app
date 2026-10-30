/**
 * useIncidents Hook — SafeRoute / Sapa Jol
 *
 * Shared state через incidentStore — MapScreen и AlertsScreen видят одни данные.
 * Optimistic incidents появляются сразу, заменяются реальными от сервера.
 * При офлайне — пустой список + очередь репортов (отправятся при reconnect).
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fetchIncidents, submitIncidentReport, confirmIncidentOnServer, uploadIncidentPhoto } from '../services/api';
import { Config } from '../config';
import { STORAGE } from '../constants/storage';
import { Incident } from '../constants/incidents';
import { getDeviceId } from '../services/deviceId';
import { incidentStore } from '../store/incidentStore';
import { supabase } from '../services/supabase';

/**
 * Shared realtime subscription for incident_reports.
 *
 * supabase-js returns the SAME channel instance for a repeated
 * `.channel(topic)` call, so mounting useIncidents in several screens
 * must not call `.on(...)`/`.subscribe()` again — that throws
 * "cannot add postgres_changes callbacks after subscribe()".
 * One channel lives for the whole app; screens just add/remove listeners.
 */
const incidentRealtimeListeners = new Set<() => void>();
let incidentChannel: ReturnType<typeof supabase.channel> | null = null;
let incidentChannelSeq = 0;

function subscribeIncidentChanges(cb: () => void): () => void {
    if (!incidentChannel) {
        // Unique topic: supabase-js DEDUPES channels by topic and returns the
        // already-subscribed instance on a name clash — which then throws on
        // .on(). This bit us after Fast Refresh (stale channel in the client,
        // fresh module state). A unique suffix guarantees a fresh channel.
        incidentChannel = supabase
            .channel(`incident_reports_realtime_${++incidentChannelSeq}`)
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'incident_reports' },
                () => {
                    incidentRealtimeListeners.forEach((l) => l());
                },
            )
            .subscribe();
    }
    incidentRealtimeListeners.add(cb);
    return () => {
        incidentRealtimeListeners.delete(cb);
    };
}

export interface SubmitReportParams {
    incident_type: string;
    description: string;
    severity: number;
    latitude: number;
    longitude: number;
    photo_base64?: string;
    photo_uri?: string;
    route_id?: string | null;
}

interface QueuedReport extends SubmitReportParams {
    queuedAt: string;
    /** id оптимистичной метки, чтобы убрать «призрак» после отправки */
    optimisticId?: number;
}

interface UseIncidentsReturn {
    incidents: Incident[];
    isOnline: boolean;
    loading: boolean;
    refreshing: boolean;
    refresh: () => Promise<void>;
    submitReport: (
        params: SubmitReportParams,
    ) => Promise<{ ok: boolean; error?: string; queued?: boolean }>;
    confirmIncident: (id: number, isResolved: boolean) => Promise<void>;
    pendingReportsCount: number;
}

async function fetchFromServer(
    tab: 'active' | 'all',
): Promise<{ data: Incident[]; online: boolean }> {
    try {
        const data = await fetchIncidents(tab);
        if (Array.isArray(data)) {
            return { data, online: true };
        }
    } catch {
        /* offline — вернём пустой список */
    }
    return { data: [], online: false };
}

async function loadQueue(): Promise<QueuedReport[]> {
    try {
        const raw = await AsyncStorage.getItem(STORAGE.REPORT_QUEUE);
        return raw ? JSON.parse(raw) : [];
    } catch {
        return [];
    }
}

async function saveQueue(queue: QueuedReport[]): Promise<void> {
    try {
        await AsyncStorage.setItem(STORAGE.REPORT_QUEUE, JSON.stringify(queue));
    } catch {
        /* ignore */
    }
}

// flushQueue вызывается из refresh() каждого экрана — синглтон не даёт
// двум экранам отправить одну очередь дважды (дубли строк в БД).
let flushInFlight: Promise<void> | null = null;

async function flushQueue(deviceId: string): Promise<void> {
    if (flushInFlight) return flushInFlight;
    flushInFlight = (async () => {
        const queue = await loadQueue();
        if (queue.length === 0) return;
        const failed: QueuedReport[] = [];
        for (const report of queue) {
            try {
                // Фото из офлайн-очереди загружаем перед отправкой
                let photoUrl: string | null = null;
                if (report.photo_base64) {
                    photoUrl = await uploadIncidentPhoto(report.photo_base64, deviceId);
                }
                const created = await submitIncidentReport({
                    incident_type: report.incident_type,
                    description: report.description,
                    severity: report.severity,
                    latitude: report.latitude,
                    longitude: report.longitude,
                    reporter_device_id: deviceId,
                    route_id: report.route_id ?? null,
                    photo_url: photoUrl,
                });
                // Отправлено — убираем «призрак» оптимистичной метки
                if (created && report.optimisticId != null) {
                    incidentStore.remove(report.optimisticId);
                }
            } catch {
                failed.push(report);
            }
        }
        await saveQueue(failed);
    })();
    try {
        await flushInFlight;
    } finally {
        flushInFlight = null;
    }
}

export function useIncidents(tab: 'active' | 'all' = 'active'): UseIncidentsReturn {
    const [incidents, setIncidents] = useState<Incident[]>(() => {
        const stored = incidentStore.get();
        if (stored.length === 0) return [];
        return tab === 'active' ? stored.filter((i) => i.is_active) : stored;
    });
    const [isOnline, setIsOnline] = useState(false);
    const [loading, setLoading] = useState(incidentStore.get().length === 0);
    const [refreshing, setRefreshing] = useState(false);
    const [pendingReportsCount, setPendingReportsCount] = useState(0);

    const tabRef = useRef(tab);
    tabRef.current = tab;

    // Гонка запросов: realtime-события прилетают пачкой, и ответ более
    // старого fetch может перезаписать свежий. Пропускаем устаревшие ответы.
    const refreshSeq = useRef(0);

    useEffect(() => {
        const unsubscribe = incidentStore.subscribe((all) => {
            setIncidents(tabRef.current === 'active' ? all.filter((i) => i.is_active) : all);
        });
        return unsubscribe;
    }, []);

    const refresh = useCallback(async () => {
        const seq = ++refreshSeq.current;
        const { data, online } = await fetchFromServer(tab);
        if (seq !== refreshSeq.current) return; // уже приземлился более свежий refresh
        const currentOptimistic = incidentStore
            .get()
            .filter((i) => !data.find((d) => d.id === i.id));
        incidentStore.set([...currentOptimistic, ...data]);
        setIsOnline(online);

        if (online) {
            const deviceId = await getDeviceId();
            await flushQueue(deviceId);
            const queue = await loadQueue();
            setPendingReportsCount(queue.length);
        }
    }, [tab]);

    useEffect(() => {
        setLoading(true);
        refresh().finally(() => setLoading(false));
        const interval = setInterval(refresh, Config.INCIDENTS_POLL_INTERVAL_MS);

        // Supabase Realtime subscription for instantaneous cross-device sync
        const unsubscribeRealtime = subscribeIncidentChanges(refresh);

        return () => {
            clearInterval(interval);
            unsubscribeRealtime();
        };
    }, [refresh]);

    useEffect(() => {
        loadQueue().then((q) => setPendingReportsCount(q.length));
    }, []);

    const submitReport = useCallback(
        async (
            params: SubmitReportParams,
        ): Promise<{ ok: boolean; error?: string; queued?: boolean }> => {
            const deviceId = await getDeviceId();
            // Метка привязывается к маршруту, выбранному в профиле
            const routeId =
                params.route_id ?? (await AsyncStorage.getItem(STORAGE.ACTIVE_ROUTE));

            const optimistic: Incident & { photo_uri?: string } = {
                id: -Date.now(),
                incident_type: params.incident_type as Incident['incident_type'],
                description: params.description || null,
                severity: params.severity,
                latitude: params.latitude,
                longitude: params.longitude,
                is_active: true,
                route_id: routeId,
                // Чтобы анти-спам автора (3-мин тыныштық, өз растауын сұрамау)
                // работал и для оптимистичных/офлайн меток
                reporter_device_id: deviceId,
                ai_verified: false,
                ai_analysis: params.photo_base64
                    ? 'AI метканы тексеруде...'
                    : 'Фото жоқ — қауымдастық растауын күтуде.',
                ai_confidence: undefined,
                confirmations_count: 0,
                created_at: new Date().toISOString(),
                resolved_at: null,
                photo_uri: params.photo_uri,
            };
            incidentStore.prepend(optimistic);

            try {
                // Фото: если загрузка сорвалась — метка уходит без фото
                let photoUrl: string | null = null;
                if (params.photo_base64) {
                    photoUrl = await uploadIncidentPhoto(params.photo_base64, deviceId);
                }
                const created = await submitIncidentReport({
                    incident_type: params.incident_type,
                    description: params.description,
                    severity: params.severity,
                    latitude: params.latitude,
                    longitude: params.longitude,
                    reporter_device_id: deviceId,
                    route_id: routeId,
                    photo_url: photoUrl,
                });
                if (created) {
                    incidentStore.update(optimistic.id, { ...created });
                }
                await refresh();
                return { ok: true };
            } catch {
                const queue = await loadQueue();
                queue.push({ ...params, queuedAt: new Date().toISOString(), optimisticId: optimistic.id });
                await saveQueue(queue);
                setPendingReportsCount(queue.length);
                return { ok: true, queued: true };
            }
        },
        [refresh],
    );

    const confirmIncident = useCallback(
        async (id: number, isResolved: boolean) => {
            const deviceId = await getDeviceId();
            const current = incidentStore.get().find((i) => i.id === id);
            if (current) {
                incidentStore.update(id, {
                    confirmations_count: current.confirmations_count + 1,
                    is_active: isResolved ? current.confirmations_count + 1 < 3 : true,
                });
            }
            try {
                await confirmIncidentOnServer(id, deviceId, isResolved);
                await refresh();
            } catch {
                /* store уже обновлён оптимистично */
            }
        },
        [refresh],
    );

    const handleRefresh = useCallback(async () => {
        setRefreshing(true);
        await refresh();
        setRefreshing(false);
    }, [refresh]);

    return {
        incidents,
        isOnline,
        loading,
        refreshing,
        refresh: handleRefresh,
        submitReport,
        confirmIncident,
        pendingReportsCount,
    };
}
