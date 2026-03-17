import { create } from 'zustand';
import { Alert, Herd, AlertLevel } from '../services/api';

interface AlertStore {
    // Herds
    herds: Herd[];
    setHerds: (h: Herd[]) => void;
    updateHerdPosition: (herdId: number, lat: number, lon: number) => void;

    // Alerts
    activeAlerts: Alert[];
    alertHistory: Alert[];
    setActiveAlerts: (a: Alert[]) => void;
    setAlertHistory: (a: Alert[]) => void;
    addAlert: (a: Alert) => void;
    resolveAlert: (id: number) => void;

    // Highest current alert level (for UI indicator)
    criticalLevel: AlertLevel | null;

    // Loading
    isLoading: boolean;
    setLoading: (v: boolean) => void;

    // Last update timestamp
    lastUpdated: Date | null;
    setLastUpdated: (d: Date) => void;
}

const LEVEL_ORDER: Record<AlertLevel, number> = {
    low: 1,
    medium: 2,
    high: 3,
    critical: 4,
};

export const useAlertStore = create<AlertStore>((set, get) => ({
    herds: [],
    setHerds: (herds) => set({ herds }),
    updateHerdPosition: (herdId, lat, lon) =>
        set((state) => ({
            herds: state.herds.map((h) =>
                h.id === herdId && h.current_location
                    ? {
                        ...h,
                        current_location: {
                            ...h.current_location,
                            latitude: lat,
                            longitude: lon,
                        },
                    }
                    : h
            ),
        })),

    activeAlerts: [],
    alertHistory: [],
    setActiveAlerts: (activeAlerts) => {
        const highest = activeAlerts.reduce<AlertLevel | null>((acc, a) => {
            if (!acc) return a.level;
            return LEVEL_ORDER[a.level] > LEVEL_ORDER[acc] ? a.level : acc;
        }, null);
        set({ activeAlerts, criticalLevel: highest });
    },
    setAlertHistory: (alertHistory) => set({ alertHistory }),
    addAlert: (alert) =>
        set((state) => {
            const exists = state.activeAlerts.find((a) => a.id === alert.id);
            const newActives = exists
                ? state.activeAlerts.map((a) => (a.id === alert.id ? alert : a))
                : [alert, ...state.activeAlerts];
            const highest = newActives.reduce<AlertLevel | null>((acc, a) => {
                if (!acc) return a.level;
                return LEVEL_ORDER[a.level] > LEVEL_ORDER[acc] ? a.level : acc;
            }, null);
            return { activeAlerts: newActives, criticalLevel: highest };
        }),
    resolveAlert: (id) =>
        set((state) => {
            const newActives = state.activeAlerts.filter((a) => a.id !== id);
            const highest = newActives.reduce<AlertLevel | null>((acc, a) => {
                if (!acc) return a.level;
                return LEVEL_ORDER[a.level] > LEVEL_ORDER[acc] ? a.level : acc;
            }, null);
            return { activeAlerts: newActives, criticalLevel: highest };
        }),

    criticalLevel: null,
    isLoading: false,
    setLoading: (isLoading) => set({ isLoading }),
    lastUpdated: null,
    setLastUpdated: (lastUpdated) => set({ lastUpdated }),
}));
