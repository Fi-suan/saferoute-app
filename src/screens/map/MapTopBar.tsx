/**
 * MapTopBar — верхний бар карты:
 * заголовок, индикатор online/offline, статус дороги, кнопка навигации.
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Radius, Shadow } from '../../constants/colors';
import RoadStatusBadge from '../../components/RoadStatusBadge';
import { useT } from '../../i18n';
import { ROUTE_NAMES } from './constants';

interface MapTopBarProps {
    incidentCount: number;
    pendingReportsCount: number;
    isManualMode: boolean;
    isOnline: boolean;
    roadStatus: 'open' | 'caution' | 'closed';
    activeRouteId: string;
    isRouteMode: boolean;
    onToggleRoute: () => void;
    navResult: { totalDistance: string; totalDuration: string } | null;
    navLoading: boolean;
    onToggleNavigation: () => void;
}

export default function MapTopBar({
    incidentCount,
    pendingReportsCount,
    isManualMode,
    isOnline,
    roadStatus,
    activeRouteId,
    isRouteMode,
    onToggleRoute,
    navResult,
    navLoading,
    onToggleNavigation,
}: MapTopBarProps) {
    const t = useT();
    return (
        <View style={styles.topBar}>
            <View style={styles.topBarRow}>
                <Ionicons name="shield-checkmark" size={20} color={Colors.brand.primary} />
                <Text style={styles.topBarText}>Sapa Jol</Text>
                <View style={styles.topBarBadge}>
                    <Text style={styles.topBarBadgeText}>{incidentCount}</Text>
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
                    <Ionicons
                        name={isOnline ? 'wifi' : 'cloud-offline'}
                        size={12}
                        color={isOnline ? Colors.brand.primary : Colors.alert.medium}
                    />
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
                    onToggleRoute={onToggleRoute}
                />
                <TouchableOpacity
                    style={[styles.navBtn, navResult && styles.navBtnActive]}
                    onPress={onToggleNavigation}
                    disabled={navLoading}
                >
                    {navLoading
                        ? <ActivityIndicator size="small" color={navResult ? Colors.bg.primary : Colors.brand.primary} />
                        : <Ionicons
                            name={navResult ? 'stop-circle' : 'arrow-redo'}
                            size={14}
                            color={navResult ? Colors.bg.primary : Colors.brand.primary}
                          />
                    }
                    <Text style={[styles.navBtnText, navResult && styles.navBtnTextActive]}>
                        {navResult
                            ? `${navResult.totalDistance} · ${navResult.totalDuration}`
                            : t('route_mode_label')}
                    </Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
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
});
