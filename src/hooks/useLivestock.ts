/**
 * useLivestock.ts — управление данными скота
 *
 * Текущий режим: mock данные + manual mode
 * Будущий режим: WebSocket/MQTT от реальных трекеров
 *
 * 🎨 ANIMATION_SLOT: livestock_pulse — Lottie пульс для опасного скота (isNearRoad)
 */
import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MOCK_LIVESTOCK } from '../data/mockLivestock';
import { Livestock, LIVESTOCK_DANGER_DISTANCE_M, UserRole } from '../constants/livestock';
import { GeoPoint } from './useLocation';
import { Config } from '../config';
import axios from 'axios';

const LIVESTOCK_STORAGE_KEY = 'saferoute:livestock:registered';

interface UseLivestockReturn {
    livestock: Livestock[];
    dangerousLivestock: Livestock[];    // у дороги (<300м)
    myLivestock: Livestock[];           // зарегистрированный мой скот
    isManualMode: boolean;              // я активировал "Я с табуном"
    activateManualMode: (type: Livestock['type'], count: number, name: string) => void;
    deactivateManualMode: () => void;
    registerLivestock: (data: Omit<Livestock, 'id' | 'ownerId' | 'lastUpdated' | 'isNearRoad' | 'distanceToRoadM'>) => Promise<void>;
    refreshLivestock: () => Promise<void>;
}

/** Простая проверка близости к дороге по bounding box трасс */
function isNearAnyRoad(lat: number, lon: number): { near: boolean; distM: number; routeId?: string } {
    const roads = [
        { id: 'a17', latMin: 51.0, latMax: 52.5, lonMin: 71.3, lonMax: 77.2, widthKm: 0.5 },
        { id: 'a1', latMin: 43.0, latMax: 51.3, lonMin: 68.0, lonMax: 77.2, widthKm: 0.5 },
        { id: 'a21', latMin: 50.2, latMax: 52.5, lonMin: 75.0, lonMax: 80.5, widthKm: 0.5 },
        { id: 'e40', latMin: 42.2, latMax: 42.9, lonMin: 68.0, lonMax: 71.5, widthKm: 0.5 },
    ];

    for (const road of roads) {
        if (lat >= road.latMin && lat <= road.latMax && lon >= road.lonMin && lon <= road.lonMax) {
            // Примерная дистанция до края bounding box в метрах
            const distLat = Math.min(Math.abs(lat - road.latMin), Math.abs(lat - road.latMax)) * 111000;
            const distLon = Math.min(Math.abs(lon - road.lonMin), Math.abs(lon - road.lonMax)) * 85000;
            const distM = Math.min(distLat, distLon);
            return { near: distM < LIVESTOCK_DANGER_DISTANCE_M * 3, distM: Math.round(distM), routeId: road.id };
        }
    }
    return { near: false, distM: 9999 };
}

/** Маппинг HerdOut (FastAPI backend) → Livestock (мобильное приложение) */
function mapHerdToLivestock(herd: any): Livestock {
    const lat = herd.current_location?.latitude ?? herd.lat ?? 0;
    const lon = herd.current_location?.longitude ?? herd.lon ?? 0;
    const road = isNearAnyRoad(lat, lon);
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
        // FastAPI backend: /api/v1/herds/
        const res = await axios.get<any[]>(`${Config.BACKEND_URL}/api/v1/herds/`, {
            timeout: 5000,
        });
        if (Array.isArray(res.data) && res.data.length > 0) {
            return res.data.map(mapHerdToLivestock);
        }
    } catch { /* offline */ }
    return MOCK_LIVESTOCK;
}

export function useLivestock(userLocation: GeoPoint | null, ownerId = 'me'): UseLivestockReturn {
    const [livestock, setLivestock] = useState<Livestock[]>(MOCK_LIVESTOCK);
    const [myLivestock, setMyLivestock] = useState<Livestock[]>([]);
    const [isManualMode, setIsManualMode] = useState(false);
    const [manualEntry, setManualEntry] = useState<Livestock | null>(null);

    // Загрузка зарегистрированного скота из AsyncStorage
    useEffect(() => {
        AsyncStorage.getItem(LIVESTOCK_STORAGE_KEY).then(raw => {
            if (raw) setMyLivestock(JSON.parse(raw));
        });
    }, []);

    const refreshLivestock = useCallback(async () => {
        const data = await fetchLivestockFromServer();
        setLivestock(data);
    }, []);

    useEffect(() => {
        refreshLivestock();
        const interval = setInterval(refreshLivestock, 30_000); // каждые 30 сек
        return () => clearInterval(interval);
    }, [refreshLivestock]);

    // Ручной режим: позиция владельца = позиция стада
    const activateManualMode = useCallback((
        type: Livestock['type'],
        count: number,
        name: string,
    ) => {
        if (!userLocation) return;
        const road = isNearAnyRoad(userLocation.lat, userLocation.lon);
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
        // Добавить в общий список
        setLivestock(prev => [entry, ...prev.filter(l => l.id !== entry.id)]);
    }, [userLocation, ownerId]);

    // Обновление позиции в ручном режиме при движении
    useEffect(() => {
        if (!isManualMode || !userLocation || !manualEntry) return;
        const road = isNearAnyRoad(userLocation.lat, userLocation.lon);
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
        const road = isNearAnyRoad(data.latitude, data.longitude);
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

    const dangerousLivestock = livestock.filter(l => l.isNearRoad && l.distanceToRoadM < LIVESTOCK_DANGER_DISTANCE_M);

    return {
        livestock,
        dangerousLivestock,
        myLivestock,
        isManualMode,
        activateManualMode,
        deactivateManualMode,
        registerLivestock,
        refreshLivestock,
    };
}
