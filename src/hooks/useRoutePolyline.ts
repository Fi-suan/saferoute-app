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
import { Config } from '../config';

export interface LatLng { latitude: number; longitude: number; }

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h

/** Start → End for each supported route */
const ROUTE_ENDPOINTS: Record<string, { start: LatLng; end: LatLng }> = {
    a17: {
        start: { latitude: 51.180, longitude: 71.446 }, // Астана
        end:   { latitude: 52.287, longitude: 76.967 }, // Павлодар
    },
    a1: {
        start: { latitude: 51.180, longitude: 71.446 }, // Астана
        end:   { latitude: 43.240, longitude: 76.910 }, // Алматы
    },
    a21: {
        start: { latitude: 51.180, longitude: 71.446 }, // Астана
        end:   { latitude: 50.420, longitude: 80.250 }, // Семей
    },
    e40: {
        start: { latitude: 42.316, longitude: 69.596 }, // Шымкент
        end:   { latitude: 42.900, longitude: 71.350 }, // Тараз
    },
};

/** Static fallback waypoints (used when API unavailable) */
export const STATIC_WAYPOINTS: Record<string, LatLng[]> = {
    a17: [
        { latitude: 51.180, longitude: 71.446 },
        { latitude: 51.260, longitude: 71.750 },
        { latitude: 51.350, longitude: 72.100 },
        { latitude: 51.450, longitude: 72.600 },
        { latitude: 51.530, longitude: 73.100 },
        { latitude: 51.600, longitude: 73.600 },
        { latitude: 51.680, longitude: 74.100 },
        { latitude: 51.750, longitude: 74.500 },
        { latitude: 51.820, longitude: 75.000 },
        { latitude: 51.900, longitude: 75.500 },
        { latitude: 51.980, longitude: 76.000 },
        { latitude: 52.050, longitude: 76.300 },
        { latitude: 52.150, longitude: 76.600 },
        { latitude: 52.230, longitude: 76.800 },
        { latitude: 52.287, longitude: 76.967 },
    ],
    a1: [
        // Астана → Караганда → Балхаш → Алматы (A-1, ~1256 км)
        { latitude: 51.180, longitude: 71.446 },
        { latitude: 50.950, longitude: 71.700 },
        { latitude: 50.630, longitude: 72.960 },  // Теміртау
        { latitude: 49.800, longitude: 73.100 },  // Қарағанды
        { latitude: 49.100, longitude: 73.200 },
        { latitude: 48.300, longitude: 73.500 },
        { latitude: 47.600, longitude: 74.000 },
        { latitude: 46.850, longitude: 75.000 },  // Балхаш
        { latitude: 45.700, longitude: 75.300 },
        { latitude: 44.850, longitude: 76.000 },
        { latitude: 44.200, longitude: 76.500 },
        { latitude: 43.600, longitude: 76.800 },
        { latitude: 43.240, longitude: 76.910 },  // Алматы
    ],
    a21: [
        { latitude: 51.180, longitude: 71.446 },
        { latitude: 51.300, longitude: 73.000 },
        { latitude: 51.500, longitude: 75.000 },
        { latitude: 51.200, longitude: 77.000 },
        { latitude: 50.800, longitude: 79.000 },
        { latitude: 50.420, longitude: 80.250 },
    ],
    e40: [
        { latitude: 42.316, longitude: 69.596 },
        { latitude: 42.500, longitude: 70.200 },
        { latitude: 42.700, longitude: 70.800 },
        { latitude: 42.900, longitude: 71.350 },
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

        if (!Config.GOOGLE_MAPS_API_KEY) return;

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
            } catch { /* ignore */ }

            // 2. Fetch from Directions API
            if (fetchingRef.current) return;
            fetchingRef.current = true;

            const ep = ROUTE_ENDPOINTS[routeId];
            if (!ep) return;

            const result = await fetchDirections(
                { lat: ep.start.latitude, lon: ep.start.longitude },
                ep.end,
                Config.GOOGLE_MAPS_API_KEY,
            );

            if (result && !cancelled) {
                setPolyline(result.polyline);
                const entry: CacheEntry = { polyline: result.polyline, fetchedAt: Date.now() };
                AsyncStorage.setItem(cacheKey(routeId), JSON.stringify(entry)).catch(() => { });
            }
        })();

        return () => { cancelled = true; };
    }, [routeId]);

    return polyline;
}
