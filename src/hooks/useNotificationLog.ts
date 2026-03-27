/**
 * useNotificationLog — SafeRoute / Sapa Jol
 *
 * Persists proximity alert history to AsyncStorage.
 * Max 50 entries (FIFO, oldest dropped first).
 */
import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'saferoute:notification:log';
const MAX = 50;

export interface NotifEntry {
    id: string;          // uuid-like: timestamp + incidentId
    title: string;
    body: string;
    incidentId: number;
    timestamp: number;   // Date.now()
    read: boolean;
}

interface UseNotificationLogReturn {
    log: NotifEntry[];
    addEntry: (entry: Omit<NotifEntry, 'id' | 'timestamp' | 'read'>) => Promise<void>;
    markAllRead: () => Promise<void>;
    clearLog: () => Promise<void>;
    unreadCount: number;
}

export function useNotificationLog(): UseNotificationLogReturn {
    const [log, setLog] = useState<NotifEntry[]>([]);

    useEffect(() => {
        AsyncStorage.getItem(KEY).then(raw => {
            if (raw) {
                try { setLog(JSON.parse(raw)); } catch { /* ignore */ }
            }
        });
    }, []);

    const persist = useCallback(async (entries: NotifEntry[]) => {
        await AsyncStorage.setItem(KEY, JSON.stringify(entries));
        setLog(entries);
    }, []);

    const addEntry = useCallback(async (e: Omit<NotifEntry, 'id' | 'timestamp' | 'read'>) => {
        const entry: NotifEntry = {
            ...e,
            id: `${Date.now()}_${e.incidentId}`,
            timestamp: Date.now(),
            read: false,
        };
        setLog(prev => {
            const next = [entry, ...prev].slice(0, MAX);
            AsyncStorage.setItem(KEY, JSON.stringify(next));
            return next;
        });
    }, []);

    const markAllRead = useCallback(async () => {
        const updated = log.map(e => ({ ...e, read: true }));
        await persist(updated);
    }, [log, persist]);

    const clearLog = useCallback(async () => {
        await persist([]);
    }, [persist]);

    const unreadCount = log.filter(e => !e.read).length;

    return { log, addEntry, markAllRead, clearLog, unreadCount };
}
