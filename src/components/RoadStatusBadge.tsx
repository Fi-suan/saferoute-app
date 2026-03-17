/**
 * RoadStatusBadge — SafeRoute / Sapa Jol
 *
 * Отображает текущий статус дороги (A-17 или текущий маршрут).
 * Три состояния: ТАЗА (зелёный) / САҚТЫҚ (оранжевый) / ЖАБЫҚ (красный)
 *
 * 🎨 ANIMATION_SLOT: status_pulse — Lottie/Reanimated пульс для ЖАБЫҚ
 * 🎨 ANIMATION_SLOT: status_transition — анимация смены статуса
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Radius } from '../constants/colors';
import type { RoadStatus } from '../hooks/useRoute';

interface Props {
    status: RoadStatus;
    routeName?: string;       // 'A-17' по умолчанию
    isRouteMode: boolean;
    onToggleRoute: () => void;
}

const STATUS_CONFIG: Record<RoadStatus, { color: string; bg: string; icon: string; labelKk: string }> = {
    open: { color: Colors.brand.primary, bg: Colors.brand.primary + '20', icon: 'checkmark-circle', labelKk: 'Жол таза' },
    caution: { color: Colors.alert.high, bg: Colors.alert.high + '20', icon: 'warning', labelKk: 'Сақтық!' },
    closed: { color: Colors.alert.critical, bg: Colors.alert.critical + '20', icon: 'close-circle', labelKk: 'Жол жабық' },
};

export default function RoadStatusBadge({ status, routeName = 'A-17', isRouteMode, onToggleRoute }: Props) {
    const cfg = STATUS_CONFIG[status];

    return (
        <View style={styles.wrap}>
            {/* Кнопка режима маршрута */}
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
                {/* 🎨 ANIMATION_SLOT: status_pulse — заменить Ionicons на Lottie для ЖАБЫҚ */}
                <Ionicons name={cfg.icon as any} size={13} color={cfg.color} />
                <Text style={[styles.badgeText, { color: cfg.color }]}>{cfg.labelKk}</Text>
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
    routeBtnActive: {
        backgroundColor: Colors.brand.primary,
        borderColor: Colors.brand.primary,
    },
    routeBtnText: { fontSize: 12, fontWeight: '700', color: Colors.text.secondary },
    routeBtnTextActive: { color: Colors.bg.primary },
    badge: {
        flexDirection: 'row', alignItems: 'center', gap: 4,
        paddingHorizontal: 10, paddingVertical: 5,
        borderRadius: Radius.full,
    },
    badgeText: { fontSize: 12, fontWeight: '700' },
});
