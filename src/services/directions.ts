/**
 * directions.ts — Road routing via public OSRM API
 *
 * The old Google Directions call fails from the app (the Maps key is
 * Android-restricted and the FastAPI proxy is retired), which broke
 * route mode. OSRM needs no key and follows real road geometry — ideal
 * for the demo. Returns null on any failure — callers degrade gracefully.
 *
 * For production: move behind a Supabase Edge Function.
 */

import type { LatLng } from '../hooks/useRoutePolyline';

export interface DirectionsStep {
    instruction: string;
    distance: string;
    duration: string;
    end: { latitude: number; longitude: number };
}

export interface DirectionsResult {
    polyline: { latitude: number; longitude: number }[];
    steps: DirectionsStep[];
    totalDistance: string;
    totalDuration: string;
}

/** Google Encoded Polyline Algorithm decoder */
function decodePolyline(encoded: string): { latitude: number; longitude: number }[] {
    const points: { latitude: number; longitude: number }[] = [];
    let index = 0,
        lat = 0,
        lng = 0;
    while (index < encoded.length) {
        let b,
            shift = 0,
            result = 0;
        do {
            b = encoded.charCodeAt(index++) - 63;
            result |= (b & 0x1f) << shift;
            shift += 5;
        } while (b >= 0x20);
        lat += result & 1 ? ~(result >> 1) : result >> 1;
        shift = 0;
        result = 0;
        do {
            b = encoded.charCodeAt(index++) - 63;
            result |= (b & 0x1f) << shift;
            shift += 5;
        } while (b >= 0x20);
        lng += result & 1 ? ~(result >> 1) : result >> 1;
        points.push({ latitude: lat / 1e5, longitude: lng / 1e5 });
    }
    return points;
}

function fmtDistance(meters: number): string {
    if (meters >= 1000) return `${(meters / 1000).toFixed(meters < 10000 ? 1 : 0)} км`;
    return `${Math.round(meters)} м`;
}

function fmtDuration(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.round((seconds % 3600) / 60);
    if (h > 0) return `${h} сағ ${m} мин`;
    return `${m} мин`;
}

/** Human-readable instruction from OSRM maneuver + road name */
function stepInstruction(step: any): string {
    const road = step.name || '';
    const type = step.maneuver?.type ?? '';
    const modifier = step.maneuver?.modifier ?? '';
    switch (type) {
        case 'depart':
            return road ? `Бастау: ${road}` : 'Жолға шығыңыз';
        case 'arrive':
            return 'Мақсатқа жеттіңіз';
        case 'turn':
        case 'end of road':
            return `${modifier === 'left' ? 'Солға' : 'Оңға'} бұрылыңыз${road ? ` — ${road}` : ''}`;
        case 'roundabout':
        case 'rotary':
            return `Сақинада ${modifier === 'left' ? 'солға' : 'оңға'} шығыңыз${road ? ` — ${road}` : ''}`;
        case 'merge':
            return `Қосылыңыз${road ? ` — ${road}` : ''}`;
        case 'on ramp':
        case 'off ramp':
            return `${road || 'Айдау жолына'} кіріңіз`;
        case 'fork':
            return `${modifier === 'left' ? 'Сол' : 'Оң'} тармақты таңдаңыз`;
        default:
            return road ? `Жүріңіз: ${road}` : 'Жалғастырыңыз';
    }
}

export async function fetchDirections(
    origin: { lat: number; lon: number },
    destination: { latitude: number; longitude: number },
): Promise<DirectionsResult | null> {
    const url =
        'https://router.project-osrm.org/route/v1/driving/' +
        `${origin.lon},${origin.lat};${destination.longitude},${destination.latitude}` +
        '?overview=full&geometries=polyline&steps=true';

    try {
        const res = await fetch(url);
        if (!res.ok) return null;
        const data: any = await res.json();
        const route = data?.routes?.[0];
        if (!route) return null;

        const leg = route.legs?.[0];
        const polyline = decodePolyline(route.geometry);

        const steps: DirectionsStep[] = (leg?.steps ?? []).map((s: any) => ({
            instruction: stepInstruction(s),
            distance: fmtDistance(s.distance),
            duration: fmtDuration(s.duration),
            end: { latitude: s.maneuver.location[1], longitude: s.maneuver.location[0] },
        }));

        return {
            polyline,
            steps,
            totalDistance: fmtDistance(route.distance),
            totalDuration: fmtDuration(route.duration),
        };
    } catch {
        return null;
    }
}
