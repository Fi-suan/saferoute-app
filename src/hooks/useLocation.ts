/**
 * useLocation Hook — SafeRoute / Sapa Jol
 *
 * Выносит логику геолокации из MapScreen (~60 строк спагетти-кода).
 * Отвечает за:
 * - Запрос разрешений
 * - Начальную позицию
 * - watchPositionAsync (непрерывное отслеживание)
 * - Proximity detection с настраиваемым радиусом
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import * as Location from 'expo-location';
import { Incident } from '../constants/incidents';
import { Config } from '../config';
import { updateDeviceLocation } from '../services/api';
import { getDeviceId } from '../services/deviceId';

export interface GeoPoint {
    lat: number;
    lon: number;
}

interface UseLocationReturn {
    location: GeoPoint | null;
    hasPermission: boolean;
    loading: boolean;
    /** Инцидент в радиусе предупреждения (2 км) */
    nearbyAlert: Incident | null;
    /** Инцидент в радиусе подтверждения (0.5 км) — просит пользователя ответить */
    confirmCandidate: Incident | null;
    dismissNearbyAlert: () => void;
    dismissConfirmCandidate: () => void;
}

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

export function useLocation(
    incidents: Incident[],
    proximityRadiusKm: number = Config.DEFAULT_PROXIMITY_RADIUS_KM,
    onNearbyAlert?: (incidentId: number, title: string, body: string) => void,
): UseLocationReturn {
    const [location, setLocation] = useState<GeoPoint | null>(null);
    const [hasPermission, setHasPermission] = useState(false);
    const [loading, setLoading] = useState(true);
    const [nearbyAlert, setNearbyAlert] = useState<Incident | null>(null);
    const [confirmCandidate, setConfirmCandidate] = useState<Incident | null>(null);

    // Refs чтобы не триггерить proximity дважды для одного инцидента
    const alertedIds = useRef<Set<number>>(new Set());
    const confirmIds = useRef<Set<number>>(new Set());
    const sub = useRef<Location.LocationSubscription | null>(null);
    const lastSentRef = useRef<number>(0);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (cancelled) return;
            setHasPermission(status === 'granted');

            if (status !== 'granted') {
                setLoading(false);
                return;
            }

            const loc = await Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.High,
            });
            if (!cancelled) {
                setLocation({ lat: loc.coords.latitude, lon: loc.coords.longitude });
                setLoading(false);
            }

            sub.current = await Location.watchPositionAsync(
                {
                    accuracy: Location.Accuracy.High,
                    distanceInterval: Config.LOCATION_DISTANCE_M,
                    timeInterval: Config.LOCATION_INTERVAL_MS,
                },
                (newLoc) => {
                    if (!cancelled) {
                        const lat = newLoc.coords.latitude;
                        const lon = newLoc.coords.longitude;
                        setLocation({ lat, lon });

                        // Send location to backend every 30s
                        const now = Date.now();
                        if (now - lastSentRef.current > 30_000) {
                            lastSentRef.current = now;
                            getDeviceId().then(id =>
                                updateDeviceLocation(id, lat, lon).catch(() => {})
                            );
                        }
                    }
                },
            );
        })();

        return () => {
            cancelled = true;
            sub.current?.remove();
        };
    }, []);

    // Proximity check — запускается при изменении позиции или инцидентов
    useEffect(() => {
        if (!location || incidents.length === 0) return;

        for (const inc of incidents) {
            if (!inc.is_active) continue;
            const dist = haversineKm(location.lat, location.lon, inc.latitude, inc.longitude);

            // Алерт-баннер 2 км
            if (dist <= proximityRadiusKm && !alertedIds.current.has(inc.id)) {
                alertedIds.current.add(inc.id);
                setNearbyAlert(inc);
                // Notify log callback
                const title = '⚠️ Абай болыңыз!';
                const body = inc.description || inc.incident_type;
                onNearbyAlert?.(inc.id, title, body);
                // Автоматически скрыть через 8 сек
                setTimeout(() => setNearbyAlert(null), 8000);
            }

            // Диалог подтверждения 0.5 км
            if (dist <= 0.5 && !confirmIds.current.has(inc.id)) {
                confirmIds.current.add(inc.id);
                setConfirmCandidate(inc);
            }
        }
    }, [location, incidents, proximityRadiusKm]);

    const dismissNearbyAlert = useCallback(() => setNearbyAlert(null), []);
    const dismissConfirmCandidate = useCallback(() => setConfirmCandidate(null), []);

    return {
        location,
        hasPermission,
        loading,
        nearbyAlert,
        confirmCandidate,
        dismissNearbyAlert,
        dismissConfirmCandidate,
    };
}
