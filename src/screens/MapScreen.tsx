/**
 * MapScreen — SafeRoute / Sapa Jol
 * Nothing Phone стиль: тёмная карта, геометрические маркеры.
 */
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';

// Nothing Phone pure-black map style
const DARK_MAP_STYLE = [
    { elementType: 'geometry',                                   stylers: [{ color: '#0A0A0A' }] },
    { elementType: 'labels.text.stroke',                         stylers: [{ color: '#000000' }] },
    { elementType: 'labels.text.fill',                           stylers: [{ color: '#444444' }] },
    { featureType: 'administrative.locality',  elementType: 'labels.text.fill',  stylers: [{ color: '#888888' }] },
    { featureType: 'road',                     elementType: 'geometry',          stylers: [{ color: '#1A1A1A' }] },
    { featureType: 'road',                     elementType: 'geometry.stroke',   stylers: [{ color: '#111111' }] },
    { featureType: 'road.highway',             elementType: 'geometry',          stylers: [{ color: '#2ECC7120' }] },
    { featureType: 'road.highway',             elementType: 'geometry.stroke',   stylers: [{ color: '#2ECC7140' }] },
    { featureType: 'road.highway',             elementType: 'labels.text.fill',  stylers: [{ color: '#2ECC71' }] },
    { featureType: 'transit',                  elementType: 'geometry',          stylers: [{ color: '#111111' }] },
    { featureType: 'water',                    elementType: 'geometry',          stylers: [{ color: '#050505' }] },
    { featureType: 'water',                    elementType: 'labels.text.fill',  stylers: [{ color: '#1A1A1A' }] },
    { featureType: 'poi',                      elementType: 'geometry',          stylers: [{ color: '#111111' }] },
    { featureType: 'poi',                      elementType: 'labels.text.fill',  stylers: [{ color: '#333333' }] },
    { featureType: 'poi.park',                 elementType: 'geometry',          stylers: [{ color: '#0A0A0A' }] },
    { featureType: 'landscape',                elementType: 'geometry',          stylers: [{ color: '#0A0A0A' }] },
];

