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
    activateManualMode: (type: Livestock['type'], count: number, name: string) => void;
    deactivateManualMode: () => void;
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
}

let _cachedRoads: RoadZone[] = [];

async function loadRoadZones(): Promise<RoadZone[]> {
    if (_cachedRoads.length > 0) return _cachedRoads;
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
            }));
        }
    } catch { /* use empty — will retry next refresh */ }
    return _cachedRoads;
}

function isNearAnyRoadSync(lat: number, lon: number): { near: boolean; distM: number; routeId?: string } {
    for (const road of _cachedRoads) {
        if (lat >= road.latMin && lat <= road.latMax && lon >= road.lonMin && lon <= road.lonMax) {
            const distKm = haversineKm(lat, lon, road.roadLat, road.roadLon);
            const distM = Math.round(distKm * 1000);
            return { near: distKm < road.bufferKm, distM, routeId: road.id };
        }
    }
    return { near: false, distM: 9999 };
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

    useEffect(() => {
        AsyncStorage.getItem(LIVESTOCK_STORAGE_KEY).then(raw => {
            if (raw) setMyLivestock(JSON.parse(raw));
        });
    }, []);

    const refreshLivestock = useCallback(async () => {
        await loadRoadZones();
        const data = await fetchLivestockFromServer();
        setLivestock(prev => {
            // Сохраняем ручные записи поверх данных с сервера
            const manualEntries = prev.filter(l => l.trackingMode === 'phone');
            return [...manualEntries, ...data];
        });
    }, []);

    useEffect(() => {
        refreshLivestock();
        const interval = setInterval(refreshLivestock, 30_000);
        return () => clearInterval(interval);
    }, [refreshLivestock]);

    const activateManualMode = useCallback((
        type: Livestock['type'],
        count: number,
        name: string,
    ) => {
        if (!userLocation) return;
        const road = isNearAnyRoadSync(userLocation.lat, userLocation.lon);
        const entry: Livestock = {
            id: `manual-${Date.now()}`,
            ownerId,
            ownerName: 'Мен (қолмен режим)',
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
        setLivestock(prev => [entry, ...prev.filter(l => l.id !== entry.id)]);
    }, [userLocation, ownerId]);

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
    }, [userLocation?.lat, userLocation?.lon, isManualMode]);

    const deactivateManualMode = useCallback(() => {
        setIsManualMode(false);
        if (manualEntry) {
            setLivestock(prev => prev.filter(l => l.id !== manualEntry.id));
        }
        setManualEntry(null);
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
