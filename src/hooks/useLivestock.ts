/**
 * useLivestock.ts — управление данными скота
 *
 * Источник данных: FastAPI backend (/api/v1/herds/).
 * При офлайне — пустой список (нет мок-данных).
 * Manual mode: владелец активирует "Я с табуном" — его позиция становится позицией стада.
 */
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Livestock, LIVESTOCK_DANGER_DISTANCE_M } from '../constants/livestock';
import { GeoPoint } from './useLocation';
import {
    getGeozones,
    getHerds,
    createHerd,
    insertHerdLocation,
    deactivateHerd,
} from '../services/api';
import { useT } from '../i18n';

/** Расстояние в км между двумя точками */
function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos((lat1 * Math.PI) / 180) *
            Math.cos((lat2 * Math.PI) / 180) *
            Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const LIVESTOCK_STORAGE_KEY = 'saferoute:livestock:registered';

/** 3+ стада в радиусе 500м от пользователя — опасная зона для водителей */
const DANGER_ZONE_RADIUS_KM = 0.5;
const DANGER_ZONE_MIN_HERDS = 3;

interface UseLivestockReturn {
    livestock: Livestock[];
    dangerousLivestock: Livestock[];
    myLivestock: Livestock[];
    isManualMode: boolean;
    /** true когда 3+ групп скота в радиусе 500м от пользователя */
    dangerZoneAlert: boolean;
    activateManualMode: (type: Livestock['type'], count: number, name: string) => Promise<void>;
    deactivateManualMode: () => Promise<void>;
    registerLivestock: (
        data: Omit<Livestock, 'id' | 'ownerId' | 'lastUpdated' | 'isNearRoad' | 'distanceToRoadM'>,
    ) => Promise<void>;
    refreshLivestock: () => Promise<void>;
}

interface RoadZone {
    id: string;
    latMin: number;
    latMax: number;
    lonMin: number;
    lonMax: number;
    roadLat: number;
    roadLon: number;
    bufferKm: number;
}

let _cachedRoads: RoadZone[] = [];
let _cachedRoadsAt = 0;
const ROAD_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

async function loadRoadZones(): Promise<RoadZone[]> {
    const fresh = _cachedRoads.length > 0 && Date.now() - _cachedRoadsAt < ROAD_CACHE_TTL_MS;
    if (fresh) return _cachedRoads;
    try {
        const zones = await getGeozones();
        if (Array.isArray(zones) && zones.length > 0) {
            _cachedRoads = zones.map((z) => ({
                id: String(z.id),
                latMin: z.lat_min ?? 0,
                latMax: z.lat_max ?? 0,
                lonMin: z.lon_min ?? 0,
                lonMax: z.lon_max ?? 0,
                roadLat: z.road_lat ?? 0,
                roadLon: z.road_lon ?? 0,
                bufferKm: z.buffer_km ?? 5,
            }));
            _cachedRoadsAt = Date.now();
        }
    } catch {
        /* keep stale cache — will retry next refresh */
    }
    return _cachedRoads;
}

function isNearAnyRoadSync(
    lat: number,
    lon: number,
): { near: boolean; distM: number; routeId?: string } {
    for (const road of _cachedRoads) {
        if (lat >= road.latMin && lat <= road.latMax && lon >= road.lonMin && lon <= road.lonMax) {
            const distKm = haversineKm(lat, lon, road.roadLat, road.roadLon);
            const distM = Math.round(distKm * 1000);
            return { near: distKm < road.bufferKm, distM, routeId: road.id };
        }
    }
    return { near: false, distM: 9999 };
}

function mapHerdToLivestock(herd: any, t: (k: any) => string): Livestock {
    const lat = herd.current_location?.latitude ?? herd.lat ?? 0;
    const lon = herd.current_location?.longitude ?? herd.lon ?? 0;
    const road = isNearAnyRoadSync(lat, lon);
    return {
        id: `ls-${herd.id}`,
        ownerId: String(herd.id),
        ownerName: herd.owner_name ?? t('owner_unknown'),
        ownerPhone: '',
        type: herd.animal_type ?? 'horse',
        count: herd.estimated_count ?? 1,
        name: herd.name,
        latitude: lat,
        longitude: lon,
        lastUpdated: herd.created_at ?? new Date().toISOString(),
        isNearRoad: road.near,
        distanceToRoadM: road.distM,
        routeId: road.routeId,
        trackingMode: 'chip' as const,
    };
}

async function fetchLivestockFromServer(t: (k: any) => string): Promise<Livestock[]> {
    try {
        const herds = await getHerds();
        if (Array.isArray(herds) && herds.length > 0) {
            return herds.map((h) => mapHerdToLivestock(h, t));
        }
    } catch {
        /* offline */
    }
    return [];
}