import {
    View, Text, StyleSheet, TouchableOpacity,
    Modal, Vibration, ActivityIndicator,
} from 'react-native';
import MapView, { Marker, Circle, Polyline, Camera } from 'react-native-maps';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import LottieView from 'lottie-react-native';
import { useNavigation, CompositeNavigationProp, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { Colors, Spacing, Radius, Shadow } from '../constants/colors';
import { getIncidentMeta, Incident } from '../constants/incidents';
import { LIVESTOCK_META, LivestockType } from '../constants/livestock';
import { useIncidents } from '../hooks/useIncidents';
import { useLocation } from '../hooks/useLocation';
import { useRoute } from '../hooks/useRoute';
import { useLivestock } from '../hooks/useLivestock';
import { useUserProfile } from '../hooks/useUserProfile';
import { Config } from '../config';
import { STORAGE } from '../constants/storage';
import ProximityBanner from '../components/ProximityBanner';
import ReportModal from '../components/ReportModal';
import RoadStatusBadge from '../components/RoadStatusBadge';
import { RootStackParamList } from '../navigation/RootNavigator';
import { scheduleProximityNotification } from '../services/notifications';
import { useAppDialog } from '../components/AppDialog';
import { useT } from '../i18n';
import { fetchDirections, DirectionsResult } from '../services/directions';
import { useRoutePolyline } from '../hooks/useRoutePolyline';
import { useNotificationLog } from '../hooks/useNotificationLog';
import { useSettings } from '../hooks/useSettings';

/** Отображаемые названия маршрутов */
const ROUTE_NAMES: Record<string, string> = {
    a17: 'A-17', a1: 'A-1', a21: 'A-21', e40: 'E-40',
};

/** Конечные точки маршрутов (для навигации) */
const ROUTE_ENDPOINTS: Record<string, { latitude: number; longitude: number }> = {
    a17: { latitude: 52.287, longitude: 76.967 }, // Павлодар
    a1:  { latitude: 43.240, longitude: 76.910 }, // Алматы
    a21: { latitude: 50.420, longitude: 80.250 }, // Семей
    e40: { latitude: 42.900, longitude: 71.350 }, // Тараз
};

/** Маршруты с более точными промежуточными точками */
const ROUTE_WAYPOINTS: Record<string, { latitude: number; longitude: number }[]> = {
    a17: [
        // Астана → Павлодар (A-17, ~494 км)
        { latitude: 51.165, longitude: 71.427 },
        { latitude: 51.195, longitude: 71.540 },
        { latitude: 51.225, longitude: 71.680 },
        { latitude: 51.268, longitude: 71.880 },
        { latitude: 51.310, longitude: 72.080 },
        { latitude: 51.355, longitude: 72.320 },
        { latitude: 51.400, longitude: 72.560 },
        { latitude: 51.448, longitude: 72.820 },
        { latitude: 51.505, longitude: 73.100 },
        { latitude: 51.565, longitude: 73.420 },
        { latitude: 51.625, longitude: 73.760 },
        { latitude: 51.685, longitude: 74.100 },
        { latitude: 51.740, longitude: 74.440 },
        { latitude: 51.790, longitude: 74.790 },
        { latitude: 51.850, longitude: 75.180 },
        { latitude: 51.920, longitude: 75.580 },
        { latitude: 52.000, longitude: 75.930 },
        { latitude: 52.080, longitude: 76.230 },
        { latitude: 52.170, longitude: 76.560 },
        { latitude: 52.287, longitude: 76.967 },
    ],
    a1: [
        // Астана → Караганда → Балхаш → Алматы (A-1, ~1256 км)
        { latitude: 51.165, longitude: 71.427 },
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
        // Екібастұз → Семей (A-21, ~330 км)
        { latitude: 51.720, longitude: 75.320 },
        { latitude: 51.600, longitude: 75.980 },
        { latitude: 51.450, longitude: 76.720 },
        { latitude: 51.250, longitude: 77.450 },
        { latitude: 51.000, longitude: 78.200 },
        { latitude: 50.780, longitude: 79.000 },
        { latitude: 50.580, longitude: 79.700 },
        { latitude: 50.420, longitude: 80.250 },
    ],
    e40: [
        // Шымкент → Тараз (E-40, ~185 км)
        { latitude: 42.320, longitude: 69.600 },
        { latitude: 42.400, longitude: 69.980 },
        { latitude: 42.520, longitude: 70.420 },
        { latitude: 42.650, longitude: 70.820 },
        { latitude: 42.760, longitude: 71.100 },
        { latitude: 42.900, longitude: 71.350 },
    ],
};

const ROAD_STATUS_COLOR = {
    open: '#2ECC71',
    caution: '#E67E22',
    closed: '#E74C3C',
} as const;

const LIVESTOCK_TYPES: LivestockType[] = ['horse', 'cow', 'camel', 'sheep', 'goat'];

type NavProp = CompositeNavigationProp<
    BottomTabNavigationProp<Record<string, undefined>>,
    NativeStackNavigationProp<RootStackParamList>
>;

/** Фильтр карты: все / только инциденты / только скот */
type FilterType = 'all' | 'incidents' | 'livestock';

export default function MapScreen() {
    const navigation = useNavigation<NavProp>();
    const mapRef = useRef<MapView>(null);
    const [filter, setFilter] = useState<FilterType>('all');
    const [showReport, setShowReport] = useState(false);
    const [showOwnerPanel, setShowOwnerPanel] = useState(false);
    const [confirmDialog, setConfirmDialog] = useState<Incident | null>(null);
    const [selectedType, setSelectedType] = useState<LivestockType>('horse');
    const [livestockCount, setLivestockCount] = useState(10);
    const [activeRouteId, setActiveRouteId] = useState<string>('a17');
    const [navResult, setNavResult] = useState<DirectionsResult | null>(null);
    const [navStepIdx, setNavStepIdx] = useState(0);
    const [navLoading, setNavLoading] = useState(false);
    const dangerZoneAlertedRef = useRef(false);

    const t = useT();
    const { profile } = useUserProfile();
    const { showDialog, DialogComponent } = useAppDialog();
    const { settings } = useSettings();
    const { addEntry: addNotifEntry } = useNotificationLog();

    const { incidents, isOnline, loading, submitReport, confirmIncident, pendingReportsCount } =
        useIncidents('active');
    const { location, nearbyAlert, confirmCandidate, dismissNearbyAlert, dismissConfirmCandidate } =
        useLocation(incidents, Config.DEFAULT_PROXIMITY_RADIUS_KM, (incidentId, title, body) => {
            addNotifEntry({ title, body, incidentId });
        });

    const { isRouteMode, toggleRouteMode, routeIncidents, roadStatus } = useRoute(incidents, activeRouteId);
    const cachedPolyline = useRoutePolyline(activeRouteId);

    const {
        livestock,
        activateManualMode,
        deactivateManualMode,
        isManualMode,
        dangerZoneAlert,
    } = useLivestock(location);

    // Читаем выбранный маршрут при фокусировке вкладки
    useFocusEffect(useCallback(() => {
        AsyncStorage.getItem(STORAGE.ACTIVE_ROUTE).then(id => {
            if (id && ROUTE_WAYPOINTS[id]) setActiveRouteId(id);
        });
    }, []));

    // Push уведомление при приближении (уважает soundEnabled)
    useEffect(() => {
        if (nearbyAlert) {
            const meta = getIncidentMeta(nearbyAlert.incident_type);
            if (settings.vibrationEnabled) {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            }
            scheduleProximityNotification({
                title: '⚠️ Абай болыңыз!',
                body: `${meta.label}${nearbyAlert.description ? ` — ${nearbyAlert.description}` : ''}`,
                incidentId: nearbyAlert.id,
                soundEnabled: settings.soundEnabled,
            });
        }
    }, [nearbyAlert?.id]);

    // Диалог подтверждения
    useEffect(() => {
        if (confirmCandidate) setConfirmDialog(confirmCandidate);
    }, [confirmCandidate?.id]);

    // Danger Zone — 3+ стада в 500м (только для водителей)
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

    const handleConfirm = async (isResolved: boolean) => {
        if (!confirmDialog) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setConfirmDialog(null);
        dismissConfirmCandidate();
        await confirmIncident(confirmDialog.id, isResolved);
        if (isResolved) showDialog({
            title: t('confirm_thanks'),
            message: t('confirm_thanks_msg'),
            icon: 'checkmark-circle',
            iconColor: Colors.brand.primary,
            buttons: [{ text: t('understand'), style: 'default' }],
        });
    };

    const goToDetail = (incident: Incident) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        navigation.navigate('IncidentDetail', { incident });
    };

    const handleSOSLongPress = () => {
        Vibration.vibrate([0, 100, 80, 200, 80, 400, 80, 600]);
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
                        if (location) {
                            await submitReport({
                                incident_type: 'crash',
                                description: '🆘 SOS! Жедел жәрдем қажет.',
                                severity: 5,
                                latitude: location.lat,
                                longitude: location.lon,
                            });
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

    /** i18n-aware livestock label */
    const livestockLabel = (type: LivestockType) => {
        const key = `livestock_${type}` as any;
        return t(key) || LIVESTOCK_META[type].label;
    };

    const handleActivateManualMode = () => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        activateManualMode(selectedType, livestockCount, `${livestockLabel(selectedType)} табуны`);
        setShowOwnerPanel(false);
    };

    const handleDeactivateManualMode = () => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        deactivateManualMode();
        setShowOwnerPanel(false);
    };

    const handleNorthReset = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        mapRef.current?.animateCamera({ heading: 0, pitch: 0 } as Camera, { duration: 300 });
    };

    const handleToggleNavigation = async () => {
        if (navResult) {
            setNavResult(null);
            setNavStepIdx(0);
            return;
        }
        if (!location) {
            showDialog({ title: t('report_error_no_location'), message: '', icon: 'warning', iconColor: Colors.alert.high, buttons: [{ text: t('understand'), style: 'default' }] });
            return;
        }
        setNavLoading(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        const dest = ROUTE_ENDPOINTS[activeRouteId] ?? ROUTE_ENDPOINTS.a17;
        const result = await fetchDirections({ lat: location.lat, lon: location.lon }, dest, Config.GOOGLE_MAPS_API_KEY);
        setNavLoading(false);
        if (result) {
            setNavResult(result);
            setNavStepIdx(0);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } else {
            showDialog({ title: t('route_mode_label'), message: 'Бағытты жүктеу сәтсіз болды. Интернетті тексеріңіз.', icon: 'warning', iconColor: Colors.alert.high, buttons: [{ text: t('understand'), style: 'default' }] });
        }
    };

    // Advance navigation step when within 80m of current step endpoint
    useEffect(() => {
        if (!navResult || !location) return;
        const step = navResult.steps[navStepIdx];
        if (!step) return;
        const dlat = location.lat - step.end.latitude;
        const dlon = location.lon - step.end.longitude;
        const distM = Math.sqrt(dlat * dlat + dlon * dlon) * 111_000;
        if (distM < 80 && navStepIdx < navResult.steps.length - 1) {
            setNavStepIdx(i => i + 1);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
    }, [location?.lat, location?.lon]);

    // When navigating, camera follows location with 15° tilt for driving perspective
    useEffect(() => {
        if (!navResult || !location) return;
        mapRef.current?.animateCamera({
            center: { latitude: location.lat, longitude: location.lon },
            zoom: 15,
            pitch: 30,
            heading: 0,
        } as Camera, { duration: 800 });
    }, [location?.lat, location?.lon, !!navResult]);

    const displayedIncidents = isRouteMode ? routeIncidents : incidents.filter(i => i.is_active);
    const showIncidents = filter === 'all' || filter === 'incidents';
    const showLivestock = filter === 'all' || filter === 'livestock';
    // Navigation polyline > cached Directions polyline > static waypoints
    const routeCoords = navResult ? navResult.polyline : cachedPolyline;

    const initialRegion = location
        ? { latitude: location.lat, longitude: location.lon, latitudeDelta: 0.05, longitudeDelta: 0.05 }
        : { latitude: 51.96, longitude: 74.2, latitudeDelta: 2.5, longitudeDelta: 4 };

    if (loading) {
        return (
            <View style={styles.loadingWrap}>
                <LottieView
                    source={require('../assets/lottie/loading.json')}
                    autoPlay loop
                    style={{ width: 120, height: 120 }}
                />
                <Text style={styles.loadingText}>{t('loading_location')}</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <MapView
                ref={mapRef}
                style={styles.map}
                initialRegion={initialRegion}
                showsUserLocation
                showsMyLocationButton={false}
                showsCompass={false}
                userInterfaceStyle="dark"
                customMapStyle={DARK_MAP_STYLE}
            >
                {/* ── Инциденты ── */}
                {showIncidents && displayedIncidents.map((inc) => {
                    const meta = getIncidentMeta(inc.incident_type);
                    return (
                        <React.Fragment key={`inc-${inc.id}`}>
                            <Marker
                                coordinate={{ latitude: inc.latitude, longitude: inc.longitude }}
                                onCalloutPress={() => goToDetail(inc)}
                                tracksViewChanges={false}
                                anchor={{ x: 0.5, y: 1 }}
                            >
                                <View style={styles.pinContainer}>
                                    <View style={[styles.pinCard, { borderColor: meta.color }]}>
                                        <Ionicons name={meta.icon as any} size={16} color={meta.color} />
                                    </View>
                                    <View style={[styles.pinStem, { backgroundColor: meta.color }]} />
                                    <View style={[styles.pinDot, { backgroundColor: meta.color }]} />
                                </View>
                            </Marker>
                            <Circle center={{ latitude: inc.latitude, longitude: inc.longitude }} radius={50} fillColor={meta.color + 'AA'} strokeWidth={0} />
                            <Circle center={{ latitude: inc.latitude, longitude: inc.longitude }} radius={200} fillColor={meta.color + '40'} strokeWidth={0} />
                            <Circle center={{ latitude: inc.latitude, longitude: inc.longitude }} radius={600} fillColor={meta.color + '18'} strokeWidth={0} />
                            <Circle center={{ latitude: inc.latitude, longitude: inc.longitude }} radius={1200} fillColor={meta.color + '08'} strokeColor={meta.color + '30'} strokeWidth={1} />
                        </React.Fragment>
                    );
                })}

                {/* ── Скот ── */}
                {showLivestock && livestock.map((animal) => {
                    const meta = LIVESTOCK_META[animal.type] ?? { label: 'Жануар', color: Colors.brand.primary, emoji: '🐾' };
                    const isDangerous = animal.isNearRoad && animal.distanceToRoadM < 300;
                    const markerColor = isDangerous ? Colors.alert.critical : meta.color;
                    return (
                        <React.Fragment key={`ls-${animal.id}`}>
                            <Marker
                                coordinate={{ latitude: animal.latitude, longitude: animal.longitude }}
                                tracksViewChanges={false}
                                anchor={{ x: 0.5, y: 1 }}
                            >
                                <View style={styles.pinContainer}>
                                    <View style={[styles.pinCard, styles.pinCardLivestock, { borderColor: markerColor }]}>
                                        <Text style={styles.livestockEmoji}>{meta.emoji}</Text>
                                        {isDangerous && (
                                            <View style={styles.dangerBadge}>
                                                <Text style={styles.dangerBadgeText}>!</Text>
                                            </View>
                                        )}
                                    </View>
                                    <View style={[styles.pinStem, { backgroundColor: markerColor }]} />
                                    <View style={[styles.pinDot, { backgroundColor: markerColor }]} />
                                </View>
                            </Marker>
                            <Circle center={{ latitude: animal.latitude, longitude: animal.longitude }} radius={40} fillColor={markerColor + 'BB'} strokeWidth={0} />
                            {isDangerous && (
                                <Circle center={{ latitude: animal.latitude, longitude: animal.longitude }} radius={animal.distanceToRoadM} fillColor={Colors.alert.critical + '20'} strokeColor={Colors.alert.critical + '50'} strokeWidth={1} />
                            )}
                        </React.Fragment>
                    );
                })}

                {/* ── Маршрут (активный из Profile) ── */}
                <Polyline
                    coordinates={routeCoords}
                    strokeColor={ROAD_STATUS_COLOR[roadStatus]}
                    strokeWidth={4}
                    lineDashPattern={roadStatus === 'closed' ? [10, 6] : undefined}
                    geodesic
                />
                {/* Белая подложка под линией маршрута для чёткости */}
                <Polyline
                    coordinates={routeCoords}
                    strokeColor="rgba(255,255,255,0.12)"
                    strokeWidth={8}
                    geodesic
                />
            </MapView>

            {/* ── Верхний бар ── */}
            <View style={styles.topBar}>
                <View style={styles.topBarRow}>
                    <Ionicons name="shield-checkmark" size={20} color={Colors.brand.primary} />
                    <Text style={styles.topBarText}>Sapa Jol</Text>
                    <View style={styles.topBarBadge}>
                        <Text style={styles.topBarBadgeText}>{displayedIncidents.length}</Text>
                    </View>
                    {pendingReportsCount > 0 && (
                        <View style={styles.offlineQueue}>
                            <Ionicons name="cloud-upload-outline" size={12} color={Colors.alert.medium} />
                            <Text style={styles.offlineQueueText}>{pendingReportsCount}</Text>
                        </View>
                    )}
                    {isManualMode && (
                        <View style={styles.manualModeBadge}>
                            <View style={styles.manualModeDot} />
                            <Text style={styles.manualModeBadgeText}>{t('herd_mode_badge')}</Text>
                        </View>
                    )}
                    <View style={[styles.liteTag, isOnline ? styles.liteTagOnline : styles.liteTagOffline]}>
                        <Ionicons name={isOnline ? 'wifi' : 'cloud-offline'} size={12} color={isOnline ? Colors.brand.primary : Colors.alert.medium} />
                        <Text style={[styles.liteTagText, { color: isOnline ? Colors.brand.primary : Colors.alert.medium }]}>
                            {isOnline ? t('online') : t('offline')}
                        </Text>
                    </View>
                </View>
                <View style={styles.statusRow}>
                    <RoadStatusBadge
                        status={roadStatus}
                        routeName={ROUTE_NAMES[activeRouteId] ?? 'A-17'}
                        isRouteMode={isRouteMode}
                        onToggleRoute={toggleRouteMode}
                    />
                    {/* Navigation button */}
                    <TouchableOpacity
                        style={[styles.navBtn, navResult && styles.navBtnActive]}
                        onPress={handleToggleNavigation}
                        disabled={navLoading}
                    >
                        {navLoading
                            ? <ActivityIndicator size="small" color={navResult ? Colors.bg.primary : Colors.brand.primary} />
                            : <Ionicons name={navResult ? 'stop-circle' : 'arrow-redo'} size={14} color={navResult ? Colors.bg.primary : Colors.brand.primary} />
                        }
                        <Text style={[styles.navBtnText, navResult && styles.navBtnTextActive]}>
                            {navResult ? (navResult.totalDistance + ' · ' + navResult.totalDuration) : t('route_mode_label')}
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* ── Фильтры: Барлығы / Белгілер / Мал ── */}
            <View style={styles.filterRow}>
                {([
                    { key: 'all',       label: t('filter_all'),       icon: 'layers'   },
                    { key: 'incidents', label: t('filter_incidents'), icon: 'warning'  },
                    { key: 'livestock', label: t('filter_livestock'), icon: 'paw'      },
                ] as { key: FilterType; label: string; icon: string }[]).map((f) => (
                    <TouchableOpacity
                        key={f.key}
                        style={[styles.filterChip, filter === f.key && styles.filterChipActive]}
                        onPress={() => { Haptics.selectionAsync(); setFilter(f.key); }}
                    >
                        <Ionicons
                            name={f.icon as any} size={13}
                            color={filter === f.key ? Colors.bg.primary : Colors.text.secondary}
                        />
                        <Text style={[styles.filterChipText, filter === f.key && styles.filterChipTextActive]}>
                            {f.label}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            {/* ── Полноэкранный навигатор (нижняя карточка) ── */}
            {navResult && (
                <View style={styles.navCard}>
                    {/* Step progress bar */}
                    <View style={styles.navProgress}>
                        <View style={[styles.navProgressFill, { width: `${((navStepIdx + 1) / navResult.steps.length) * 100}%` as any }]} />
                    </View>
                    {/* Step header */}
                    <View style={styles.navCardHeader}>
                        <View style={styles.navIconBox}>
                            <Ionicons name="navigate" size={24} color={Colors.brand.primary} />
                        </View>
                        <View style={{ flex: 1 }}>
                            {navResult.steps[navStepIdx] && (
                                <Text style={styles.navInstructionText} numberOfLines={2}>
                                    {navResult.steps[navStepIdx].instruction}
                                </Text>
                            )}
                            <Text style={styles.navDistText}>
                                {navResult.steps[navStepIdx]?.distance}
                                {' · '}
                                <Text style={styles.navTotalText}>{t('route_mode_label')} {navResult.totalDistance}</Text>
                            </Text>
                        </View>
                        <TouchableOpacity style={styles.navStopBtn} onPress={() => { setNavResult(null); setNavStepIdx(0); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); }}>
                            <Ionicons name="stop" size={16} color={Colors.alert.critical} />
                        </TouchableOpacity>
                    </View>
                    {/* Next step preview */}
                    {navResult.steps[navStepIdx + 1] && (
                        <View style={styles.navNextStep}>
                            <Text style={styles.navNextLabel}>Затем: </Text>
                            <Text style={styles.navNextText} numberOfLines={1}>
                                {navResult.steps[navStepIdx + 1].instruction}
                            </Text>
                        </View>
                    )}
                </View>
            )}

            {/* ── Кнопки справа: Компас + Локация ── */}
            <View style={styles.rightBtns}>
                {/* Компас — сброс ориентации на север */}
                <TouchableOpacity style={styles.mapBtn} onPress={handleNorthReset}>
                    <Ionicons name="compass-outline" size={20} color={Colors.text.secondary} />
                </TouchableOpacity>
                {/* Моё местоположение */}
                <TouchableOpacity
                    style={[styles.mapBtn, styles.mapBtnPrimary]}
                    onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        location && mapRef.current?.animateToRegion(
                            { latitude: location.lat, longitude: location.lon, latitudeDelta: 0.05, longitudeDelta: 0.05 }, 500,
                        );
                    }}
                >
                    <Ionicons name="locate" size={20} color={Colors.brand.primary} />
                </TouchableOpacity>
            </View>

            {/* ── FAB ── */}
            <TouchableOpacity
                style={[styles.fab, isManualMode && styles.fabManual]}
                onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    profile.role === 'livestock_owner' ? setShowOwnerPanel(true) : setShowReport(true);
                }}
                onLongPress={handleSOSLongPress}
                delayLongPress={5000}
            >
                <LottieView
                    source={require('../assets/lottie/alert_pulse.json')}
                    autoPlay loop
                    style={{ position: 'absolute', width: 150, height: 150 }}
                />
                <Ionicons
                    name={profile.role === 'livestock_owner' ? 'paw' : 'add'}
                    size={28}
                    color={Colors.bg.primary}
                />
            </TouchableOpacity>

            {/* ── Proximity Banner ── */}
            {nearbyAlert && (
                <ProximityBanner incident={nearbyAlert} onDismiss={dismissNearbyAlert} onViewDetail={goToDetail} />
            )}

            {/* ── Confirm Dialog ── */}
            <Modal visible={!!confirmDialog} transparent animationType="fade">
                <View style={styles.confirmOverlay}>
                    <View style={styles.confirmCard}>
                        <LottieView
                            source={require('../assets/lottie/confirm_question.json')}
                            autoPlay loop
                            style={{ width: 90, height: 90 }}
                        />
                        <Text style={styles.confirmTitle}>{t('confirm_title')}</Text>
                        <Text style={styles.confirmDesc}>{t('confirm_desc')}</Text>
                        {confirmDialog && (
                            <Text style={styles.confirmIncidentType}>
                                {getIncidentMeta(confirmDialog.incident_type).label}
                            </Text>
                        )}
                        <View style={styles.confirmButtons}>
                            <TouchableOpacity style={[styles.confirmBtn, { backgroundColor: Colors.brand.primary }]} onPress={() => handleConfirm(true)}>
                                <Ionicons name="checkmark" size={18} color={Colors.bg.primary} />
                                <Text style={styles.confirmBtnText}>{t('confirm_yes')}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.confirmBtn, { backgroundColor: Colors.alert.critical }]} onPress={() => handleConfirm(false)}>
                                <Ionicons name="close" size={18} color={Colors.white} />
                                <Text style={[styles.confirmBtnText, { color: Colors.white }]}>{t('confirm_no')}</Text>
                            </TouchableOpacity>
                        </View>
                        <TouchableOpacity
                            style={styles.confirmDetail}
                            onPress={() => {
                                setConfirmDialog(null);
                                dismissConfirmCandidate();
                                if (confirmDialog) goToDetail(confirmDialog);
                            }}
                        >
                            <Text style={styles.confirmDetailText}>{t('confirm_view')}</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            <ReportModal
                visible={showReport}
                onClose={() => setShowReport(false)}
                location={location}
                onSubmit={submitReport}
            />

            {/* ── Панель "Мен табунмен" ── */}
            <Modal visible={showOwnerPanel} transparent animationType="slide">
                <View style={styles.ownerOverlay}>
                    <TouchableOpacity style={styles.ownerBackdrop} onPress={() => setShowOwnerPanel(false)} activeOpacity={1} />
                    <View style={styles.ownerPanel}>
                        <View style={styles.ownerHandle} />

                        {isManualMode ? (
                            <>
                                <View style={styles.ownerActiveHeader}>
                                    <View style={styles.ownerActiveDot} />
                                    <Text style={styles.ownerTitle}>{t('owner_active_title')}</Text>
                                </View>
                                <Text style={styles.ownerSubtitle}>{t('owner_active_subtitle')}</Text>
                                <View style={styles.ownerActiveCard}>
                                    <Text style={styles.ownerActiveEmoji}>{LIVESTOCK_META[selectedType].emoji}</Text>
                                    <View>
                                        <Text style={styles.ownerActiveType}>{livestockLabel(selectedType)}</Text>
                                        <Text style={styles.ownerActiveCount}>{livestockCount} {t('heads_unit')}</Text>
                                    </View>
                                </View>
                                <TouchableOpacity style={styles.deactivateBtn} onPress={handleDeactivateManualMode}>
                                    <Ionicons name="stop-circle" size={20} color={Colors.white} />
                                    <Text style={styles.deactivateBtnText}>{t('owner_deactivate')}</Text>
                                </TouchableOpacity>
                            </>
                        ) : (
                            <>
                                <Text style={styles.ownerTitle}>{t('owner_panel_title')}</Text>
                                <Text style={styles.ownerSubtitle}>{t('owner_panel_subtitle')}</Text>

                                <Text style={styles.ownerSectionLabel}>{t('owner_type_label')}</Text>
                                <View style={styles.typeGrid}>
                                    {LIVESTOCK_TYPES.map(type => (
                                        <TouchableOpacity
                                            key={type}
                                            style={[styles.typeChip, selectedType === type && styles.typeChipActive]}
                                            onPress={() => { Haptics.selectionAsync(); setSelectedType(type); }}
                                        >
                                            <Text style={styles.typeChipEmoji}>{LIVESTOCK_META[type].emoji}</Text>
                                            <Text style={[styles.typeChipLabel, selectedType === type && styles.typeChipLabelActive]}>
                                                {livestockLabel(type)}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>

                                <Text style={styles.ownerSectionLabel}>{t('owner_count_label')}</Text>
                                <View style={styles.stepper}>
                                    <TouchableOpacity style={styles.stepperBtn} onPress={() => { Haptics.selectionAsync(); setLivestockCount(c => Math.max(1, c - 5)); }}>
                                        <Ionicons name="remove" size={20} color={Colors.text.primary} />
                                    </TouchableOpacity>
                                    <Text style={styles.stepperValue}>{livestockCount}</Text>
                                    <TouchableOpacity style={styles.stepperBtn} onPress={() => { Haptics.selectionAsync(); setLivestockCount(c => c + 5); }}>
                                        <Ionicons name="add" size={20} color={Colors.text.primary} />
                                    </TouchableOpacity>
                                </View>

                                <TouchableOpacity
                                    style={[styles.activateBtn, !location && styles.activateBtnDisabled]}
                                    onPress={handleActivateManualMode}
                                    disabled={!location}
                                >
                                    <Ionicons name="radio" size={20} color={Colors.bg.primary} />
                                    <Text style={styles.activateBtnText}>{t('owner_activate')}</Text>
                                </TouchableOpacity>
                                {!location && <Text style={styles.ownerNoLocation}>{t('owner_no_gps')}</Text>}
                            </>
                        )}
                    </View>
                </View>
            </Modal>

            {DialogComponent}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.bg.primary },
    map: { flex: 1 },
    loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.bg.primary },
    loadingText: { color: Colors.text.secondary, marginTop: 12, fontSize: 14 },

    topBar: {
        position: 'absolute', top: 50, left: Spacing.md, right: Spacing.md,
        backgroundColor: 'rgba(0,0,0,0.85)', borderRadius: Radius.md,
        paddingVertical: 12, paddingHorizontal: Spacing.md,
        borderWidth: 1, borderColor: Colors.border, ...Shadow.card, gap: 10,
    },
    topBarRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    topBarText: { fontSize: 17, fontWeight: '700', color: Colors.text.primary },
    topBarBadge: {
        backgroundColor: Colors.brand.primary, borderRadius: Radius.full,
        minWidth: 22, height: 22, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6,
    },
    topBarBadgeText: { fontSize: 12, fontWeight: '800', color: Colors.bg.primary },
    offlineQueue: {
        flexDirection: 'row', alignItems: 'center', gap: 3,
        backgroundColor: Colors.alert.medium + '20', paddingHorizontal: 6, paddingVertical: 3, borderRadius: Radius.full,
    },
    offlineQueueText: { fontSize: 10, fontWeight: '700', color: Colors.alert.medium },
    manualModeBadge: {
        flexDirection: 'row', alignItems: 'center', gap: 4,
        backgroundColor: Colors.brand.primary + '20', paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.full,
    },
    manualModeDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.brand.primary },
    manualModeBadgeText: { fontSize: 10, fontWeight: '700', color: Colors.brand.primary },
    liteTag: {
        flexDirection: 'row', alignItems: 'center', gap: 4,
        paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.full, marginLeft: 'auto',
    },
    liteTagOnline: { backgroundColor: Colors.brand.primary + '20' },
    liteTagOffline: { backgroundColor: Colors.alert.medium + '20' },
    liteTagText: { fontSize: 11, fontWeight: '700' },
    statusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 },

    navBtn: {
        flexDirection: 'row', alignItems: 'center', gap: 5,
        paddingHorizontal: 10, paddingVertical: 5,
        borderRadius: Radius.full,
        backgroundColor: Colors.brand.primary + '15',
        borderWidth: 1, borderColor: Colors.brand.primary + '40',
    },
    navBtnActive: { backgroundColor: Colors.brand.primary, borderColor: Colors.brand.primary },
    navBtnText: { fontSize: 11, fontWeight: '700', color: Colors.brand.primary },
    navBtnTextActive: { color: Colors.bg.primary },

    // Full-screen navigator card
    navCard: {
        position: 'absolute', bottom: 0, left: 0, right: 0,
        backgroundColor: Colors.bg.secondary,
        borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl,
        borderTopWidth: 1, borderColor: Colors.brand.primary + '30',
        paddingBottom: 32, paddingTop: 0,
        ...Shadow.card,
    },
    navProgress: {
        height: 2, backgroundColor: Colors.bg.tertiary,
        borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl, overflow: 'hidden',
    },
    navProgressFill: { height: '100%', backgroundColor: Colors.brand.primary },
    navCardHeader: {
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: Spacing.lg, paddingTop: Spacing.lg,
        gap: Spacing.md,
    },
    navIconBox: {
        width: 48, height: 48, borderRadius: Radius.md,
        backgroundColor: Colors.brand.primary + '15',
        borderWidth: 1, borderColor: Colors.brand.primary + '30',
        alignItems: 'center', justifyContent: 'center',
    },
    navInstructionText: { fontSize: 17, fontWeight: '700', color: Colors.text.primary, lineHeight: 22 },
    navDistText: { fontSize: 13, color: Colors.text.secondary, marginTop: 3 },
    navTotalText: { color: Colors.text.muted },
    navStopBtn: {
        width: 36, height: 36, borderRadius: Radius.full,
        borderWidth: 1, borderColor: Colors.alert.critical + '40',
        alignItems: 'center', justifyContent: 'center',
        backgroundColor: Colors.alert.critical + '10',
    },
    navNextStep: {
        flexDirection: 'row', alignItems: 'center',
        marginHorizontal: Spacing.lg, marginTop: Spacing.sm,
        paddingTop: Spacing.sm,
        borderTopWidth: 1, borderColor: Colors.divider,
    },
    navNextLabel: { fontSize: 12, color: Colors.text.muted, marginRight: 4 },
    navNextText: { fontSize: 12, color: Colors.text.secondary, flex: 1 },

    filterRow: {
        position: 'absolute', top: 142, left: Spacing.md, right: Spacing.md,
        flexDirection: 'row', gap: 8,
    },
    filterChip: {
        flexDirection: 'row', alignItems: 'center', gap: 5,
        paddingVertical: 8, paddingHorizontal: 12,
        borderRadius: Radius.sm, backgroundColor: 'rgba(0,0,0,0.85)',
        borderWidth: 1, borderColor: Colors.border,
    },
    filterChipActive: { backgroundColor: Colors.brand.primary, borderColor: Colors.brand.primary },
    filterChipText: { fontSize: 12, fontWeight: '600', color: Colors.text.secondary },
    filterChipTextActive: { color: Colors.bg.primary },

    // Кнопки справа: компас + локация — сгруппированы вертикально
    rightBtns: {
        position: 'absolute', bottom: 180, right: Spacing.md,
        gap: 8,
    },
    mapBtn: {
        backgroundColor: Colors.bg.secondary, borderRadius: Radius.full,
        width: 44, height: 44, alignItems: 'center', justifyContent: 'center',
        borderWidth: 1, borderColor: Colors.border, ...Shadow.card,
    },
    mapBtnPrimary: { borderColor: Colors.brand.primary + '60' },

    fab: {
        position: 'absolute', bottom: 100, right: Spacing.md,
        backgroundColor: Colors.brand.primary, borderRadius: Radius.full,
        width: 64, height: 64, alignItems: 'center', justifyContent: 'center', ...Shadow.glow,
    },
    fabManual: { borderWidth: 2, borderColor: Colors.brand.glowStrong },

    // ── Маркеры Nothing Phone: карточка + тонкий стебель + точка ──
    pinContainer: { alignItems: 'center' },
    pinCard: {
        width: 38, height: 38,
        backgroundColor: Colors.bg.secondary,
        borderRadius: Radius.sm,
        borderWidth: 2,
        alignItems: 'center', justifyContent: 'center',
        shadowColor: '#000', shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.4, shadowRadius: 5, elevation: 6,
    },
    pinCardLivestock: { width: 42, height: 42, borderRadius: Radius.md, position: 'relative' },
    pinStem: { width: 2, height: 7 },
    pinDot: { width: 6, height: 6, borderRadius: 3 },

    livestockEmoji: { fontSize: 20 },
    dangerBadge: {
        position: 'absolute', top: -4, right: -4,
        width: 16, height: 16, borderRadius: 8,
        backgroundColor: Colors.alert.critical,
        alignItems: 'center', justifyContent: 'center',
        borderWidth: 1.5, borderColor: Colors.bg.secondary,
    },
    dangerBadgeText: { fontSize: 9, fontWeight: '900', color: Colors.white },

    confirmOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', alignItems: 'center', justifyContent: 'center' },
    confirmCard: {
        backgroundColor: Colors.bg.secondary, borderRadius: Radius.xl,
        padding: Spacing.xl, alignItems: 'center', width: 320,
        borderWidth: 1, borderColor: Colors.border,
    },
    confirmTitle: { fontSize: 20, fontWeight: '700', color: Colors.text.primary, marginTop: 12 },
    confirmDesc: { fontSize: 14, color: Colors.text.secondary, textAlign: 'center', marginTop: 8 },
    confirmIncidentType: { fontSize: 13, color: Colors.text.muted, marginTop: 4, marginBottom: Spacing.lg },
    confirmButtons: { flexDirection: 'row', gap: 12, width: '100%' },
    confirmBtn: {
        flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        gap: 6, paddingVertical: 14, borderRadius: Radius.lg,
    },
    confirmBtnText: { fontSize: 15, fontWeight: '700', color: Colors.bg.primary },
    confirmDetail: { marginTop: Spacing.sm },
    confirmDetailText: { fontSize: 13, color: Colors.brand.primary, fontWeight: '600' },

    // Owner Panel
    ownerOverlay: { flex: 1, justifyContent: 'flex-end' },
    ownerBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
    ownerPanel: {
        backgroundColor: Colors.bg.secondary,
        borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl,
        paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm, paddingBottom: 40,
        borderWidth: 1, borderColor: Colors.border,
    },
    ownerHandle: {
        width: 36, height: 4, borderRadius: 2,
        backgroundColor: Colors.border, alignSelf: 'center', marginBottom: Spacing.lg,
    },
    ownerTitle: { fontSize: 20, fontWeight: '800', color: Colors.text.primary, marginBottom: 6 },
    ownerSubtitle: { fontSize: 13, color: Colors.text.secondary, lineHeight: 18, marginBottom: Spacing.lg },
    ownerSectionLabel: { fontSize: 12, fontWeight: '700', color: Colors.text.muted, letterSpacing: 0.8, marginBottom: 10, textTransform: 'uppercase' },
    typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: Spacing.lg },
    typeChip: {
        alignItems: 'center', paddingVertical: 10, paddingHorizontal: 14,
        borderRadius: Radius.md, backgroundColor: Colors.bg.tertiary,
        borderWidth: 1.5, borderColor: Colors.border, minWidth: 70,
    },
    typeChipActive: { borderColor: Colors.brand.primary, backgroundColor: Colors.brand.primary + '18' },
    typeChipEmoji: { fontSize: 22, marginBottom: 3 },
    typeChipLabel: { fontSize: 11, fontWeight: '600', color: Colors.text.secondary },
    typeChipLabelActive: { color: Colors.brand.primary },
    stepper: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: Colors.bg.tertiary, borderRadius: Radius.md,
        borderWidth: 1, borderColor: Colors.border, marginBottom: Spacing.lg,
        alignSelf: 'flex-start',
    },
    stepperBtn: { paddingHorizontal: 20, paddingVertical: 12 },
    stepperValue: { fontSize: 22, fontWeight: '800', color: Colors.text.primary, minWidth: 60, textAlign: 'center' },
    activateBtn: {
        backgroundColor: Colors.brand.primary, borderRadius: Radius.lg,
        paddingVertical: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    },
    activateBtnDisabled: { opacity: 0.4 },
    activateBtnText: { fontSize: 16, fontWeight: '700', color: Colors.bg.primary },
    ownerNoLocation: { fontSize: 12, color: Colors.alert.medium, textAlign: 'center', marginTop: 8 },
    ownerActiveHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
    ownerActiveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.brand.primary },
    ownerActiveCard: {
        flexDirection: 'row', alignItems: 'center', gap: 16,
        backgroundColor: Colors.bg.tertiary, borderRadius: Radius.lg,
        padding: Spacing.md, marginVertical: Spacing.lg,
        borderWidth: 1, borderColor: Colors.brand.primary + '40',
    },
    ownerActiveEmoji: { fontSize: 40 },
    ownerActiveType: { fontSize: 16, fontWeight: '700', color: Colors.text.primary },
    ownerActiveCount: { fontSize: 13, color: Colors.text.secondary, marginTop: 2 },
    deactivateBtn: {
        backgroundColor: Colors.alert.critical, borderRadius: Radius.lg,
        paddingVertical: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    },
    deactivateBtnText: { fontSize: 16, fontWeight: '700', color: Colors.white },
});
