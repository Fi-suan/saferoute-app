/**
 * MapScreen — SafeRoute / Sapa Jol
 *
 * Orchestrator-уровень: хуки, state, эффекты, обработчики.
 * Вся UI-разметка вынесена в src/screens/map/* (sub-components).
 */
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Vibration } from 'react-native';
import MapView, { Polyline, Camera } from 'react-native-maps';
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
import { RootStackParamList } from '../navigation/RootNavigator';
import { scheduleProximityNotification } from '../services/notifications';
import { useAppDialog } from '../components/AppDialog';
import { useT } from '../i18n';
import { fetchDirections, DirectionsResult } from '../services/directions';
import { useRoutePolyline } from '../hooks/useRoutePolyline';
import { useNotificationLog } from '../hooks/useNotificationLog';
import { useSettings } from '../hooks/useSettings';

import {
    DARK_MAP_STYLE,
    ROUTE_ENDPOINTS,
    ROUTE_WAYPOINTS,
    ROAD_STATUS_COLOR,
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
    const {
        location,
        nearbyAlert,
        confirmCandidate,
        dismissNearbyAlert,
        dismissConfirmCandidate,
        isSimulating,
        simulationStage,
        startSimulation,
        stopSimulation,
        triggerSimulationStep,
    } = useLocation(incidents, Config.DEFAULT_PROXIMITY_RADIUS_KM, (incidentId, title, body) => {
        addNotifEntry({ title, body, incidentId });
    });

    const { isRouteMode, toggleRouteMode, routeIncidents, roadStatus } = useRoute(
        incidents,
        activeRouteId,
    );
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

    // Push notification on proximity (respects soundEnabled)
    useEffect(() => {
        if (!nearbyAlert) return;
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
        mapRef.current?.animateCamera(
            {
                center: { latitude: location.lat, longitude: location.lon },
                zoom: 16,
                pitch: 45,
                heading: location.heading ?? 0,
            } as Camera,
            { duration: 600 },
        );
    }, [location?.lat, location?.lon, location?.heading, !!navResult]);

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
        await confirmIncident(incident.id, isResolved);
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

    const handleNorthReset = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        mapRef.current?.animateCamera({ heading: 0, pitch: 0 } as Camera, { duration: 300 });
    };

    const handleLocateMe = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        if (!location) return;
        mapRef.current?.animateToRegion(
            {
                latitude: location.lat,
                longitude: location.lon,
                latitudeDelta: 0.05,
                longitudeDelta: 0.05,
            },
            500,
        );
    };

    const handleToggleNavigation = async () => {
        if (navResult) {
            setNavResult(null);
            setNavStepIdx(0);
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
    };

    const handleFabPress = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        if (profile.role === 'livestock_owner') setShowOwnerPanel(true);
        else setShowReport(true);
    };

    // ── Derived ──────────────────────────────────────────────────────────────

    const displayedIncidents = isRouteMode ? routeIncidents : incidents.filter((i) => i.is_active);
    const showIncidents = filter === 'all' || filter === 'incidents';
    const showLivestock = filter === 'all' || filter === 'livestock';
    const routeCoords = navResult ? navResult.polyline : cachedPolyline;

    const initialRegion = location
        ? {
              latitude: location.lat,
              longitude: location.lon,
              latitudeDelta: 0.05,
              longitudeDelta: 0.05,
          }
        : { latitude: 51.96, longitude: 74.2, latitudeDelta: 2.5, longitudeDelta: 4 };

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
                {showIncidents && (
                    <IncidentMarkers incidents={displayedIncidents} onCalloutPress={goToDetail} />
                )}
                {showLivestock && <LivestockMarkers livestock={livestock} />}

                {/* Route polyline (white backing layer for clarity) */}
                <Polyline
                    coordinates={routeCoords}
                    strokeColor="rgba(255,255,255,0.12)"
                    strokeWidth={8}
                    geodesic
                />
                <Polyline
                    coordinates={routeCoords}
                    strokeColor={ROAD_STATUS_COLOR[roadStatus]}
                    strokeWidth={4}
                    lineDashPattern={roadStatus === 'closed' ? [10, 6] : undefined}
                    geodesic
                />
            </MapView>

            <MapTopBar
                incidentCount={displayedIncidents.length}
                pendingReportsCount={pendingReportsCount}
                isManualMode={isManualMode}
                isOnline={isOnline}
                roadStatus={roadStatus}
                activeRouteId={activeRouteId}
                isRouteMode={isRouteMode}
                onToggleRoute={toggleRouteMode}
                navResult={navResult}
                navLoading={navLoading}
                onToggleNavigation={handleToggleNavigation}
            />

            <MapFilters filter={filter} onChange={setFilter} />

            {navResult && (
                <NavigationCard
                    navResult={navResult}
                    navStepIdx={navStepIdx}
                    onStop={handleStopNavigation}
                />
            )}

            {/* Right buttons: compass + locate + demo simulation */}
            <View style={styles.rightBtns}>
                <TouchableOpacity
                    style={[styles.mapBtn, isSimulating && styles.mapBtnSimActive]}
                    onPress={() => {
                        if (isSimulating) {
                            stopSimulation();
                        } else {
                            startSimulation();
                        }
                    }}
                >
                    <Ionicons
                        name={isSimulating ? 'stop' : 'speedometer-outline'}
                        size={20}
                        color={isSimulating ? Colors.alert.high : Colors.brand.primary}
                    />
                </TouchableOpacity>
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

            {/* GPS Simulation Floating Bar (for in-room presentation) */}
            {isSimulating && (
                <View style={styles.simBar}>
                    <View style={styles.simHeader}>
                        <View style={styles.simDot} />
                        <Text style={styles.simTitle}>Демо-симулятор (Қозғалыс)</Text>
                        <TouchableOpacity onPress={stopSimulation} style={styles.simClose}>
                            <Ionicons name="close-circle" size={20} color={Colors.text.secondary} />
                        </TouchableOpacity>
                    </View>
                    <View style={styles.simButtonsRow}>
                        <TouchableOpacity
                            style={[
                                styles.simStepBtn,
                                simulationStage === 'nearby' && styles.simStepBtnActive,
                            ]}
                            onPress={() => triggerSimulationStep('nearby')}
                        >
                            <Ionicons
                                name="warning"
                                size={14}
                                color={
                                    simulationStage === 'nearby'
                                        ? Colors.bg.primary
                                        : Colors.alert.high
                                }
                            />
                            <Text
                                style={[
                                    styles.simStepBtnText,
                                    simulationStage === 'nearby' && styles.simStepBtnTextActive,
                                ]}
                            >
                                1. Жақындау (2 км)
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[
                                styles.simStepBtn,
                                simulationStage === 'passed' && styles.simStepBtnActive,
                            ]}
                            onPress={() => triggerSimulationStep('confirm')}
                        >
                            <Ionicons
                                name="checkmark-circle"
                                size={14}
                                color={
                                    simulationStage === 'passed'
                                        ? Colors.bg.primary
                                        : Colors.brand.primary
                                }
                            />
                            <Text
                                style={[
                                    styles.simStepBtnText,
                                    simulationStage === 'passed' && styles.simStepBtnTextActive,
                                ]}
                            >
                                2. Мәселе орны (500 м)
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>
            )}

            {/* FAB — Report or Owner panel; long-press = SOS */}
            <TouchableOpacity
                style={[styles.fab, isManualMode && styles.fabManual]}
                onPress={handleFabPress}
                onLongPress={handleSOSLongPress}
                delayLongPress={1500}
            >
                <LottieView
                    source={require('../assets/lottie/alert_pulse.json')}
                    autoPlay
                    loop
                    style={{ position: 'absolute', width: 150, height: 150 }}
                />
                <Ionicons
                    name={profile.role === 'livestock_owner' ? 'paw' : 'add'}
                    size={28}
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
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.bg.primary },
    map: { flex: 1 },
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
    mapBtnSimActive: {
        backgroundColor: Colors.alert.high + '25',
        borderColor: Colors.alert.high,
    },

    simBar: {
        position: 'absolute',
        bottom: 110,
        left: Spacing.md,
        right: 84, // keep room for FAB
        backgroundColor: 'rgba(10, 15, 28, 0.95)',
        borderRadius: Radius.md,
        padding: 12,
        borderWidth: 1.5,
        borderColor: Colors.alert.high + '60',
        ...Shadow.card,
        gap: 8,
    },
    simHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    simDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: Colors.alert.high,
    },
    simTitle: {
        fontSize: 12,
        fontWeight: '700',
        color: Colors.text.primary,
        flex: 1,
    },
    simClose: {
        padding: 2,
    },
    simButtonsRow: {
        flexDirection: 'row',
        gap: 6,
    },
    simStepBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        backgroundColor: Colors.bg.secondary,
        paddingVertical: 8,
        paddingHorizontal: 6,
        borderRadius: Radius.sm,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    simStepBtnActive: {
        backgroundColor: Colors.brand.primary,
        borderColor: Colors.brand.primary,
    },
    simStepBtnText: {
        fontSize: 10,
        fontWeight: '700',
        color: Colors.text.primary,
    },
    simStepBtnTextActive: {
        color: Colors.bg.primary,
    },

    fab: {
        position: 'absolute',
        bottom: 100,
        right: Spacing.md,
        backgroundColor: Colors.brand.primary,
        borderRadius: Radius.full,
        width: 64,
        height: 64,
        alignItems: 'center',
        justifyContent: 'center',
        ...Shadow.glow,
    },
    fabManual: { borderWidth: 2, borderColor: Colors.brand.glowStrong },
});