export function useLivestock(userLocation: GeoPoint | null, ownerId = 'me'): UseLivestockReturn {
    const t = useT();
    const [livestock, setLivestock] = useState<Livestock[]>([]);
    const [myLivestock, setMyLivestock] = useState<Livestock[]>([]);
    const [isManualMode, setIsManualMode] = useState(false);
    const [manualEntry, setManualEntry] = useState<Livestock | null>(null);
    /** Backend herd ID for the active manual mode session */
    const backendHerdIdRef = useRef<number | null>(null);
    const lastLocationSentRef = useRef<number>(0);

    useEffect(() => {
        AsyncStorage.getItem(LIVESTOCK_STORAGE_KEY).then((raw) => {
            if (raw) setMyLivestock(JSON.parse(raw));
        });
    }, []);

    const refreshLivestock = useCallback(async () => {
        await loadRoadZones();
        const data = await fetchLivestockFromServer(t);
        setLivestock(data);
    }, []);

    useEffect(() => {
        refreshLivestock();
        const interval = setInterval(refreshLivestock, 30_000);
        return () => clearInterval(interval);
    }, [refreshLivestock]);

    const activateManualMode = useCallback(
        async (type: Livestock['type'], count: number, name: string) => {
            if (!userLocation) return;
            const road = isNearAnyRoadSync(userLocation.lat, userLocation.lon);
            const entry: Livestock = {
                id: `manual-${Date.now()}`,
                ownerId,
                ownerName: t('owner_me'),
                ownerPhone: '',
                type,
                count,
                name,
                latitude: userLocation.lat,
                longitude: userLocation.lon,
                lastUpdated: new Date().toISOString(),
                isNearRoad: road.near,
                distanceToRoadM: road.distM,
                routeId: road.routeId,
                trackingMode: 'phone',
            };
            setManualEntry(entry);
            setIsManualMode(true);
            setLivestock((prev) => [entry, ...prev]);

            // Create herd on backend so other users see it
            try {
                const herdId = await createHerd({
                    name,
                    animal_type: type,
                    estimated_count: count,
                    owner_name: 'manual',
                });
                if (herdId) {
                    backendHerdIdRef.current = herdId;
                    // Send initial location
                    await insertHerdLocation(herdId, {
                        latitude: userLocation.lat,
                        longitude: userLocation.lon,
                        speed_kmh: 0,
                        source: 'manual',
                    }).catch(() => {});
                }
            } catch {
                /* offline — will sync on next refresh */
            }
        },
        [userLocation, ownerId],
    );

    // Update position on backend while in manual mode (throttled to every 10s)
    useEffect(() => {
        if (!isManualMode || !userLocation || !manualEntry) return;
        const road = isNearAnyRoadSync(userLocation.lat, userLocation.lon);
        const updated: Livestock = {
            ...manualEntry,
            latitude: userLocation.lat,
            longitude: userLocation.lon,
            lastUpdated: new Date().toISOString(),
            isNearRoad: road.near,
            distanceToRoadM: road.distM,
        };
        setManualEntry(updated);
        setLivestock((prev) => prev.map((l) => (l.id === updated.id ? updated : l)));

        // Sync to backend every 10 seconds
        const now = Date.now();
        if (backendHerdIdRef.current && now - lastLocationSentRef.current > 10_000) {
            lastLocationSentRef.current = now;
            insertHerdLocation(backendHerdIdRef.current, {
                latitude: userLocation.lat,
                longitude: userLocation.lon,
                speed_kmh: 0,
                source: 'manual',
            }).catch(() => {});
        }
    }, [userLocation?.lat, userLocation?.lon, isManualMode]);

    const deactivateManualMode = useCallback(async () => {
        setIsManualMode(false);
        if (manualEntry) {
            setLivestock((prev) => prev.filter((l) => l.id !== manualEntry.id));
        }
        setManualEntry(null);

        // Deactivate on backend
        if (backendHerdIdRef.current) {
            try {
                await deactivateHerd(backendHerdIdRef.current);
            } catch {
                /* ignore */
            }
            backendHerdIdRef.current = null;
        }
    }, [manualEntry]);

    const registerLivestock = useCallback(
        async (
            data: Omit<
                Livestock,
                'id' | 'ownerId' | 'lastUpdated' | 'isNearRoad' | 'distanceToRoadM'
            >,
        ) => {
            const road = isNearAnyRoadSync(data.latitude, data.longitude);
            const entry: Livestock = {
                ...data,
                id: `reg-${Date.now()}`,
                ownerId,
                lastUpdated: new Date().toISOString(),
                isNearRoad: road.near,
                distanceToRoadM: road.distM,
                routeId: road.routeId,
            };
            const updated = [...myLivestock, entry];
            setMyLivestock(updated);
            await AsyncStorage.setItem(LIVESTOCK_STORAGE_KEY, JSON.stringify(updated));
        },
        [myLivestock, ownerId],
    );

    const dangerousLivestock = livestock.filter(
        (l) => l.isNearRoad && l.distanceToRoadM < LIVESTOCK_DANGER_DISTANCE_M,
    );

    /** Danger Zone: 3+ групп скота в радиусе 500м от пользователя */
    const dangerZoneAlert = useMemo(() => {
        if (!userLocation) return false;
        const nearby = livestock.filter(
            (l) =>
                haversineKm(userLocation.lat, userLocation.lon, l.latitude, l.longitude) <=
                DANGER_ZONE_RADIUS_KM,
        );
        return nearby.length >= DANGER_ZONE_MIN_HERDS;
    }, [livestock, userLocation]);

    return {
        livestock,
        dangerousLivestock,
        myLivestock,
        isManualMode,
        dangerZoneAlert,
        activateManualMode,
        deactivateManualMode,
        registerLivestock,
        refreshLivestock,
    };
}
