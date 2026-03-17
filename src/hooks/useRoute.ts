/**
 * useRoute.ts — Режим маршрута Астана → Павлодар (A-17)
 *
 * Фича: пользователь включает режим поездки по A-17.
 * В этом режиме:
 * - Карта показывает только инциденты вдоль трассы
 * - Активируется повышенная частота GPS (каждые 2 сек вместо 5)
 * - Вверху показывается баннер "Маршрут белсенді: A-17"
 * - При въезде в зону инцидента — немедленный push
 *
 * Граница трассы A-17 — грубый bounding box:
 * Lat: 51.1 → 52.5, Lon: 71.3 → 77.2
 */
import { useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE } from '../constants/storage';
import { Incident } from '../constants/incidents';

// Bounding box трассы A-17 Астана—Павлодар (с запасом ~20 км)
const A17_BOUNDS = {
    latMin: 51.0,
    latMax: 52.5,
    lonMin: 71.3,
    lonMax: 77.2,
};

export function isOnA17Corridor(lat: number, lon: number): boolean {
    return (
        lat >= A17_BOUNDS.latMin && lat <= A17_BOUNDS.latMax &&
        lon >= A17_BOUNDS.lonMin && lon <= A17_BOUNDS.lonMax
    );
}

/**
 * Вычисляет статус дороги из списка активных инцидентов.
 * Используется для отображения "Дорога открыта/закрыта".
 */
export type RoadStatus = 'open' | 'caution' | 'closed';

export function computeRoadStatus(incidents: Incident[]): RoadStatus {
    const active = incidents.filter(i => i.is_active);
    // Закрыта: есть инцидент severity=5 с типом hazard (дорожная блокировка)
    if (active.some(i => i.severity >= 5 && i.incident_type === 'hazard')) return 'closed';
    // Сақтық: 3+ инцидента severity>=4 или ДТП severity>=4
    const dangerous = active.filter(i => i.severity >= 4);
    if (dangerous.length >= 2 || active.some(i => i.incident_type === 'crash' && i.severity >= 4)) return 'caution';
    return 'open';
}

export interface UseRouteReturn {
    isRouteMode: boolean;
    toggleRouteMode: () => Promise<void>;
    routeIncidents: Incident[];            // только инциденты вдоль A-17
    roadStatus: RoadStatus;
}

export function useRoute(allIncidents: Incident[]): UseRouteReturn {
    const [isRouteMode, setIsRouteMode] = useState(false);

    const toggleRouteMode = useCallback(async () => {
        const next = !isRouteMode;
        setIsRouteMode(next);
        // Persist выбора
        try {
            await AsyncStorage.setItem(STORAGE.ROUTE_MODE, next ? '1' : '0');
        } catch { /* ignore */ }
    }, [isRouteMode]);

    const routeIncidents = allIncidents.filter(
        i => isOnA17Corridor(i.latitude, i.longitude)
    );

    const src = isRouteMode ? routeIncidents : allIncidents;
    const roadStatus = computeRoadStatus(src);

    return { isRouteMode, toggleRouteMode, routeIncidents, roadStatus };
}
