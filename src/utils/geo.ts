/**
 * geo.ts — геометрия на клиенте.
 *
 * Haversine раньше был скопирован в useLocation, useLivestock и MapScreen —
 * три одинаковые реализации, которые пришлось бы править синхронно.
 *
 * distanceToPolylineKm повторяет логику бэкенда (app/services/geofencing.py):
 * расстояние до дороги — это расстояние до её осевой линии, а не до одной
 * усреднённой точки. Для коридора в сотни километров разница принципиальная.
 */

const EARTH_RADIUS_KM = 6371;

/** Точка осевой линии в том виде, в каком её отдаёт бэкенд: [lat, lon]. */
export type LatLonPair = [number, number];

export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) ** 2;
    return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function haversineM(lat1: number, lon1: number, lat2: number, lon2: number): number {
    return haversineKm(lat1, lon1, lat2, lon2) * 1000;
}

/**
 * Расстояние от точки до отрезка.
 *
 * Отрезок проецируется в локальную плоскость с началом в самой точке —
 * на масштабах дороги погрешность заметно меньше процента.
 */
function pointToSegmentKm(
    pLat: number, pLon: number,
    aLat: number, aLon: number,
    bLat: number, bLon: number,
): number {
    const cosLat = Math.cos((pLat * Math.PI) / 180);
    const toXY = (lat: number, lon: number): [number, number] => [
        ((lon - pLon) * Math.PI / 180) * cosLat * EARTH_RADIUS_KM,
        ((lat - pLat) * Math.PI / 180) * EARTH_RADIUS_KM,
    ];

    const [ax, ay] = toXY(aLat, aLon);
    const [bx, by] = toXY(bLat, bLon);
    const dx = bx - ax;
    const dy = by - ay;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) return Math.hypot(ax, ay);

    const t = Math.max(0, Math.min(1, -(ax * dx + ay * dy) / lenSq));
    return Math.hypot(ax + t * dx, ay + t * dy);
}

/**
 * Кратчайшее расстояние до осевой линии дороги.
 *
 * Расстояния до вершин считаются сферически и задают верхнюю границу: без
 * этого плоская проекция на удалении в десятки километров может дать значение
 * чуть больше расстояния до ближайшей вершины, чего быть не может — вершина
 * лежит на самой линии.
 */
export function distanceToPolylineKm(lat: number, lon: number, polyline: LatLonPair[]): number {
    if (!polyline || polyline.length === 0) return Infinity;

    let best = Infinity;
    for (const [pLat, pLon] of polyline) {
        const d = haversineKm(lat, lon, pLat, pLon);
        if (d < best) best = d;
    }
    for (let i = 0; i < polyline.length - 1; i += 1) {
        const d = pointToSegmentKm(lat, lon, polyline[i][0], polyline[i][1], polyline[i + 1][0], polyline[i + 1][1]);
        if (d < best) best = d;
    }
    return best;
}
