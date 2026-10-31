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
import { useSettingsStore } from '../hooks/useSettings';

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

/** Локализация манёвров: kk (по умолчанию) / ru — по языку из настроек */
const L10N = {
    kk: {
        hours: 'сағ',
        min: 'мин',
        km: 'км',
        m: 'м',
        depart: (road: string) => (road ? `Бастау: ${road}` : 'Жолға шығыңыз'),
        arrive: 'Мақсатқа жеттіңіз',
        turn: {
            left: 'Солға бұрылыңыз',
            right: 'Оңға бұрылыңыз',
            straight: 'Тура жүріңіз',
            'slight left': 'Солға біртіндеп бұрылыңыз',
            'slight right': 'Оңға біртіндеп бұрылыңыз',
            'sharp left': 'Күшті солға бұрылыңыз',
            'sharp right': 'Күшті оңға бұрылыңыз',
            uturn: 'Кері бұрылыңыз',
        },
        roundabout: (side: string) => `Сақинада ${side} шығыңыз`,
        merge: 'Қосылыңыз',
        ramp: 'Айдау жолына',
        fork: (side: string) => `${side} тармақты таңдаңыз`,
        forkL: 'Сол',
        forkR: 'Оң',
        go: (road: string) => (road ? `Жүріңіз: ${road}` : 'Жалғастырыңыз'),
    },
    ru: {
        hours: 'ч',
        min: 'мин',
        km: 'км',
        m: 'м',
        depart: (road: string) => (road ? `Старт: ${road}` : 'Выезжайте на дорогу'),
        arrive: 'Вы прибыли',
        turn: {
            left: 'Поверните налево',
            right: 'Поверните направо',
            straight: 'Едьте прямо',
            'slight left': 'Плавно налево',
            'slight right': 'Плавно направо',
            'sharp left': 'Резко налево',
            'sharp right': 'Резко направо',
            uturn: 'Развернитесь',
        },
        roundabout: (side: string) => `На круговом съезд ${side}`,
        merge: 'Примыкание',
        ramp: 'Заезд',
        fork: (side: string) => `Выберите ${side} съезд`,
        forkL: 'левый',
        forkR: 'правый',
        go: (road: string) => (road ? `Продолжайте: ${road}` : 'Продолжайте движение'),
    },
};
type L = (typeof L10N)['kk'];

function currentLoc(): L {
    const lang = useSettingsStore.getState().settings.language;
    return L10N[lang] ?? L10N.kk;
}

function fmtDistance(meters: number, loc: L): string {
    if (meters >= 1000) return `${(meters / 1000).toFixed(meters < 10000 ? 1 : 0)} ${loc.km}`;
    return `${Math.round(meters)} ${loc.m}`;
}

function fmtDuration(seconds: number, loc: L): string {
    // Округляем общие минуты: иначе 4150 с рендерились как «1 сағ 60 мин»
    const totalMin = Math.round(seconds / 60);
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    if (h > 0) return `${h} ${loc.hours} ${m} ${loc.min}`;
    return `${m} ${loc.min}`;
}

/** Human-readable instruction from OSRM maneuver + road name */
function stepInstruction(step: any, loc: L): string {
    const road = step.name || '';
    const type = step.maneuver?.type ?? '';
    const modifier = step.maneuver?.modifier ?? '';
    // «прямо», «плавно/резко», «разворот» — полноценные модификаторы OSRM;
    // раньше всё, кроме left, становилось «поверните направо» (!)
    const turnText =
        loc.turn[modifier as keyof L['turn']] ?? loc.turn.straight;
    const side = modifier.includes('left') ? loc.forkL : loc.forkR;
    switch (type) {
        case 'depart':
            return loc.depart(road);
        case 'arrive':
            return loc.arrive;
        case 'turn':
        case 'end of road':
            return `${turnText}${road ? ` — ${road}` : ''}`;
        case 'roundabout':
        case 'rotary':
            return `${loc.roundabout(modifier.includes('left') ? loc.forkL.toLowerCase() : loc.forkR.toLowerCase())}${road ? ` — ${road}` : ''}`;
        case 'merge':
            return `${loc.merge}${road ? ` — ${road}` : ''}`;
        case 'on ramp':
        case 'off ramp':
            return `${road || loc.ramp} — ${loc.turn.straight}`;
        case 'fork':
            return loc.fork(side) + (road ? ` — ${road}` : '');
        default:
            return loc.go(road);
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

    // Публичный OSRM бывает медленным: без таймаута navLoading зависает навсегда
    const TIMEOUT_MS = 12_000;
    try {
        const res = await Promise.race([
            fetch(url),
            new Promise<never>((_, rej) =>
                setTimeout(() => rej(new Error('osrm-timeout')), TIMEOUT_MS),
            ),
        ]);
        if (!res.ok) return null;
        const data: any = await res.json();
        const route = data?.routes?.[0];
        if (!route) return null;

        const leg = route.legs?.[0];
        const polyline = decodePolyline(route.geometry);

        const loc = currentLoc();
        const steps: DirectionsStep[] = (leg?.steps ?? []).map((s: any) => ({
            instruction: stepInstruction(s, loc),
            distance: fmtDistance(s.distance, loc),
            duration: fmtDuration(s.duration, loc),
            end: { latitude: s.maneuver.location[1], longitude: s.maneuver.location[0] },
        }));

        return {
            polyline,
            steps,
            totalDistance: fmtDistance(route.distance, loc),
            totalDuration: fmtDuration(route.duration, loc),
        };
    } catch {
        return null;
    }
}
