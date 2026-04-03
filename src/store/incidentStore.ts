/**
 * incidentStore.ts — Zustand store for incidents
 *
 * Thread-safe shared state between MapScreen and AlertsScreen.
 */
import { create } from 'zustand';
import { Incident } from '../constants/incidents';

interface IncidentState {
    incidents: Incident[];
    set: (data: Incident[]) => void;
    prepend: (incident: Incident) => void;
    update: (id: number, patch: Partial<Incident>) => void;
}

const useIncidentZustand = create<IncidentState>((set) => ({
    incidents: [],
    set: (data) => set({ incidents: data }),
    prepend: (incident) => set((s) => ({ incidents: [incident, ...s.incidents] })),
    update: (id, patch) => set((s) => ({
        incidents: s.incidents.map(i => i.id === id ? { ...i, ...patch } : i),
    })),
}));

// Backward-compatible API so useIncidents.ts doesn't need major refactor
export const incidentStore = {
    get(): Incident[] {
        return useIncidentZustand.getState().incidents;
    },
    set(data: Incident[]) {
        useIncidentZustand.getState().set(data);
    },
    prepend(incident: Incident) {
        useIncidentZustand.getState().prepend(incident);
    },
    update(id: number, patch: Partial<Incident>) {
        useIncidentZustand.getState().update(id, patch);
    },
    subscribe(listener: (incidents: Incident[]) => void): () => void {
        return useIncidentZustand.subscribe((s) => listener(s.incidents));
    },
};
