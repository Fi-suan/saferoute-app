/**
 * useLocation Hook — SafeRoute / Sapa Jol
 *
 * Отвечает за:
 * - Запрос разрешений
 * - Начальную позицию
 * - watchPositionAsync (непрерывное отслеживание)
 * - Proximity detection с настраиваемым радиусом (2 км алерт, 500 м подтверждение)
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import * as Location from 'expo-location';
import { Incident, getIncidentMeta } from '../constants/incidents';
import { Config } from '../config';
import { updateDeviceLocation } from '../services/api';
import { getDeviceId } from '../services/deviceId';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useT } from '../i18n';

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
    /** Инцидент в радиусе подтверждения (0,5 км) — просит пользователя ответить */
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
    const t = useT();
    const [location, setLocation] = useState<GeoPoint | null>(null);
    const myDeviceIdRef = useRef<string | null>(null);
    const [hasPermission, setHasPermission] = useState(false);
    const [loading, setLoading] = useState(true);
    const [nearbyAlert, setNearbyAlert] = useState<Incident | null>(null);
    const [confirmCandidate, setConfirmCandidate] = useState<Incident | null>(null);

    // Refs чтобы не триггерить proximity дважды для одного инцидента.
    // Персистим в AsyncStorage с TTL 24 ч: метки дорог живут неделями, а
    // водитель-маятниковик проезжает ту же метку каждый день — «один
    // алерт НАВСЕГДА» лишал его предупреждений (найдено мега-тестом).
    const alertedAt = useRef<Map<number, number>>(new Map());
    const confirmedAt = useRef<Map<number, number>>(new Map());

    const ALERT_TTL_MS = 24 * 60 * 60 * 1000;

    const isFresh = (m: Map<number, number>, id: number): boolean => {
        const ts = m.get(id);
        return ts != null && Date.now() - ts < ALERT_TTL_MS;
    };

    const persistSeen = useCallback((alerted: Map<number, number>, confirmed: Map<number, number>) => {
        try {
            AsyncStorage.setItem(
                SEEN_STORAGE_KEY,
                JSON.stringify({
                    alerted: [...alerted.entries()],
                    confirmed: [...confirmed.entries()],
                }),
            ).catch(() => {});
        } catch {
            /* ignore */
        }
    }, []);

    const seenIds = (m: Map<number, number>): Set<number> =>
        new Set([...m.entries()].filter(([, ts]) => Date.now() - ts < ALERT_TTL_MS).map(([id]) => id));

    useEffect(() => {
        try {
            AsyncStorage.getItem(SEEN_STORAGE_KEY)
                .then((raw) => {
                    if (!raw) return;
                    const parsed = JSON.parse(raw) as {
                        alerted?: Array<[number, number] | number>;
                        confirmed?: Array<[number, number] | number>;
                    };
                    const toMap = (v: Array<[number, number] | number> | undefined) => {
                        const m = new Map<number, number>();
                        (v ?? []).forEach((e) => {
                            if (Array.isArray(e)) m.set(e[0], e[1] ?? 0);
                            else if (typeof e === 'number') m.set(e, 0);
                        });
                        // просроченные не переносим
                        [...m.entries()].forEach(([id, ts]) => {
                            if (Date.now() - ts >= ALERT_TTL_MS) m.delete(id);
                        });
                        return m;
                    };
                    toMap(parsed.alerted).forEach((ts, id) => alertedAt.current.set(id, ts));
                    toMap(parsed.confirmed).forEach((ts, id) => confirmedAt.current.set(id, ts));
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
                // Отказ в GPS: НЕ подставляем фейковые координаты Павлодара —
                // иначе метки/алерты считались бы от чужой точки, а карта
                // врала «вы здесь». location остаётся null, UI честно просит
                // включить геолокацию (диалог с кнопкой «Открыть настройки»).
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
                // GPS ещё не поймал спутники — оставляем null, wait-позиция
                // придёт из watchPositionAsync ниже
                if (!cancelled) setLoading(false);
            }

            try {
                sub.current = await Location.watchPositionAsync(
                    {
                        accuracy: Location.Accuracy.Balanced,
                        distanceInterval: Config.LOCATION_DISTANCE_M,
                        timeInterval: Config.LOCATION_INTERVAL_MS,
                    },
                    (newLoc) => {
                        if (!cancelled) {
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
    }, []);

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
            if (dist <= proximityRadiusKm && !isFresh(alertedAt.current, inc.id)) {
                alertedAt.current.set(inc.id, Date.now());
                persistSeen(alertedAt.current, confirmedAt.current);
                setNearbyAlert(inc);
                const title = t('notif_proximity_title');
                const body = inc.description || getIncidentMeta(inc.incident_type).label;
                onNearbyAlert?.(inc.id, title, body);
                if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
                dismissTimerRef.current = setTimeout(() => setNearbyAlert(null), 8000);
            }

            // Диалог подтверждения 0.5 км — автору свою метку не предлагаем
            if (
                dist <= 0.5 &&
                !isFresh(confirmedAt.current, inc.id) &&
                inc.reporter_device_id !== myDeviceIdRef.current
            ) {
                confirmedAt.current.set(inc.id, Date.now());
                persistSeen(alertedAt.current, confirmedAt.current);
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

    useEffect(
        () => () => {
            if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
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
    };
}
