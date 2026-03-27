/**
 * RoadStatusBadge — SafeRoute / Sapa Jol
 *
 * Отображает текущий статус дороги (выбранный маршрут).
 * Три состояния: open / caution / closed
 *
 * 🎨 ANIMATION_SLOT: status_pulse — Lottie/Reanimated пульс для closed
 * 🎨 ANIMATION_SLOT: status_transition — анимация смены статуса
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Radius } from '../constants/colors';
import type { RoadStatus } from '../hooks/useRoute';
import { useT } from '../i18n';

interface Props {
    status: RoadStatus;
    routeName?: string;
    isRouteMode: boolean;
    onToggleRoute: () => void;
}

const STATUS_STYLE: Record<RoadStatus, { color: string; bg: string; icon: string; key: 'road_open' | 'road_caution' | 'road_closed' }> = {
    open:    { color: Colors.brand.primary,   bg: Colors.brand.primary   + '20', icon: 'checkmark-circle', key: 'road_open' },
    caution: { color: Colors.alert.high,      bg: Colors.alert.high      + '20', icon: 'warning',          key: 'road_caution' },
    closed:  { color: Colors.alert.critical,  bg: Colors.alert.critical  + '20', icon: 'close-circle',     key: 'road_closed' },
};

export default function RoadStatusBadge({ status, routeName = 'A-17', isRouteMode, onToggleRoute }: Props) {
    const t = useT();
    const cfg = STATUS_STYLE[status];

    return (
        <View style={styles.wrap}>
            {/* Кнопка маршрута */}
            <TouchableOpacity
                style={[styles.routeBtn, isRouteMode && styles.routeBtnActive]}
                onPress={onToggleRoute}
            >
                <Ionicons
                    name={isRouteMode ? 'navigate' : 'navigate-outline'}
                    size={14}
                    color={isRouteMode ? Colors.bg.primary : Colors.text.secondary}
                />
                <Text style={[styles.routeBtnText, isRouteMode && styles.routeBtnTextActive]}>
                    {routeName}
                </Text>
            </TouchableOpacity>

            {/* Статус */}
            <View style={[styles.badge, { backgroundColor: cfg.bg }]}>
                {/* 🎨 ANIMATION_SLOT: status_pulse */}
                <Ionicons name={cfg.icon as any} size={13} color={cfg.color} />
                <Text style={[styles.badgeText, { color: cfg.color }]}>{t(cfg.key)}</Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    routeBtn: {
        flexDirection: 'row', alignItems: 'center', gap: 4,
        paddingHorizontal: 10, paddingVertical: 5,
        borderRadius: Radius.full,
        backgroundColor: Colors.bg.secondary,
        borderWidth: 1, borderColor: Colors.border,
    },
    routeBtnActive: { backgroundColor: Colors.brand.primary, borderColor: Colors.brand.primary },
    routeBtnText: { fontSize: 12, fontWeight: '700', color: Colors.text.secondary },
    routeBtnTextActive: { color: Colors.bg.primary },
    badge: {
        flexDirection: 'row', alignItems: 'center', gap: 4,
        paddingHorizontal: 10, paddingVertical: 5,
        borderRadius: Radius.full,
    },
    badgeText: { fontSize: 12, fontWeight: '700' },
});
