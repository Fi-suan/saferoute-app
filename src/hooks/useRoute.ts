/**
 * useRoute.ts — Режим маршрута (multi-route)
 *
 * Поддерживаемые маршруты: A-17, A-1, A-21, E-40
 * Режим маршрута ПОСТОЯНЕН и следует за маршрутом, выбранным в Профиле:
 * на карте всегда показываются только инциденты выбранного коридора.
 */
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
 * Инцидент принадлежит маршруту, если он поставлен на этом маршруте
 * (route_id с сервера). Для старых строк без route_id — фолбэк на bbox.
 */
export function matchesRoute(incident: Incident, routeId: string): boolean {
    if (incident.route_id) return incident.route_id === routeId;
    return isOnCorridor(incident.latitude, incident.longitude, routeId);
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
    routeIncidents: Incident[];
    roadStatus: RoadStatus;
}

export function useRoute(allIncidents: Incident[], routeId: string = 'a17'): UseRouteReturn {
    const routeIncidents = allIncidents.filter(
        i => matchesRoute(i, routeId),
    );
    const roadStatus = computeRoadStatus(routeIncidents);
    return { routeIncidents, roadStatus };
}
