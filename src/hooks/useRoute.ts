/**
 * useRoute.ts — Режим маршрута (multi-route)
 *
 * Поддерживаемые маршруты: A-17, A-1, A-21, E-40
 * При активации режима маршрута — показываются только инциденты
 * вдоль выбранного коридора (bounding box с запасом 20–30 км).
 */
import { useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE } from '../constants/storage';
import { Incident } from '../constants/incidents';

/** Bounding box для каждого маршрута */
const ROUTE_BOUNDS: Record<string, { latMin: number; latMax: number; lonMin: number; lonMax: number }> = {
    a17: { latMin: 51.0, latMax: 52.5, lonMin: 71.3, lonMax: 77.2 }, // Астана → Павлодар
    a1:  { latMin: 43.0, latMax: 52.0, lonMin: 71.0, lonMax: 77.5 }, // Астана → Алматы
    a21: { latMin: 50.2, latMax: 52.0, lonMin: 75.0, lonMax: 80.8 }, // Екібастұз → Семей
    e40: { latMin: 42.0, latMax: 43.2, lonMin: 69.3, lonMax: 71.8 }, // Шымкент → Тараз
};

export function isOnCorridor(lat: number, lon: number, routeId: string = 'a17'): boolean {
    const b = ROUTE_BOUNDS[routeId] ?? ROUTE_BOUNDS.a17;
    return lat >= b.latMin && lat <= b.latMax && lon >= b.lonMin && lon <= b.lonMax;
}

/** @deprecated use isOnCorridor(lat, lon, 'a17') */
export function isOnA17Corridor(lat: number, lon: number): boolean {
    return isOnCorridor(lat, lon, 'a17');
}

/**
 * Вычисляет статус дороги из списка активных инцидентов.
 */
export type RoadStatus = 'open' | 'caution' | 'closed';

export function computeRoadStatus(incidents: Incident[]): RoadStatus {
    const active = incidents.filter(i => i.is_active);
    if (active.some(i => i.severity >= 5 && i.incident_type === 'hazard')) return 'closed';
    const dangerous = active.filter(i => i.severity >= 4);
    if (dangerous.length >= 2 || active.some(i => i.incident_type === 'crash' && i.severity >= 4)) return 'caution';
    return 'open';
}

export interface UseRouteReturn {
    isRouteMode: boolean;
    toggleRouteMode: () => Promise<void>;
    routeIncidents: Incident[];
    roadStatus: RoadStatus;
}

export function useRoute(allIncidents: Incident[], routeId: string = 'a17'): UseRouteReturn {
    const [isRouteMode, setIsRouteMode] = useState(false);

    const toggleRouteMode = useCallback(async () => {
        const next = !isRouteMode;
        setIsRouteMode(next);
        try {
            await AsyncStorage.setItem(STORAGE.ROUTE_MODE, next ? '1' : '0');
        } catch { /* ignore */ }
    }, [isRouteMode]);

    const routeIncidents = allIncidents.filter(
        i => isOnCorridor(i.latitude, i.longitude, routeId),
    );

    const src = isRouteMode ? routeIncidents : allIncidents;
    const roadStatus = computeRoadStatus(src);

    return { isRouteMode, toggleRouteMode, routeIncidents, roadStatus };
}
