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
import api from '../services/api';
import { haversineKm, distanceToPolylineKm, LatLonPair } from '../utils/geo';

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
    registerLivestock: (data: Omit<Livestock, 'id' | 'ownerId' | 'lastUpdated' | 'isNearRoad' | 'distanceToRoadM'>) => Promise<void>;
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
    /** Осевая линия дороги. Пусто — считаем до roadLat/roadLon, как раньше. */
    geometry: LatLonPair[];
}

let _cachedRoads: RoadZone[] = [];
let _cachedRoadsAt = 0;
const ROAD_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

async function loadRoadZones(): Promise<RoadZone[]> {
    const fresh = _cachedRoads.length > 0 && Date.now() - _cachedRoadsAt < ROAD_CACHE_TTL_MS;
    if (fresh) return _cachedRoads;
    try {
        const res = await api.get<any[]>('/geozones/', { timeout: 5000 });
        if (Array.isArray(res.data)) {
            _cachedRoads = res.data.map((z: any) => ({
                id: String(z.id),
                latMin: z.lat_min ?? 0,
                latMax: z.lat_max ?? 0,
                lonMin: z.lon_min ?? 0,
                lonMax: z.lon_max ?? 0,
                roadLat: z.road_lat ?? 0,
                roadLon: z.road_lon ?? 0,
                bufferKm: z.buffer_km ?? 5,
                geometry: Array.isArray(z.road_geometry) ? (z.road_geometry as LatLonPair[]) : [],
            }));
            _cachedRoadsAt = Date.now();
        }
    } catch { /* keep stale cache — will retry next refresh */ }
    return _cachedRoads;
}

function isNearAnyRoadSync(lat: number, lon: number): { near: boolean; distM: number; routeId?: string } {
    // Перебираем все подходящие зоны и берём ближайшую дорогу. Раньше
    // возвращалась первая попавшаяся, а bounding box'ы пересекаются — почти
    // все трассы начинаются в Астане, — поэтому выбор был по сути случайным.
    let best: { distKm: number; road: RoadZone } | null = null;

    for (const road of _cachedRoads) {
        if (lat < road.latMin || lat > road.latMax || lon < road.lonMin || lon > road.lonMax) continue;
        // До осевой линии, а не до усреднённой точки коридора.
        const distKm = road.geometry.length > 0
            ? distanceToPolylineKm(lat, lon, road.geometry)
            : haversineKm(lat, lon, road.roadLat, road.roadLon);
        if (best === null || distKm < best.distKm) best = { distKm, road };
    }

    if (best === null) return { near: false, distM: 9999 };
    return {
        near: best.distKm < best.road.bufferKm,
        distM: Math.round(best.distKm * 1000),
        routeId: best.road.id,
    };
}

function mapHerdToLivestock(herd: any): Livestock {
    const lat = herd.current_location?.latitude ?? herd.lat ?? 0;
    const lon = herd.current_location?.longitude ?? herd.lon ?? 0;
    const road = isNearAnyRoadSync(lat, lon);
    return {
        id: `ls-${herd.id}`,
        ownerId: String(herd.id),
        ownerName: herd.owner_name ?? 'Белгісіз иесі',
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

async function fetchLivestockFromServer(): Promise<Livestock[]> {
    try {
        const res = await api.get<any[]>('/herds/', { timeout: 5000 });
        if (Array.isArray(res.data) && res.data.length > 0) {
            return res.data.map(mapHerdToLivestock);
        }
    } catch { /* offline */ }
    return [];
}

export function useLivestock(userLocation: GeoPoint | null, ownerId = 'me'): UseLivestockReturn {
    const [livestock, setLivestock] = useState<Livestock[]>([]);
    const [myLivestock, setMyLivestock] = useState<Livestock[]>([]);
    const [isManualMode, setIsManualMode] = useState(false);
    const [manualEntry, setManualEntry] = useState<Livestock | null>(null);
    /** Backend herd ID for the active manual mode session */
    const backendHerdIdRef = useRef<number | null>(null);
    const lastLocationSentRef = useRef<number>(0);

    useEffect(() => {
        AsyncStorage.getItem(LIVESTOCK_STORAGE_KEY).then(raw => {
            if (raw) setMyLivestock(JSON.parse(raw));
        });
    }, []);

    const refreshLivestock = useCallback(async () => {
        await loadRoadZones();
        const data = await fetchLivestockFromServer();
        setLivestock(data);
    }, []);

    useEffect(() => {
        refreshLivestock();
        const interval = setInterval(refreshLivestock, 30_000);
        return () => clearInterval(interval);
    }, [refreshLivestock]);

    const activateManualMode = useCallback(async (
        type: Livestock['type'],
        count: number,
        name: string,
    ) => {
        if (!userLocation) return;
        const road = isNearAnyRoadSync(userLocation.lat, userLocation.lon);
        const entry: Livestock = {
            id: `manual-${Date.now()}`,
            ownerId,
            ownerName: 'Мен',
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
        setLivestock(prev => [entry, ...prev]);

        // Create herd on backend so other users see it
        try {
            const res = await api.post('/herds/', {
                name,
                animal_type: type,
                estimated_count: count,
                owner_name: 'manual',
            });
            const herdId = res.data?.id;
            if (herdId) {
                backendHerdIdRef.current = herdId;
                // Send initial location
                await api.post(`/herds/${herdId}/location`, {
                    latitude: userLocation.lat,
                    longitude: userLocation.lon,
                    speed_kmh: 0,
                    source: 'manual',
                }).catch(() => {});
            }
        } catch { /* offline — will sync on next refresh */ }
    }, [userLocation, ownerId]);

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
        setLivestock(prev => prev.map(l => l.id === updated.id ? updated : l));

        // Sync to backend every 10 seconds
        const now = Date.now();
        if (backendHerdIdRef.current && now - lastLocationSentRef.current > 10_000) {
            lastLocationSentRef.current = now;
            api.post(`/herds/${backendHerdIdRef.current}/location`, {
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
            setLivestock(prev => prev.filter(l => l.id !== manualEntry.id));
        }
        setManualEntry(null);

        // Deactivate on backend
        if (backendHerdIdRef.current) {
            try {
                await api.patch(`/herds/${backendHerdIdRef.current}/deactivate`);
            } catch { /* ignore */ }
            backendHerdIdRef.current = null;
        }
    }, [manualEntry]);

    const registerLivestock = useCallback(async (
        data: Omit<Livestock, 'id' | 'ownerId' | 'lastUpdated' | 'isNearRoad' | 'distanceToRoadM'>,
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
    }, [myLivestock, ownerId]);

    const dangerousLivestock = livestock.filter(
        l => l.isNearRoad && l.distanceToRoadM < LIVESTOCK_DANGER_DISTANCE_M
    );

    /** Danger Zone: 3+ групп скота в радиусе 500м от пользователя */
    const dangerZoneAlert = useMemo(() => {
        if (!userLocation) return false;
        const nearby = livestock.filter(l =>
            haversineKm(userLocation.lat, userLocation.lon, l.latitude, l.longitude) <= DANGER_ZONE_RADIUS_KM
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
