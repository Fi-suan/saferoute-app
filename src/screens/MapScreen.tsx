/**
 * MapScreen — SafeRoute / Sapa Jol
 * Nothing Phone стиль: тёмная карта, геометрические маркеры.
 */
import React, { useState, useRef } from 'react';

/** Dark map style — Nothing Phone aesthetic */
const DARK_MAP_STYLE = [
    { elementType: 'geometry', stylers: [{ color: '#1E2028' }] },
    { elementType: 'labels.text.stroke', stylers: [{ color: '#1E2028' }] },
    { elementType: 'labels.text.fill', stylers: [{ color: '#6B6E7D' }] },
    { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#A3A6B4' }] },
    { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#272935' }] },
    { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#272935' }] },
    { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#2ECC7130' }] },
    { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#2ECC7150' }] },
    { featureType: 'road.highway', elementType: 'labels.text.fill', stylers: [{ color: '#2ECC71' }] },
    { featureType: 'transit', elementType: 'geometry', stylers: [{ color: '#2A2D35' }] },
    { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#181A22' }] },
    { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#2A2D35' }] },
    { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#272935' }] },
    { featureType: 'poi', elementType: 'labels.text.fill', stylers: [{ color: '#6B6E7D' }] },
    { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#181A22' }] },
    { featureType: 'landscape', elementType: 'geometry', stylers: [{ color: '#1E2028' }] },
];
import {
    View, Text, StyleSheet, TouchableOpacity,
    Modal, ActivityIndicator, Alert, Linking, Vibration,
} from 'react-native';
import MapView, { Marker, Circle, Polyline } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import LottieView from 'lottie-react-native';
import { useNavigation, CompositeNavigationProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { Colors, Spacing, Radius, Shadow } from '../constants/colors';
import { getIncidentMeta, Incident } from '../constants/incidents';
import { useIncidents } from '../hooks/useIncidents';
import { useLocation } from '../hooks/useLocation';
import { useRoute } from '../hooks/useRoute';
import { useLivestock } from '../hooks/useLivestock';
import { useUserProfile } from '../hooks/useUserProfile';
import { Config } from '../config';
import ProximityBanner from '../components/ProximityBanner';
import ReportModal from '../components/ReportModal';
import RoadStatusBadge from '../components/RoadStatusBadge';
import { RootStackParamList } from '../navigation/RootNavigator';
import { scheduleProximityNotification } from '../services/notifications';
import { LIVESTOCK_META } from '../constants/livestock';
import { useAppDialog } from '../components/AppDialog';

/** Точки трассы A-17 Астана — Павлодар (упрощённые веховые пункты) */
const A17_WAYPOINTS = [
    { latitude: 51.18, longitude: 71.45 },
    { latitude: 51.28, longitude: 71.72 },
    { latitude: 51.32, longitude: 71.95 },
    { latitude: 51.39, longitude: 72.48 },
    { latitude: 51.45, longitude: 72.82 },
    { latitude: 51.58, longitude: 73.45 },
    { latitude: 51.64, longitude: 73.92 },
    { latitude: 51.72, longitude: 74.55 },
    { latitude: 51.78, longitude: 75.40 },
    { latitude: 51.85, longitude: 75.90 },
    { latitude: 52.05, longitude: 76.35 },
    { latitude: 52.18, longitude: 76.68 },
    { latitude: 52.29, longitude: 76.97 },
];

const ROAD_STATUS_COLOR = {
    open: '#2ECC71',
    caution: '#E67E22',
    closed: '#E74C3C',
} as const;

type NavProp = CompositeNavigationProp<
    BottomTabNavigationProp<Record<string, undefined>>,
    NativeStackNavigationProp<RootStackParamList>
>;

type FilterType = 'all' | 'incidents';






export default function MapScreen() {
    const navigation = useNavigation<NavProp>();
    const mapRef = useRef<MapView>(null);
    const [filter, setFilter] = useState<FilterType>('all');
    const [showReport, setShowReport] = useState(false);
    const [showOwnerReport, setShowOwnerReport] = useState(false);
    const [confirmDialog, setConfirmDialog] = useState<Incident | null>(null);
    const { profile } = useUserProfile();
    const { showDialog, DialogComponent } = useAppDialog();

    const { incidents, isOnline, loading, submitReport, confirmIncident, pendingReportsCount } =
        useIncidents('active');
    const { location, nearbyAlert, confirmCandidate, dismissNearbyAlert, dismissConfirmCandidate } =
        useLocation(incidents, Config.DEFAULT_PROXIMITY_RADIUS_KM);

    // Фича 2+3: Режим маршрута A-17 + статус дороги
    const { isRouteMode, toggleRouteMode, routeIncidents, roadStatus } = useRoute(incidents);

    // Фича livestock: скот вблизи дорог
    const { livestock } = useLivestock(location);

    React.useEffect(() => {
        if (nearbyAlert) {
            const meta = getIncidentMeta(nearbyAlert.incident_type);
            scheduleProximityNotification({
                title: '⚠️ Абай болыңыз!',
                body: `${meta.label}${nearbyAlert.description ? ` — ${nearbyAlert.description}` : ''}`,
                incidentId: nearbyAlert.id,
            });
        }
    }, [nearbyAlert?.id]);

    React.useEffect(() => {
        if (confirmCandidate) setConfirmDialog(confirmCandidate);
    }, [confirmCandidate?.id]);

    const handleConfirm = async (isResolved: boolean) => {
        if (!confirmDialog) return;
        setConfirmDialog(null);
        dismissConfirmCandidate();
        await confirmIncident(confirmDialog.id, isResolved);
        if (isResolved) showDialog({
            title: 'Рахмет!',
            message: '3 растаудан кейін белгі жойылады.',
            icon: 'checkmark-circle',
            iconColor: Colors.brand.primary,
            buttons: [{ text: 'Түсіндім', style: 'default' }],
        });
    };

    const goToDetail = (incident: Incident) => {
        navigation.navigate('IncidentDetail', { incident });
    };

    // Фича 6: SOS — 5 сек удержание + эскалирующая вибрация + только метка (тест режим)
    const handleSOSLongPress = () => {
        // Эскалирующая: тихо → сильнее → очень сильно
        Vibration.vibrate([0, 100, 80, 200, 80, 400, 80, 600]);
        showDialog({
            title: 'SOS — Жедел жәрдем',
            message: 'Орналасуыңыз жазылып, белгі автоматты түрде жасалды.\n\n⚠️ Тест режимі: 112 шақыру өшірілген.',
            icon: 'alert-circle',
            iconColor: Colors.alert.critical,
            buttons: [
                {
                    text: 'Белгі ғана қою',
                    icon: 'location',
                    style: 'default',
                    onPress: async () => {
                        if (location) {
                            await submitReport({
                                incident_type: 'crash',
                                description: '🆘 SOS! Жедел жәрдем қажет. Жүргізуші хабарлады.',
                                severity: 5,
                                latitude: location.lat,
                                longitude: location.lon,
                            });
                        }
                        showDialog({
                            title: 'Белгі жасалды',
                            message: 'Жақын жүргізушілер ескертілді.',
                            icon: 'checkmark-circle',
                            iconColor: Colors.brand.primary,
                            buttons: [{ text: 'Түсіндім', style: 'default' }],
                        });
                    },
                },
                { text: 'Бас тарту', style: 'cancel' },
            ],
        });
    };


    const displayedIncidents = isRouteMode ? routeIncidents : incidents.filter(i => i.is_active);
    const showIncidents = filter === 'all' || filter === 'incidents';
    const showLivestock = filter === 'all' || filter === 'incidents';

    const initialRegion = location
        ? { latitude: location.lat, longitude: location.lon, latitudeDelta: 0.05, longitudeDelta: 0.05 }
        : { latitude: 51.96, longitude: 74.2, latitudeDelta: 2.5, longitudeDelta: 4 };  // Центр трассы A-17

    if (loading) {
        return (
            <View style={styles.loadingWrap}>
                <LottieView
                    source={require('../assets/lottie/loading.json')}
                    autoPlay
                    loop
                    style={{ width: 120, height: 120 }}
                />
                <Text style={styles.loadingText}>Орналасу анықталуда...</Text>
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
                userInterfaceStyle="dark"
                customMapStyle={DARK_MAP_STYLE}
            >
                {showIncidents && displayedIncidents.map((inc) => {
                    const meta = getIncidentMeta(inc.incident_type);
                    return (
                        <React.Fragment key={`inc-${inc.id}`}>
                            {/* Кастомный маркер Nothing-стиль: тёмный квадрат + иконка + цветная рамка */}
                            <Marker
                                coordinate={{ latitude: inc.latitude, longitude: inc.longitude }}
                                onCalloutPress={() => goToDetail(inc)}
                                tracksViewChanges={false}
                            >
                                <View style={styles.markerContainer}>
                                    <View style={[styles.markerCard, { borderColor: meta.color }]}>
                                        <Ionicons name={meta.icon as any} size={16} color={meta.color} />
                                    </View>
                                    <View style={[styles.markerPointer, { borderTopColor: meta.color }]} />
                                </View>
                            </Marker>

                            {/* Core radar dot + Glowing Aura Effect */}
                            <Circle
                                center={{ latitude: inc.latitude, longitude: inc.longitude }}
                                radius={50}
                                fillColor={meta.color}
                            />
                            <Circle
                                center={{ latitude: inc.latitude, longitude: inc.longitude }}
                                radius={150}
                                fillColor={meta.color + '60'}
                            />
                            <Circle
                                center={{ latitude: inc.latitude, longitude: inc.longitude }}
                                radius={400}
                                fillColor={meta.color + '20'}
                            />
                            <Circle
                                center={{ latitude: inc.latitude, longitude: inc.longitude }}
                                radius={800}
                                fillColor={meta.color + '0A'}
                                strokeColor={meta.color + '40'}
                                strokeWidth={1}
                            />
                        </React.Fragment>
                    );
                })}

                {/* Скот на карте (Без иконок, радарный стиль) */}
                {showLivestock && livestock.map((animal) => {
                    const meta = LIVESTOCK_META[animal.type] || {
                        label: 'Жануар', labelKk: 'Жануар', color: Colors.brand.primary, emoji: '🐾'
                    };
                    const isDangerous = animal.isNearRoad && animal.distanceToRoadM < 300;
                    const markerColor = isDangerous ? Colors.alert.critical : meta.color;
                    return (
                        <React.Fragment key={`ls-${animal.id}`}>
                            {/* Кастомный маркер скота: эмоджи + счётчик голов */}
                            <Marker
                                coordinate={{ latitude: animal.latitude, longitude: animal.longitude }}
                                tracksViewChanges={false}
                            >
                                <View style={styles.markerContainer}>
                                    <View style={[styles.markerCard, styles.markerCardLivestock, { borderColor: markerColor }]}>
                                        <Text style={styles.livestockEmoji}>{meta.emoji}</Text>
                                        {isDangerous && (
                                            <View style={styles.dangerBadge}>
                                                <Text style={styles.dangerBadgeText}>!</Text>
                                            </View>
                                        )}
                                    </View>
                                    <View style={[styles.markerPointer, { borderTopColor: markerColor }]} />
                                </View>
                            </Marker>

                            <Circle
                                center={{ latitude: animal.latitude, longitude: animal.longitude }}
                                radius={40}
                                fillColor={isDangerous ? Colors.alert.critical : meta.color}
                            />
                            {isDangerous && (
                                <>
                                    <Circle
                                        center={{ latitude: animal.latitude, longitude: animal.longitude }}
                                        radius={animal.distanceToRoadM}
                                        fillColor={Colors.alert.critical + '20'}
                                    />
                                    <Circle
                                        center={{ latitude: animal.latitude, longitude: animal.longitude }}
                                        radius={animal.distanceToRoadM * 1.5}
                                        fillColor={Colors.alert.critical + '08'}
                                        strokeColor={Colors.alert.critical + '40'}
                                        strokeWidth={1}
                                    />
                                </>
                            )}
                        </React.Fragment>
                    );
                })}

                {/* Polyline трассы A-17 — цвет по статусу дороги */}
                <Polyline
                    coordinates={A17_WAYPOINTS}
                    strokeColor={ROAD_STATUS_COLOR[roadStatus]}
                    strokeWidth={3}
                    lineDashPattern={roadStatus === 'closed' ? [8, 6] : undefined}
                />

            </MapView>

            {/* Верхний бар */}
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
                    <View style={[styles.liteTag, isOnline ? styles.liteTagOnline : styles.liteTagOffline]}>
                        <Ionicons
                            name={isOnline ? 'wifi' : 'cloud-offline'}
                            size={12}
                            color={isOnline ? Colors.brand.primary : Colors.alert.medium}
                        />
                        <Text style={[styles.liteTagText, { color: isOnline ? Colors.brand.primary : Colors.alert.medium }]}>
                            {isOnline ? 'Online' : 'Lite'}
                        </Text>
                    </View>
                </View>

                {/* Фича 2+3: Road status + Route mode (строка 2) */}
                <View style={styles.statusRow}>
                    <RoadStatusBadge
                        status={roadStatus}
                        isRouteMode={isRouteMode}
                        onToggleRoute={toggleRouteMode}
                    />

                </View>
            </View>

            {/* Фильтры */}
            <View style={styles.filterRow}>
                {([
                    { key: 'all', label: 'Барлығы', icon: 'layers' },
                    { key: 'incidents', label: 'Белгілер', icon: 'warning' },
                ] as const).map((f) => (
                    <TouchableOpacity
                        key={f.key}
                        style={[styles.filterChip, filter === f.key && styles.filterChipActive]}
                        onPress={() => setFilter(f.key)}
                    >
                        <Ionicons
                            name={f.icon as any} size={14}
                            color={filter === f.key ? Colors.bg.primary : Colors.text.secondary}
                        />
                        <Text style={[styles.filterChipText, filter === f.key && styles.filterChipTextActive]}>
                            {f.label}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            {/* Locate button */}
            <TouchableOpacity
                style={styles.myLocBtn}
                onPress={() => location && mapRef.current?.animateToRegion(
                    { latitude: location.lat, longitude: location.lon, latitudeDelta: 0.05, longitudeDelta: 0.05 }, 500,
                )}
            >
                <Ionicons name="locate" size={22} color={Colors.brand.primary} />
            </TouchableOpacity>

            {/* FAB — нажатие: репорт | долгое нажатие 5с: SOS */}
            <TouchableOpacity
                style={styles.fab}
                onPress={() => profile.role === 'livestock_owner' ? setShowOwnerReport(true) : setShowReport(true)}
                onLongPress={handleSOSLongPress}
                delayLongPress={5000}
            >
                {/* 🎨 Анимация пульса под кнопкой */}
                <LottieView
                    source={require('../assets/lottie/alert_pulse.json')}
                    autoPlay
                    loop
                    style={{ position: 'absolute', width: 150, height: 150 }}
                />
                <Ionicons name="add" size={30} color={Colors.bg.primary} />
            </TouchableOpacity>

            {/* Proximity Alert */}
            {nearbyAlert && (
                // 🎨 ANIMATION_SLOT: banner_slide — Reanimated слайд вместо Animated
                <ProximityBanner
                    incident={nearbyAlert}
                    onDismiss={dismissNearbyAlert}
                    onViewDetail={goToDetail}
                />
            )}

            {/* Confirm Dialog (только при физическом приближении) */}
            <Modal visible={!!confirmDialog} transparent animationType="fade">
                <View style={styles.confirmOverlay}>
                    <View style={styles.confirmCard}>
                        {/* Вопросительный знак (Анимация Lottie) */}
                        <LottieView
                            source={require('../assets/lottie/confirm_question.json')}
                            autoPlay
                            loop
                            style={{ width: 90, height: 90 }}
                        />
                        <Text style={styles.confirmTitle}>Мәселе шешілді ме?</Text>
                        <Text style={styles.confirmDesc}>
                            Сіз белгінің жанынан өттіңіз. Жол тазарды ма?
                        </Text>
                        {confirmDialog && (
                            <Text style={styles.confirmIncidentType}>
                                {getIncidentMeta(confirmDialog.incident_type).label}
                            </Text>
                        )}
                        <View style={styles.confirmButtons}>
                            <TouchableOpacity
                                style={[styles.confirmBtn, { backgroundColor: Colors.brand.primary }]}
                                onPress={() => handleConfirm(true)}
                            >
                                <Ionicons name="checkmark" size={18} color={Colors.bg.primary} />
                                <Text style={styles.confirmBtnText}>Иә</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.confirmBtn, { backgroundColor: Colors.alert.critical }]}
                                onPress={() => handleConfirm(false)}
                            >
                                <Ionicons name="close" size={18} color={Colors.white} />
                                <Text style={[styles.confirmBtnText, { color: Colors.white }]}>Жоқ</Text>
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
                            <Text style={styles.confirmDetailText}>Белгіні қарау →</Text>
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

            {/* Временный модал для Мал иесі */}
            <Modal visible={showOwnerReport} transparent animationType="slide">
                <View style={styles.confirmOverlay}>
                    <View style={styles.confirmCard}>
                        <Ionicons name="paw" size={48} color={Colors.brand.primary} />
                        <Text style={styles.confirmTitle}>Малды тіркеу</Text>
                        <Text style={styles.confirmDesc}>Бұл бөлім мал иестері үшін жасалуда (Жуықта чипсіз тіркеу іске қосылады).</Text>

                        <TouchableOpacity style={[styles.confirmBtn, { backgroundColor: Colors.brand.primary, marginTop: 24 }]} onPress={() => setShowOwnerReport(false)}>
                            <Text style={styles.confirmBtnText}>Түсіндім</Text>
                        </TouchableOpacity>
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
        backgroundColor: Colors.overlay, borderRadius: Radius.md,
        paddingVertical: 12, paddingHorizontal: Spacing.md,
        borderWidth: 1, borderColor: Colors.border, ...Shadow.card,
        gap: 10,
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
        backgroundColor: Colors.alert.medium + '20', paddingHorizontal: 6,
        paddingVertical: 3, borderRadius: Radius.full,
    },
    offlineQueueText: { fontSize: 10, fontWeight: '700', color: Colors.alert.medium },
    liteTag: {
        flexDirection: 'row', alignItems: 'center', gap: 4,
        paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.full, marginLeft: 'auto',
    },
    liteTagOnline: { backgroundColor: Colors.brand.primary + '20' },
    liteTagOffline: { backgroundColor: Colors.alert.medium + '20' },
    liteTagText: { fontSize: 11, fontWeight: '700' },

    statusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    tripBtn: {
        flexDirection: 'row', alignItems: 'center', gap: 4,
        paddingHorizontal: 10, paddingVertical: 5,
        borderRadius: Radius.full,
        backgroundColor: Colors.bg.tertiary,
        borderWidth: 1, borderColor: Colors.border,
    },
    tripBtnActive: { borderColor: Colors.alert.critical + '60' },
    tripBtnText: { fontSize: 11, fontWeight: '600', color: Colors.text.muted },

    filterRow: {
        position: 'absolute', top: 142, left: Spacing.md, right: Spacing.md,
        flexDirection: 'row', gap: 8,
    },
    filterChip: {
        flexDirection: 'row', alignItems: 'center', gap: 5,
        paddingVertical: 8, paddingHorizontal: 12,
        borderRadius: Radius.sm, backgroundColor: Colors.overlay,
        borderWidth: 1, borderColor: Colors.border,
    },
    filterChipActive: { backgroundColor: Colors.brand.primary, borderColor: Colors.brand.primary },
    filterChipText: { fontSize: 12, fontWeight: '600', color: Colors.text.secondary },
    filterChipTextActive: { color: Colors.bg.primary },

    myLocBtn: {
        position: 'absolute', bottom: 180, right: Spacing.md,
        backgroundColor: Colors.bg.secondary, borderRadius: Radius.full,
        width: 44, height: 44, alignItems: 'center', justifyContent: 'center',
        borderWidth: 1, borderColor: Colors.border, ...Shadow.card,
    },
    fab: {
        position: 'absolute', bottom: 100, right: Spacing.md,
        backgroundColor: Colors.brand.primary, borderRadius: Radius.full,
        width: 64, height: 64, alignItems: 'center', justifyContent: 'center', ...Shadow.glow,
    },

    // Кастомные маркеры — Nothing Phone стиль
    markerContainer: { alignItems: 'center' },
    markerCard: {
        width: 36, height: 36,
        backgroundColor: Colors.bg.secondary,
        borderRadius: Radius.sm,
        borderWidth: 2,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.35,
        shadowRadius: 4,
        elevation: 5,
    },
    markerCardLivestock: { width: 40, height: 40, borderRadius: Radius.md, position: 'relative' },
    markerPointer: {
        width: 0, height: 0,
        borderLeftWidth: 5, borderRightWidth: 5, borderTopWidth: 7,
        borderLeftColor: 'transparent', borderRightColor: 'transparent',
    },
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
});
