/**
 * useLocation Hook — SafeRoute / Sapa Jol
 *
 * Отвечает за:
 * - Запрос разрешений
 * - Начальную позицию
 * - watchPositionAsync (непрерывное отслеживание)
 * - Proximity detection с настраиваемым радиусом (2 км алерт, 500 м подтверждение)
 * - ДЕМО GPS Симулятор для презентации в помещении
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import * as Location from 'expo-location';
import { Incident, getIncidentMeta } from '../constants/incidents';
import { Config } from '../config';
import { updateDeviceLocation } from '../services/api';
import { getDeviceId } from '../services/deviceId';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SEEN_STORAGE_KEY = 'saferoute:proximity:seen';

export interface GeoPoint {
    lat: number;
    lon: number;
    heading: number | null;
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
    /** GPS Simulation for in-room presentations */
    isSimulating: boolean;
    simulationStage: 'idle' | 'approaching' | 'nearby' | 'passed';
    startSimulation: (targetIncident?: Incident) => void;
    stopSimulation: () => void;
    triggerSimulationStep: (stage: 'nearby' | 'confirm') => void;
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
    const myDeviceIdRef = useRef<string | null>(null);
    const [hasPermission, setHasPermission] = useState(false);
    const [loading, setLoading] = useState(true);
    const [nearbyAlert, setNearbyAlert] = useState<Incident | null>(null);
    const [confirmCandidate, setConfirmCandidate] = useState<Incident | null>(null);

    // Simulation states
    const [isSimulating, setIsSimulating] = useState(false);
    const [simulationStage, setSimulationStage] = useState<
        'idle' | 'approaching' | 'nearby' | 'passed'
    >('idle');
    const simulationTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // Refs чтобы не триггерить proximity дважды для одного инцидента.
    // Персистим в AsyncStorage: без этого после перезапуска приложение
    // снова спрашивало подтверждение по той же метке.
    const alertedIds = useRef<Set<number>>(new Set());
    const confirmIds = useRef<Set<number>>(new Set());

    const persistSeen = useCallback((alerted: Set<number>, confirmed: Set<number>) => {
        try {
            AsyncStorage.setItem(
                SEEN_STORAGE_KEY,
                JSON.stringify({ alerted: [...alerted], confirmed: [...confirmed] }),
            ).catch(() => {});
        } catch {
            /* ignore */
        }
    }, []);

    useEffect(() => {
        try {
            AsyncStorage.getItem(SEEN_STORAGE_KEY)
                .then((raw) => {
                    if (!raw) return;
                    const parsed = JSON.parse(raw) as { alerted?: number[]; confirmed?: number[] };
                    (parsed.alerted ?? []).forEach((id) => alertedIds.current.add(id));
                    (parsed.confirmed ?? []).forEach((id) => confirmIds.current.add(id));
                })
                .catch(() => {});
        } catch {
            /* ignore */
        }
    }, []);
    const sub = useRef<Location.LocationSubscription | null>(null);
    const lastSentRef = useRef<number>(0);
    const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (cancelled) return;
            setHasPermission(status === 'granted');

            if (status !== 'granted') {
                // Default fallback coords (Pavlodar)
                setLocation({ lat: 52.2855, lon: 76.9675, heading: 0 });
                setLoading(false);
                return;
            }

            try {
                const loc = await Location.getCurrentPositionAsync({
                    accuracy: Location.Accuracy.Balanced,
                });
                if (!cancelled) {
                    setLocation({
                        lat: loc.coords.latitude,
                        lon: loc.coords.longitude,
                        heading: loc.coords.heading ?? null,
                    });
                    setLoading(false);
                }
            } catch {
                if (!cancelled) {
                    setLocation({ lat: 52.2855, lon: 76.9675, heading: 0 });
                    setLoading(false);
                }
            }

            try {
                sub.current = await Location.watchPositionAsync(
                    {
                        accuracy: Location.Accuracy.Balanced,
                        distanceInterval: Config.LOCATION_DISTANCE_M,
                        timeInterval: Config.LOCATION_INTERVAL_MS,
                    },
                    (newLoc) => {
                        if (!cancelled && !isSimulating) {
                            const lat = newLoc.coords.latitude;
                            const lon = newLoc.coords.longitude;
                            const heading = newLoc.coords.heading ?? null;
                            setLocation({ lat, lon, heading });

                            const now = Date.now();
                            if (now - lastSentRef.current > 30_000) {
                                lastSentRef.current = now;
                                getDeviceId().then((id) =>
                                    updateDeviceLocation(id, lat, lon).catch(() => {}),
                                );
                            }
                        }
                    },
                );
            } catch {
                /* watch unavailable */
            }
        })();

        return () => {
            cancelled = true;
            sub.current?.remove();
        };
    }, [isSimulating]);

    // Own device id for the author anti-spam cooldown below
    useEffect(() => {
        getDeviceId()
            .then((id) => {
                myDeviceIdRef.current = id;
            })
            .catch(() => {});
    }, []);

    // Proximity check — запускается при изменении позиции или инцидентов
    useEffect(() => {
        if (!location || incidents.length === 0) return;

        for (const inc of incidents) {
            if (!inc.is_active) continue;

            // Анти-спам: автор метки стоит В точке метки в момент создания —
            // первые 3 минуты его собственную метку не алертим.
            // Через 3 минуты метка для автора — обычная опасность (и это
            // позволяет тестировать proximity с одного устройства).
            if (
                inc.reporter_device_id &&
                inc.reporter_device_id === myDeviceIdRef.current &&
                Date.now() - new Date(inc.created_at).getTime() < 3 * 60 * 1000
            )
                continue;
            const dist = haversineKm(location.lat, location.lon, inc.latitude, inc.longitude);

            // Алерт-баннер 2 км
            if (dist <= proximityRadiusKm && !alertedIds.current.has(inc.id)) {
                alertedIds.current.add(inc.id);
                persistSeen(alertedIds.current, confirmIds.current);
                setNearbyAlert(inc);
                const title = '⚠️ Абай болыңыз!';
                const body = inc.description || getIncidentMeta(inc.incident_type).label;
                onNearbyAlert?.(inc.id, title, body);
                if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
                dismissTimerRef.current = setTimeout(() => setNearbyAlert(null), 8000);
            }

            // Диалог подтверждения 0.5 км — автору свою метку не предлагаем
            if (
                dist <= 0.5 &&
                !confirmIds.current.has(inc.id) &&
                inc.reporter_device_id !== myDeviceIdRef.current
            ) {
                confirmIds.current.add(inc.id);
                persistSeen(alertedIds.current, confirmIds.current);
                setConfirmCandidate(inc);
            }
        }
    }, [location, incidents, proximityRadiusKm, onNearbyAlert]);

    const dismissNearbyAlert = useCallback(() => {
        if (dismissTimerRef.current) {
            clearTimeout(dismissTimerRef.current);
            dismissTimerRef.current = null;
        }
        setNearbyAlert(null);
    }, []);

    const dismissConfirmCandidate = useCallback(() => setConfirmCandidate(null), []);

    // ── GPS Simulation Engine ──────────────────────────────────────────────
    const startSimulation = useCallback(
        (targetIncident?: Incident) => {
            const target = targetIncident ||
                incidents.find((i) => i.is_active) || {
                    latitude: 52.2855,
                    longitude: 76.9675,
                    id: 99999,
                    incident_type: 'animal' as const,
                    severity: 3,
                    description: 'Киіктер табыны / Стадо сайгаков',
                    is_active: true,
                    confirmations_count: 0,
                    created_at: new Date().toISOString(),
                };

            // Reset alerted tracking so the banner and dialog trigger reliably
            alertedIds.current.delete(target.id);
            confirmIds.current.delete(target.id);

            setIsSimulating(true);
            setSimulationStage('approaching');

            // Start at ~2.5 km south of incident (approx -0.0225 latitude)
            setLocation({
                lat: target.latitude - 0.0225,
                lon: target.longitude,
                heading: 0,
            });
        },
        [incidents],
    );

    const stopSimulation = useCallback(() => {
        setIsSimulating(false);
        setSimulationStage('idle');
        if (simulationTimerRef.current) {
            clearInterval(simulationTimerRef.current);
            simulationTimerRef.current = null;
        }
    }, []);

    const triggerSimulationStep = useCallback(
        (stage: 'nearby' | 'confirm') => {
            const target = incidents.find((i) => i.is_active) || {
                latitude: 52.2855,
                longitude: 76.9675,
                id: 99999,
            };

            if (stage === 'nearby') {
                // Place at ~1.6 km (within 2 km proximity)
                alertedIds.current.delete(target.id);
                setSimulationStage('nearby');
                setLocation({
                    lat: target.latitude - 0.0145,
                    lon: target.longitude,
                    heading: 0,
                });
            } else if (stage === 'confirm') {
                // Place at ~0.35 km (within 500m confirmation dialog)
                confirmIds.current.delete(target.id);
                setSimulationStage('passed');
                setLocation({
                    lat: target.latitude - 0.003,
                    lon: target.longitude,
                    heading: 0,
                });
            }
        },
        [incidents],
    );

    useEffect(
        () => () => {
            if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
            if (simulationTimerRef.current) clearInterval(simulationTimerRef.current);
        },
        [],
    );

    return {
        location,
        hasPermission,
        loading,
        nearbyAlert,
        confirmCandidate,
        dismissNearbyAlert,
        dismissConfirmCandidate,
        isSimulating,
        simulationStage,
        startSimulation,
        stopSimulation,
        triggerSimulationStep,
    };
}
