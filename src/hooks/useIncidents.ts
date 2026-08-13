/**
 * useIncidents Hook — SafeRoute / Sapa Jol
 *
 * Тонкая обёртка над incidentStore: вся сетевая логика, поллинг и офлайн-очередь
 * живут в сторе, чтобы три экрана с этим хуком не заводили три таймера.
 *
 * Оптимистичные метки (pending) всегда идут первыми — пользователь видит свою
 * отметку сразу, а стор сам убирает её, когда репорт доехал до сервера или был
 * им отклонён.
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { Incident } from '../constants/incidents';
import {
    useIncidentStore,
    acquireActivePolling,
    refreshActive,
    refreshFeed,
    submitReport,
    confirmIncident,
    SubmitReportParams,
    SubmitResult,
} from '../store/incidentStore';

export type { SubmitReportParams } from '../store/incidentStore';

interface UseIncidentsReturn {
    incidents: Incident[];
    isOnline: boolean;
    loading: boolean;
    refreshing: boolean;
    refresh: () => Promise<void>;
    submitReport: (params: SubmitReportParams) => Promise<SubmitResult>;
    confirmIncident: (id: number, isResolved: boolean) => Promise<void>;
    pendingReportsCount: number;
}

export function useIncidents(tab: 'active' | 'all' = 'active'): UseIncidentsReturn {
    const active = useIncidentStore((s) => s.active);
    const feed = useIncidentStore((s) => s.feed);
    const pending = useIncidentStore((s) => s.pending);
    const isOnline = useIncidentStore((s) => s.isOnline);
    const pendingReportsCount = useIncidentStore((s) => s.pendingReportsCount);

    const [refreshing, setRefreshing] = useState(false);
    const [loading, setLoading] = useState(
        () => (tab === 'active' ? active.length : feed.length) === 0,
    );

    // Общий поллер активных инцидентов: таймер заводит первый подписчик.
    useEffect(() => acquireActivePolling(), []);

    // Лента подгружается при выборе вкладки — история не требует поллинга.
    useEffect(() => {
        let cancelled = false;
        const load = tab === 'all' ? refreshFeed() : refreshActive();
        load.finally(() => {
            if (!cancelled) setLoading(false);
        });
        return () => {
            cancelled = true;
        };
    }, [tab]);

    const refresh = useCallback(async () => {
        setRefreshing(true);
        await (tab === 'all' ? refreshFeed() : refreshActive());
        setRefreshing(false);
    }, [tab]);

    const incidents = useMemo(
        () =>
            tab === 'active'
                ? [...pending, ...active.filter((i) => i.is_active)]
                : [...pending, ...feed],
        [tab, pending, active, feed],
    );

    return {
        incidents,
        isOnline,
        loading,
        refreshing,
        refresh,
        submitReport,
        confirmIncident,
        pendingReportsCount,
    };
}
