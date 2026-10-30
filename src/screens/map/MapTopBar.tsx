/**
 * MapTopBar — верхний бар карты.
 *
 * Design: one compact glass card, two clean rows:
 *   1) brand + incident count          | online status
 *   2) route pill (name + status dot)  | navigation button
 * Conditional badges (manual mode, pending queue) render inline
 * without breaking the layout.
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Radius, Shadow } from '../../constants/colors';
import { useT } from '../../i18n';
import { ROUTE_NAMES } from './constants';

type RoadStatus = 'open' | 'caution' | 'closed';

interface MapTopBarProps {
    incidentCount: number;
    pendingReportsCount: number;
    isManualMode: boolean;
    isOnline: boolean;
    roadStatus: RoadStatus;
    activeRouteId: string;
    isRouteMode: boolean;
    onToggleRoute: () => void;
    navResult: { totalDistance: string; totalDuration: string } | null;
    navLoading: boolean;
    onToggleNavigation: () => void;
}

const STATUS_DOT: Record<RoadStatus, string> = {
    open: Colors.brand.primary,
    caution: Colors.alert.high,
    closed: Colors.alert.critical,
};

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
    const statusLabel =
        roadStatus === 'open'
            ? t('road_open')
            : roadStatus === 'caution'
              ? t('road_caution')
              : t('road_closed');

    return (
        <View style={styles.card}>
            {/* Row 1 — brand + count | online */}
            <View style={styles.row}>
                <View style={styles.brand}>
                    <Ionicons name="shield-checkmark" size={18} color={Colors.brand.primary} />
                    <Text style={styles.brandText}>Sapa Jol</Text>
                    <View style={styles.countBadge}>
                        <Text style={styles.countBadgeText}>{incidentCount}</Text>
                    </View>
                    {isManualMode && (
                        <View style={styles.pillBadge}>
                            <View style={styles.pillDot} />
                            <Text style={styles.pillBadgeText}>{t('herd_mode_badge')}</Text>
                        </View>
                    )}
                </View>
                <View style={styles.onlineWrap}>
                    <View
                        style={[
                            styles.onlineDot,
                            {
                                backgroundColor: isOnline
                                    ? Colors.brand.primary
                                    : Colors.alert.medium,
                            },
                        ]}
                    />
                    <Text
                        style={[
                            styles.onlineText,
                            { color: isOnline ? Colors.brand.primary : Colors.alert.medium },
                        ]}
                    >
                        {isOnline ? t('online') : t('offline')}
                    </Text>
                </View>
            </View>

            {/* Row 2 — route + status | navigation */}
            <View style={styles.row}>
                <TouchableOpacity
                    style={[styles.routePill, isRouteMode && styles.routePillActive]}
                    onPress={onToggleRoute}
                >
                    <Ionicons
                        name="navigate"
                        size={15}
                        color={isRouteMode ? Colors.bg.primary : Colors.text.secondary}
                    />
                    <Text style={[styles.routeText, isRouteMode && styles.routeTextActive]}>
                        {ROUTE_NAMES[activeRouteId] ?? 'A-17'}
                    </Text>
                    <View style={styles.routeDivider} />
                    <View style={[styles.statusDot, { backgroundColor: STATUS_DOT[roadStatus] }]} />
                    <Text style={styles.statusText}>{statusLabel}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.navBtn, navResult && styles.navBtnActive]}
                    onPress={onToggleNavigation}
                    disabled={navLoading}
                >
                    {navLoading ? (
                        <ActivityIndicator
                            size="small"
                            color={navResult ? Colors.bg.primary : Colors.brand.primary}
                        />
                    ) : (
                        <Ionicons
                            name={navResult ? 'stop-circle' : 'arrow-redo'}
                            size={15}
                            color={navResult ? Colors.bg.primary : Colors.brand.primary}
                        />
                    )}
                    <Text
                        style={[styles.navBtnText, navResult && styles.navBtnTextActive]}
                        numberOfLines={1}
                    >
                        {navResult
                            ? `${navResult.totalDistance} · ${navResult.totalDuration}`
                            : t('route_mode_label')}
                    </Text>
                </TouchableOpacity>
            </View>

            {pendingReportsCount > 0 && (
                <View style={styles.queueRow}>
                    <Ionicons name="cloud-upload-outline" size={13} color={Colors.alert.medium} />
                    <Text style={styles.queueText}>
                        {pendingReportsCount} {t('alerts_pending_send')}
                    </Text>
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        backgroundColor: 'rgba(8, 10, 14, 0.92)',
        borderRadius: Radius.lg + 4,
        paddingVertical: 12,
        paddingHorizontal: 14,
        borderWidth: 1,
        borderColor: Colors.border,
        gap: 10,
        ...Shadow.card,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
    },

    // Row 1
    brand: { flexDirection: 'row', alignItems: 'center', gap: 7, flexShrink: 1 },
    brandText: { fontSize: 16, fontWeight: '800', color: Colors.text.primary, letterSpacing: 0.3 },
    countBadge: {
        backgroundColor: Colors.brand.primary,
        borderRadius: Radius.full,
        minWidth: 20,
        height: 20,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 6,
    },
    countBadgeText: { fontSize: 11.5, fontWeight: '800', color: Colors.bg.primary },
    pillBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: Colors.brand.primary + '20',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: Radius.full,
    },
    pillDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: Colors.brand.primary },
    pillBadgeText: { fontSize: 10.5, fontWeight: '700', color: Colors.brand.primary },
    onlineWrap: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    onlineDot: { width: 7, height: 7, borderRadius: 4 },
    onlineText: { fontSize: 12, fontWeight: '700' },

    // Row 2
    routePill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: Radius.full,
        backgroundColor: Colors.bg.glass,
        borderWidth: 1,
        borderColor: Colors.border,
        flexShrink: 1,
    },
    routePillActive: { backgroundColor: Colors.brand.primary, borderColor: Colors.brand.primary },
    routeText: { fontSize: 13, fontWeight: '800', color: Colors.text.primary },
    routeTextActive: { color: Colors.bg.primary },
    routeDivider: { width: 1, height: 12, backgroundColor: Colors.border },
    statusDot: { width: 8, height: 8, borderRadius: 4 },
    statusText: { fontSize: 12.5, fontWeight: '700', color: Colors.text.secondary },

    navBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 13,
        paddingVertical: 8,
        borderRadius: Radius.full,
        backgroundColor: Colors.brand.primary + '15',
        borderWidth: 1,
        borderColor: Colors.brand.primary + '40',
    },
    navBtnActive: { backgroundColor: Colors.brand.primary, borderColor: Colors.brand.primary },
    navBtnText: { fontSize: 12.5, fontWeight: '700', color: Colors.brand.primary, maxWidth: 170 },
    navBtnTextActive: { color: Colors.bg.primary },

    // Pending queue (offline)
    queueRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        backgroundColor: Colors.alert.medium + '15',
        borderRadius: Radius.sm,
        paddingHorizontal: 9,
        paddingVertical: 5,
        alignSelf: 'flex-start',
    },
    queueText: { fontSize: 11, fontWeight: '700', color: Colors.alert.medium },
});
