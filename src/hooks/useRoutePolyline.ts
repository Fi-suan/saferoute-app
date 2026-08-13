/**
 * useRoutePolyline — SafeRoute / Sapa Jol
 *
 * Fetches and caches a Directions API polyline for the selected route.
 * Cache key: saferoute:polyline:{routeId}
 * Cache TTL: 24 hours (roads don't change often)
 *
 * Returns the cached polyline immediately, then refreshes in background.
 */
import { useState, useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fetchDirections } from '../services/directions';

export interface LatLng {
    latitude: number;
    longitude: number;
}

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h

/** Start → End for each supported route */
const ROUTE_ENDPOINTS: Record<string, { start: LatLng; end: LatLng }> = {
    a17: {
        start: { latitude: 51.18, longitude: 71.446 }, // Астана
        end: { latitude: 52.287, longitude: 76.967 }, // Павлодар
    },
    a1: {
        start: { latitude: 51.18, longitude: 71.446 }, // Астана
        end: { latitude: 43.24, longitude: 76.91 }, // Алматы
    },
    a21: {
        start: { latitude: 51.18, longitude: 71.446 }, // Астана
        end: { latitude: 50.42, longitude: 80.25 }, // Семей
    },
    e40: {
        start: { latitude: 42.316, longitude: 69.596 }, // Шымкент
        end: { latitude: 42.9, longitude: 71.35 }, // Тараз
    },
};

/** Static fallback waypoints (used when API unavailable) */
export const STATIC_WAYPOINTS: Record<string, LatLng[]> = {
    a17: [
        { latitude: 51.18, longitude: 71.446 },
        { latitude: 51.26, longitude: 71.75 },
        { latitude: 51.35, longitude: 72.1 },
        { latitude: 51.45, longitude: 72.6 },
        { latitude: 51.53, longitude: 73.1 },
        { latitude: 51.6, longitude: 73.6 },
        { latitude: 51.68, longitude: 74.1 },
        { latitude: 51.75, longitude: 74.5 },
        { latitude: 51.82, longitude: 75.0 },
        { latitude: 51.9, longitude: 75.5 },
        { latitude: 51.98, longitude: 76.0 },
        { latitude: 52.05, longitude: 76.3 },
        { latitude: 52.15, longitude: 76.6 },
        { latitude: 52.23, longitude: 76.8 },
        { latitude: 52.287, longitude: 76.967 },
    ],
    a1: [
        // Астана → Караганда → Балхаш → Алматы (A-1, ~1256 км)
        { latitude: 51.18, longitude: 71.446 },
        { latitude: 50.95, longitude: 71.7 },
        { latitude: 50.63, longitude: 72.96 }, // Теміртау
        { latitude: 49.8, longitude: 73.1 }, // Қарағанды
        { latitude: 49.1, longitude: 73.2 },
        { latitude: 48.3, longitude: 73.5 },
        { latitude: 47.6, longitude: 74.0 },
        { latitude: 46.85, longitude: 75.0 }, // Балхаш
        { latitude: 45.7, longitude: 75.3 },
        { latitude: 44.85, longitude: 76.0 },
        { latitude: 44.2, longitude: 76.5 },
        { latitude: 43.6, longitude: 76.8 },
        { latitude: 43.24, longitude: 76.91 }, // Алматы
    ],
    a21: [
        { latitude: 51.18, longitude: 71.446 },
        { latitude: 51.3, longitude: 73.0 },
        { latitude: 51.5, longitude: 75.0 },
        { latitude: 51.2, longitude: 77.0 },
        { latitude: 50.8, longitude: 79.0 },
        { latitude: 50.42, longitude: 80.25 },
    ],
    e40: [
        { latitude: 42.316, longitude: 69.596 },
        { latitude: 42.5, longitude: 70.2 },
        { latitude: 42.7, longitude: 70.8 },
        { latitude: 42.9, longitude: 71.35 },
    ],
};

interface CacheEntry {
    polyline: LatLng[];
    fetchedAt: number;
}

function cacheKey(routeId: string) {
    return `saferoute:polyline:${routeId}`;
}

export function useRoutePolyline(routeId: string): LatLng[] {
    const [polyline, setPolyline] = useState<LatLng[]>(
        STATIC_WAYPOINTS[routeId] ?? STATIC_WAYPOINTS.a17,
    );
    const fetchingRef = useRef(false);

    useEffect(() => {
        let cancelled = false;
        fetchingRef.current = false;

        // Reset to static immediately when route changes
        setPolyline(STATIC_WAYPOINTS[routeId] ?? STATIC_WAYPOINTS.a17);

        (async () => {
            // 1. Try cache first
            try {
                const raw = await AsyncStorage.getItem(cacheKey(routeId));
                if (raw) {
                    const cached: CacheEntry = JSON.parse(raw);
                    if (Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
                        if (!cancelled) setPolyline(cached.polyline);
                        return; // Fresh cache — no need to fetch
                    }
                    // Stale cache — show it while we refresh
                    if (!cancelled) setPolyline(cached.polyline);
                }
            } catch {
                /* ignore */
            }

            // 2. Fetch from Directions API (via backend proxy)
            if (fetchingRef.current) return;
            fetchingRef.current = true;

            const ep = ROUTE_ENDPOINTS[routeId];
            if (!ep) return;

            const result = await fetchDirections(
                { lat: ep.start.latitude, lon: ep.start.longitude },
                ep.end,
            );

            if (result && !cancelled) {
                setPolyline(result.polyline);
                const entry: CacheEntry = { polyline: result.polyline, fetchedAt: Date.now() };
                AsyncStorage.setItem(cacheKey(routeId), JSON.stringify(entry)).catch(() => {});
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [routeId]);

    return polyline;
}
