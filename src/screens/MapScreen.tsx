/**
 * MapScreen — SafeRoute / Sapa Jol
 *
 * Orchestrator-уровень: хуки, state, эффекты, обработчики.
 * Вся UI-разметка вынесена в src/screens/map/* (sub-components).
 */
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Vibration, Linking } from 'react-native';
import {
    Map as MGLMapView,
    Camera as MGLCamera,
    GeoJSONSource,
    Layer,
    UserLocation,
    MapRef,
    CameraRef,
} from '@maplibre/maplibre-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import LottieView from 'lottie-react-native';
import { useNavigation, CompositeNavigationProp, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';

import { Colors, Spacing, Radius, Shadow } from '../constants/colors';
import { getIncidentMeta, Incident } from '../constants/incidents';
import { LivestockType } from '../constants/livestock';
import { useIncidents } from '../hooks/useIncidents';
import { useLocation } from '../hooks/useLocation';
import { useRoute } from '../hooks/useRoute';
import { useLivestock } from '../hooks/useLivestock';
import { useUserProfile } from '../hooks/useUserProfile';
import { Config } from '../config';
import { STORAGE } from '../constants/storage';
import ProximityBanner from '../components/ProximityBanner';
import ReportModal from '../components/ReportModal';
import { useToast } from '../components/Toast';
import { RootStackParamList } from '../navigation/RootNavigator';
import { scheduleProximityNotification } from '../services/notifications';
import { useAppDialog } from '../components/AppDialog';
import { useT } from '../i18n';
import { fetchDirections, DirectionsResult } from '../services/directions';
import { useRoutePolyline } from '../hooks/useRoutePolyline';
import { useNotificationLog } from '../hooks/useNotificationLog';
import { useSettings } from '../hooks/useSettings';

import {
    ROUTE_ENDPOINTS,
    ROUTE_WAYPOINTS,
    ROAD_STATUS_COLOR,
    OPENFREEMAP_DARK_STYLE,
    FilterType,
} from './map/constants';
import { IncidentMarkers, LivestockMarkers } from './map/MapMarkers';
import MapTopBar from './map/MapTopBar';
import MapFilters from './map/MapFilters';
import NavigationCard from './map/NavigationCard';
import ConfirmDialog from './map/ConfirmDialog';
import OwnerPanel from './map/OwnerPanel';

type NavProp = CompositeNavigationProp<
    BottomTabNavigationProp<Record<string, undefined>>,
    NativeStackNavigationProp<RootStackParamList>
>;

/** Открывает системные настройки приложения (разрешения GPS/камеры) */
function openAppSettings() {
    Linking.openSettings().catch(() => undefined);
}

/** Haversine distance in meters (для шагов навигации) */
function haversineM(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6_371_000;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos((lat1 * Math.PI) / 180) *
            Math.cos((lat2 * Math.PI) / 180) *
            Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default function MapScreen() {
    const navigation = useNavigation<NavProp>();
    const mapRef = useRef<MapRef>(null);
    const cameraRef = useRef<CameraRef>(null);
    const [filter, setFilter] = useState<FilterType>('all');
    const [showReport, setShowReport] = useState(false);
    const [showOwnerPanel, setShowOwnerPanel] = useState(false);
    const [confirmDialog, setConfirmDialog] = useState<Incident | null>(null);
    const [selectedType, setSelectedType] = useState<LivestockType>('horse');
    const [livestockCount, setLivestockCount] = useState(10);
    const [activeRouteId, setActiveRouteId] = useState<string>('a17');
    const [navResult, setNavResult] = useState<DirectionsResult | null>(null);
    const [navStepIdx, setNavStepIdx] = useState(0);
    const [navProgress, setNavProgress] = useState(0);
    const [navLoading, setNavLoading] = useState(false);
    const dangerZoneAlertedRef = useRef(false);

    const t = useT();
    const { showToast, ToastComponent } = useToast();
    const { profile } = useUserProfile();
    const { showDialog, DialogComponent } = useAppDialog();
    const { settings } = useSettings();
    const { addEntry: addNotifEntry } = useNotificationLog();

    const { incidents, isOnline, loading, submitReport, confirmIncident, pendingReportsCount } =
        useIncidents('active');
    const { location, hasPermission, nearbyAlert, confirmCandidate, dismissNearbyAlert, dismissConfirmCandidate } =
        useLocation(incidents, Config.DEFAULT_PROXIMITY_RADIUS_KM, (incidentId, title, body) => {
            addNotifEntry({ title, body, incidentId });
        });

    const { routeIncidents, roadStatus } = useRoute(incidents, activeRouteId);
    const cachedPolyline = useRoutePolyline(activeRouteId);

    const { livestock, activateManualMode, deactivateManualMode, isManualMode, dangerZoneAlert } =
        useLivestock(location);

    // ── Effects ───────────────────────────────────────────────────────────────

    // Read selected route on tab focus
    useFocusEffect(
        useCallback(() => {
            AsyncStorage.getItem(STORAGE.ACTIVE_ROUTE).then((id) => {
                if (id && ROUTE_WAYPOINTS[id]) setActiveRouteId(id);
            });
        }, []),
    );

    // Route switched → stale navigation would point at the old destination
    useEffect(() => {
        setNavResult(null);
        setNavStepIdx(0);
        setNavProgress(0);
        setNavLoading(false);
    }, [activeRouteId]);

    // Push notification on proximity (respects soundEnabled)
    useEffect(() => {
        if (!nearbyAlert) return;
        const meta = getIncidentMeta(nearbyAlert.incident_type);
        if (settings.vibrationEnabled) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        }
        scheduleProximityNotification({
            title: t('notif_proximity_title'),
            body: `${meta.label}${nearbyAlert.description ? ` — ${nearbyAlert.description}` : ''}`,
            incidentId: nearbyAlert.id,
            soundEnabled: settings.soundEnabled,
        });
    }, [nearbyAlert?.id]);

    // Confirmation dialog
    useEffect(() => {
        if (confirmCandidate) setConfirmDialog(confirmCandidate);
    }, [confirmCandidate?.id]);

    // Danger Zone — 3+ herds within 500m (drivers only)
    useEffect(() => {
        if (dangerZoneAlert && !dangerZoneAlertedRef.current && profile.role === 'driver') {
            dangerZoneAlertedRef.current = true;
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            showDialog({
                title: t('danger_zone_title'),
                message: t('danger_zone_msg'),
                icon: 'warning',
                iconColor: Colors.alert.high,
                buttons: [{ text: t('understand'), style: 'default' }],
            });
        }
        if (!dangerZoneAlert) dangerZoneAlertedRef.current = false;
    }, [dangerZoneAlert, profile.role]);

    // Advance navigation step when within 80m of step endpoint
    useEffect(() => {
        if (!navResult || !location) return;
        const step = navResult.steps[navStepIdx];
        if (!step) return;
        const distM = haversineM(location.lat, location.lon, step.end.latitude, step.end.longitude);
        if (distM < 80) {
            if (navStepIdx < navResult.steps.length - 1) {
                setNavStepIdx((i) => i + 1);
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            } else {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                setNavResult(null);
                setNavStepIdx(0);
            setNavProgress(0);
                showDialog({
                    title: t('route_mode_label'),
                    message: t('nav_arrived'),
                    icon: 'checkmark-circle',
                    iconColor: Colors.brand.primary,
                    buttons: [{ text: t('understand'), style: 'default' }],
                });
            }
        }
    }, [location?.lat, location?.lon]);

    // Camera follows location with tilt and heading during navigation
    useEffect(() => {
        if (!navResult || !location) return;
        // Android отдаёт heading = -1 («нет данных») — не дёргаем камеру им
        const heading = location.heading != null && location.heading >= 0 ? location.heading : 0;
        cameraRef.current?.easeTo({
            center: [location.lon, location.lat],
            zoom: 16,
            pitch: 45,
            bearing: heading,
            duration: 600,
        });
    }, [location?.lat, location?.lon, location?.heading, !!navResult]);

    // Реальный прогресс навигации: пройденное расстояние вдоль полилинии
    // до ближайшей к текущей позиции точки / общая длина маршрута
    useEffect(() => {
        if (!navResult || !location) return;
        const coords = navResult.polyline;
        if (coords.length < 2) return;
        let best = 0;
        let bestD = Infinity;
        for (let i = 0; i < coords.length; i++) {
            const d = haversineM(location.lat, location.lon, coords[i].latitude, coords[i].longitude);
            if (d < bestD) {
                bestD = d;
                best = i;
            }
        }
        let travelled = 0;
        for (let i = 1; i <= best; i++) {
            travelled += haversineM(coords[i - 1].latitude, coords[i - 1].longitude, coords[i].latitude, coords[i].longitude);
        }
        let total = travelled;
        for (let i = best + 1; i < coords.length; i++) {
            total += haversineM(coords[i - 1].latitude, coords[i - 1].longitude, coords[i].latitude, coords[i].longitude);
        }
        setNavProgress(total > 0 ? Math.min(100, (travelled / total) * 100) : 0);
    }, [location?.lat, location?.lon, !!navResult]);

    // ── Handlers ──────────────────────────────────────────────────────────────

    const goToDetail = (incident: Incident) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        navigation.navigate('IncidentDetail', { incident });
    };

    const handleConfirm = async (isResolved: boolean) => {
        if (!confirmDialog) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        const incident = confirmDialog;
        setConfirmDialog(null);
        dismissConfirmCandidate();
        const ok = await confirmIncident(incident.id, isResolved);
        if (!ok) {
            // Сервер не принял (офлайн/rate-limit) — честно сообщаем, оптимистичный
            // счётчик уже откачен хуком
            showDialog({
                title: t('confirm_failed'),
                message: t('confirm_failed_msg'),
                icon: 'cloud-offline',
                iconColor: Colors.alert.medium,
                buttons: [{ text: t('understand'), style: 'default' }],
            });
            return;
        }
        if (isResolved)
            showDialog({
                title: t('confirm_thanks'),
                message: t('confirm_thanks_msg'),
                icon: 'checkmark-circle',
                iconColor: Colors.brand.primary,
                buttons: [{ text: t('understand'), style: 'default' }],
            });
    };

    const handleConfirmDialogDetail = () => {
        const incident = confirmDialog;
        setConfirmDialog(null);
        dismissConfirmCandidate();
        if (incident) goToDetail(incident);
    };

    const handleSOSLongPress = () => {
        Vibration.vibrate([0, 100, 80, 200, 80, 400, 80, 600]);
        // Без GPS-разрешения координаты — фолбэк-точка: SOS-метка «ДТП» там
        // была бы ложью и спамила бы чужой район. Требуем честную геолокацию.
        if (!hasPermission) {
            showDialog({
                title: t('gps_denied_title'),
                message: t('gps_denied_msg'),
                icon: 'location',
                iconColor: Colors.alert.high,
                buttons: [
                    { text: t('open_settings'), icon: 'settings', style: 'default', onPress: openAppSettings },
                    { text: t('understand'), style: 'cancel' },
                ],
            });
            return;
        }
        showDialog({
            title: t('sos_title'),
            message: t('sos_msg'),
            icon: 'alert-circle',
            iconColor: Colors.alert.critical,
            buttons: [
                {
                    text: t('sos_place_marker'),
                    icon: 'location',
                    style: 'default',
                    onPress: async () => {
                        if (!location) {
                            showDialog({
                                title: t('sos_failed'),
                                message: t('report_error_no_location'),
                                icon: 'warning',
                                iconColor: Colors.alert.high,
                                buttons: [{ text: t('understand'), style: 'default' }],
                            });
                            return;
                        }
                        const res = await submitReport({
                            incident_type: 'crash',
                            description: t('sos_marker_desc'),
                            severity: 5,
                            latitude: location.lat,
                            longitude: location.lon,
                        });
                        if (!res.ok) {
                            showDialog({
                                title: t('sos_failed'),
                                message: t('sos_failed_msg'),
                                icon: 'warning',
                                iconColor: Colors.alert.high,
                                buttons: [{ text: t('understand'), style: 'default' }],
                            });
                            return;
                        }
                        showDialog({
                            title: t('sos_placed'),
                            message: t('sos_placed_msg'),
                            icon: 'checkmark-circle',
                            iconColor: Colors.brand.primary,
                            buttons: [{ text: t('understand'), style: 'default' }],
                        });
                    },
                },
                { text: t('sos_cancel'), style: 'cancel' },
            ],
        });
    };

    const handleActivateManualMode = () => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        const key = `livestock_${selectedType}` as any;
        const label = t(key) || selectedType;
        activateManualMode(selectedType, livestockCount, `${label} табуны`);
        setShowOwnerPanel(false);
    };

    const handleDeactivateManualMode = () => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        deactivateManualMode();
        setShowOwnerPanel(false);
    };

    const handleNorthReset = async () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        const center = await mapRef.current?.getCenter();
        if (!center) return;
        cameraRef.current?.easeTo({ center, bearing: 0, pitch: 0, duration: 300 });
    };

    const handleLocateMe = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        if (!location) return;
        cameraRef.current?.easeTo({
            center: [location.lon, location.lat],
            zoom: 13,
            duration: 500,
        });
    };

    const handleToggleNavigation = async () => {
        if (navResult) {
            setNavResult(null);
            setNavStepIdx(0);
            setNavProgress(0);
            return;
        }
        if (!location) {
            showDialog({
                title: t('report_error_no_location'),
                message: '',
                icon: 'warning',
                iconColor: Colors.alert.high,
                buttons: [{ text: t('understand'), style: 'default' }],
            });
            return;
        }
        setNavLoading(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        const dest = ROUTE_ENDPOINTS[activeRouteId] ?? ROUTE_ENDPOINTS.a17;
        const result = await fetchDirections({ lat: location.lat, lon: location.lon }, dest);
        setNavLoading(false);
        if (result) {
            setNavResult(result);
            setNavStepIdx(0);
            setNavProgress(0);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } else {
            showDialog({
                title: t('route_mode_label'),
                message: t('nav_failed'),
                icon: 'warning',
                iconColor: Colors.alert.high,
                buttons: [{ text: t('understand'), style: 'default' }],
            });
        }
    };

    const handleStopNavigation = () => {
        setNavResult(null);
        setNavStepIdx(0);
            setNavProgress(0);
    };

    const handleFabPress = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        // Без GPS-разрешения «локация» — это фолбэк-координаты: метки по ним
        // ставить нельзя (ложные данные). Честно просим включить геолокацию.
        if (!hasPermission) {
            showDialog({
                title: t('gps_denied_title'),
                message: t('gps_denied_msg'),
                icon: 'location',
                iconColor: Colors.alert.high,
                buttons: [
                    {
                        text: t('open_settings'),
                        icon: 'settings',
                        style: 'default',
                        onPress: openAppSettings,
                    },
                    { text: t('understand'), style: 'cancel' },
                ],
            });
            return;
        }
        if (profile.role === 'livestock_owner') setShowOwnerPanel(true);
        else setShowReport(true);
    };

    // ── Derived ──────────────────────────────────────────────────────────────

    const displayedIncidents = routeIncidents.filter((i) => i.is_active);
    const showIncidents = filter === 'all' || filter === 'incidents';
    const showLivestock = filter === 'all' || filter === 'livestock';
    const routeCoords = navResult ? navResult.polyline : cachedPolyline;

    // Начальный вид камеры фиксируем один раз при монтировании карты (MapLibre
    // Camera — управляемый компонент: пропсы обновляли бы центр на каждый GPS-фикс).
    const initialCamRef = useRef<{ center: [number, number]; zoom: number } | null>(null);
    if (initialCamRef.current === null) {
        initialCamRef.current = location
            ? { center: [location.lon, location.lat], zoom: 12.5 }
            : { center: [74.2, 51.96], zoom: 6.5 };
    }

    // Полилиния маршрута → GeoJSON (MapLibre: [lng, lat])
    const routeGeoJSON = useMemo(
        () => ({
            type: 'FeatureCollection' as const,
            features: [
                {
                    type: 'Feature' as const,
                    properties: { color: ROAD_STATUS_COLOR[roadStatus] },
                    geometry: {
                        type: 'LineString' as const,
                        coordinates: routeCoords.map(
                            (c) => [c.longitude, c.latitude] as [number, number],
                        ),
                    },
                },
            ],
        }),
        [routeCoords, roadStatus],
    );

    // ── Render ────────────────────────────────────────────────────────────────

    if (loading) {
        return (
            <View style={styles.loadingWrap}>
                <LottieView
                    source={require('../assets/lottie/loading.json')}
                    autoPlay
                    loop
                    style={{ width: 120, height: 120 }}
                />
                <Text style={styles.loadingText}>{t('loading_location')}</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            {/* MapLibre + OpenFreeMap: тёмная карта на OSM-данных, БЕЗ Google
                SDK и ключей (react-native-maps на Android без Google-ключа
                рендерит только чёрный экран — UrlTile не на чём рисовать). */}
            <MGLMapView
                ref={mapRef}
                style={styles.map}
                mapStyle={OPENFREEMAP_DARK_STYLE}
                attribution={false}
                logo={false}
                compass={false}
                scaleBar={false}
            >
                <MGLCamera
                    ref={cameraRef}
                    center={initialCamRef.current.center}
                    zoom={initialCamRef.current.zoom}
                    duration={0}
                />
                <UserLocation />

                {showIncidents && (
                    <IncidentMarkers incidents={displayedIncidents} onCalloutPress={goToDetail} />
                )}
                {showLivestock && <LivestockMarkers livestock={livestock} />}

                {/* Route polyline: белая подложка + цветной слой по статусу дороги */}
                <GeoJSONSource id="route-src" data={routeGeoJSON}>
                    <Layer
                        id="route-backing"
                        type="line"
                        style={{
                            lineColor: 'rgba(255,255,255,0.12)',
                            lineWidth: 8,
                            lineCap: 'round',
                            lineJoin: 'round',
                        }}
                    />
                    <Layer
                        id="route-main"
                        type="line"
                        style={{
                            lineColor: ['get', 'color'],
                            lineWidth: 4,
                            lineCap: 'round',
                            lineJoin: 'round',
                            ...(roadStatus === 'closed' ? { lineDasharray: [2.5, 1.5] } : {}),
                        }}
                    />
                </GeoJSONSource>
            </MGLMapView>

            {/* Атрибуция OSM обязательна по лицензии (OpenFreeMap — OSM-данные).
                ВАЖНО: снаружи MapView, не как ребёнь карты. */}
            <View style={styles.tileAttribution} pointerEvents="none">
                <Text style={styles.tileAttributionText}>© OpenStreetMap contributors</Text>
            </View>

            <View style={styles.topStack} pointerEvents="box-none">
                <MapTopBar
                    incidentCount={displayedIncidents.length}
                    pendingReportsCount={pendingReportsCount}
                    isManualMode={isManualMode}
                    isOnline={isOnline}
                    roadStatus={roadStatus}
                    activeRouteId={activeRouteId}
                    navResult={navResult}
                    navLoading={navLoading}
                    onToggleNavigation={handleToggleNavigation}
                />
                <MapFilters filter={filter} onChange={setFilter} />
            </View>

            {navResult && (
                <NavigationCard
                    navResult={navResult}
                    navStepIdx={navStepIdx}
                    progressPct={navProgress}
                    onStop={handleStopNavigation}
                />
            )}

            {/* Right buttons: compass + locate. В режиме навигации FAB уезжает
                наверх (bottom: 210) и перекрывал эти кнопки — поднимаем и их. */}
            <View style={[styles.rightBtns, !!navResult && styles.rightBtnsNav]}>
                <TouchableOpacity style={styles.mapBtn} onPress={handleNorthReset}>
                    <Ionicons name="compass-outline" size={20} color={Colors.text.secondary} />
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.mapBtn, styles.mapBtnPrimary]}
                    onPress={handleLocateMe}
                >
                    <Ionicons name="locate" size={20} color={Colors.brand.primary} />
                </TouchableOpacity>
            </View>

            {/* FAB — Report or Owner panel; long-press = SOS */}
            <TouchableOpacity
                style={[
                    styles.fab,
                    isManualMode && styles.fabManual,
                    !!navResult && styles.fabNavActive,
                ]}
                onPress={handleFabPress}
                onLongPress={handleSOSLongPress}
                delayLongPress={1500}
            >
                <LottieView
                    source={require('../assets/lottie/alert_pulse.json')}
                    autoPlay
                    loop
                    style={{ position: 'absolute', width: 104, height: 104 }}
                />
                <Ionicons
                    name={profile.role === 'livestock_owner' ? 'paw' : 'add'}
                    size={26}
                    color={Colors.bg.primary}
                />
            </TouchableOpacity>

            {nearbyAlert && (
                <ProximityBanner
                    incident={nearbyAlert}
                    onDismiss={dismissNearbyAlert}
                    onViewDetail={goToDetail}
                />
            )}

            <ConfirmDialog
                incident={confirmDialog}
                onConfirm={handleConfirm}
                onViewDetail={handleConfirmDialogDetail}
                onClose={() => {
                    setConfirmDialog(null);
                    dismissConfirmCandidate();
                }}
            />

            <ReportModal
                visible={showReport}
                onClose={() => setShowReport(false)}
                location={location}
                onSubmit={submitReport}
                onSuccess={(message, queued) =>
                    showToast({
                        text: message,
                        icon: queued ? 'cloud-offline' : 'checkmark-circle',
                        color: queued ? Colors.alert.medium : Colors.brand.primary,
                    })
                }
            />

            <OwnerPanel
                visible={showOwnerPanel}
                isManualMode={isManualMode}
                selectedType={selectedType}
                livestockCount={livestockCount}
                hasLocation={!!location}
                onClose={() => setShowOwnerPanel(false)}
                onSelectType={setSelectedType}
                onChangeCount={setLivestockCount}
                onActivate={handleActivateManualMode}
                onDeactivate={handleDeactivateManualMode}
            />

            {DialogComponent}
            {ToastComponent}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.bg.primary },
    topStack: {
        position: 'absolute',
        top: 46,
        left: Spacing.md,
        right: Spacing.md,
        gap: 8,
    },
    map: { flex: 1 },
    tileAttribution: {
        position: 'absolute',
        bottom: 4,
        right: 8,
        backgroundColor: 'rgba(8, 10, 14, 0.55)',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 6,
    },
    tileAttributionText: { fontSize: 9, color: Colors.text.muted },
    loadingWrap: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: Colors.bg.primary,
    },
    loadingText: { color: Colors.text.secondary, marginTop: 12, fontSize: 14 },

    rightBtns: {
        position: 'absolute',
        bottom: 180,
        right: Spacing.md,
        gap: 8,
    },
    // FAB в режиме навигации: bottom 210 + высота 60 → кнопки выше 286
    rightBtnsNav: { bottom: 292 },
    mapBtn: {
        backgroundColor: Colors.bg.secondary,
        borderRadius: Radius.full,
        width: 44,
        height: 44,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: Colors.border,
        ...Shadow.card,
    },
    mapBtnPrimary: { borderColor: Colors.brand.primary + '60' },

    fab: {
        position: 'absolute',
        bottom: 100,
        right: Spacing.md,
        backgroundColor: Colors.brand.primary,
        borderRadius: Radius.full,
        width: 60,
        height: 60,
        alignItems: 'center',
        justifyContent: 'center',
        ...Shadow.glow,
    },
    fabManual: { borderWidth: 2, borderColor: Colors.brand.glowStrong },
    fabNavActive: { bottom: 210 },
});
