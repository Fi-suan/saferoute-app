/**
 * useIncidents Hook — SafeRoute / Sapa Jol
 *
 * Shared state через incidentStore — MapScreen и AlertsScreen видят одни данные.
 * Optimistic incidents появляются сразу, заменяются реальными от сервера.
 * При офлайне — пустой список + очередь репортов (отправятся при reconnect).
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Config } from '../config';
import { STORAGE } from '../constants/storage';
import { Incident } from '../constants/incidents';
import { getDeviceId } from '../services/deviceId';
import { incidentStore } from '../store/incidentStore';

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
}

interface UseIncidentsReturn {
    incidents: Incident[];
    isOnline: boolean;
    loading: boolean;
    refreshing: boolean;
    refresh: () => Promise<void>;
    submitReport: (params: SubmitReportParams) => Promise<{ ok: boolean; error?: string }>;
    confirmIncident: (id: number, isResolved: boolean) => Promise<void>;
    pendingReportsCount: number;
}

async function fetchFromServer(tab: 'active' | 'all'): Promise<{ data: Incident[]; online: boolean }> {
    const endpoint = tab === 'active' ? '/api/v1/incidents/active' : '/api/v1/incidents/feed';
    try {
        const res = await axios.get<Incident[]>(`${Config.BACKEND_URL}${endpoint}`, {
            timeout: 8000,
        });
        if (Array.isArray(res.data)) {
            return { data: res.data, online: true };
        }
    } catch { /* offline — вернём пустой список */ }
    return { data: [], online: false };
}

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

async function flushQueue(deviceId: string): Promise<void> {
    const queue = await loadQueue();
    if (queue.length === 0) return;
    const failed: QueuedReport[] = [];
    for (const report of queue) {
        try {
            await axios.post(`${Config.BACKEND_URL}/api/v1/incidents/report`, {
                ...report,
                reporter_device_id: deviceId,
            }, { timeout: 5000 });
        } catch { failed.push(report); }
    }
    await saveQueue(failed);
}

export function useIncidents(tab: 'active' | 'all' = 'active'): UseIncidentsReturn {
    const [incidents, setIncidents] = useState<Incident[]>(() => {
        const stored = incidentStore.get();
        if (stored.length === 0) return [];
        return tab === 'active' ? stored.filter(i => i.is_active) : stored;
    });
    const [isOnline, setIsOnline] = useState(false);
    const [loading, setLoading] = useState(incidentStore.get().length === 0);
    const [refreshing, setRefreshing] = useState(false);
    const [pendingReportsCount, setPendingReportsCount] = useState(0);

    const tabRef = useRef(tab);
    tabRef.current = tab;

    useEffect(() => {
        const unsubscribe = incidentStore.subscribe((all) => {
            setIncidents(tabRef.current === 'active' ? all.filter(i => i.is_active) : all);
        });
        return unsubscribe;
    }, []);

    const refresh = useCallback(async () => {
        const { data, online } = await fetchFromServer(tab);
        const currentOptimistic = incidentStore.get().filter(
            i => !data.find(d => d.id === i.id)
        );
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
        return () => clearInterval(interval);
    }, [refresh]);

    useEffect(() => {
        loadQueue().then(q => setPendingReportsCount(q.length));
    }, []);

    const submitReport = useCallback(async (
        params: SubmitReportParams,
    ): Promise<{ ok: boolean; error?: string }> => {
        const deviceId = await getDeviceId();

        const optimistic: Incident & { photo_uri?: string } = {
            id: -(Date.now()),
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
        incidentStore.prepend(optimistic);

        try {
            const payload: Record<string, unknown> = {
                incident_type: params.incident_type,
                description: params.description,
                severity: params.severity,
                latitude: params.latitude,
                longitude: params.longitude,
                reporter_device_id: deviceId,
            };
            if (params.photo_base64) {
                payload.photo_base64 = params.photo_base64;
            }
            const res = await axios.post<Incident>(
                `${Config.BACKEND_URL}/api/v1/incidents/report`,
                payload,
                { timeout: 5000 },
            );
            incidentStore.update(optimistic.id, { ...res.data });
            await refresh();
            return { ok: true };
        } catch {
            const queue = await loadQueue();
            queue.push({ ...params, queuedAt: new Date().toISOString() });
            await saveQueue(queue);
            setPendingReportsCount(queue.length);
            return { ok: true };
        }
    }, [refresh]);

    const confirmIncident = useCallback(async (id: number, isResolved: boolean) => {
        const deviceId = await getDeviceId();
        const current = incidentStore.get().find(i => i.id === id);
        if (current) {
            incidentStore.update(id, {
                confirmations_count: current.confirmations_count + 1,
                is_active: isResolved ? current.confirmations_count + 1 < 3 : true,
            });
        }
        try {
            await axios.post(`${Config.BACKEND_URL}/api/v1/incidents/${id}/confirm`, {
                device_id: deviceId,
                is_resolved: isResolved,
            }, { timeout: 4000 });
            await refresh();
        } catch { /* store уже обновлён оптимистично */ }
    }, [refresh]);

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
