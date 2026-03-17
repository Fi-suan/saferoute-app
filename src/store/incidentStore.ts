/**
 * incidentStore.ts — модульный in-memory кэш инцидентов
 *
 * Решает проблему разных экземпляров useIncidents():
 * MapScreen и AlertsScreen видят ОДНИ и те же данные через этот store.
 *
 * Паттерн: module-level singleton с подписками (pub/sub).
 * Не используем Zustand/Redux чтобы не добавлять зависимость.
 */
import { Incident } from '../constants/incidents';

type Listener = (incidents: Incident[]) => void;

let _incidents: Incident[] = [];
const _listeners = new Set<Listener>();

export const incidentStore = {
    /** Текущее состояние */
    get(): Incident[] {
        return _incidents;
    },

    /** Полная замена (от сервера/mock) */
    set(data: Incident[]) {
        _incidents = data;
        _notify();
    },

    /** Добавить оптимистичный инцидент в начало */
    prepend(incident: Incident) {
        _incidents = [incident, ..._incidents];
        _notify();
    },

    /** Обновить конкретный инцидент по id */
    update(id: number, patch: Partial<Incident>) {
        _incidents = _incidents.map(i => i.id === id ? { ...i, ...patch } : i);
        _notify();
    },

    /** Подписаться на изменения */
    subscribe(listener: Listener): () => void {
        _listeners.add(listener);
        return () => _listeners.delete(listener);
    },
};

function _notify() {
    _listeners.forEach(l => l(_incidents));
}
