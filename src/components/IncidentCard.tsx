/**
 * IncidentCard — SafeRoute / Sapa Jol
 *
 * Переиспользуемая карточка инцидента.
 * Фича 1: показывает фото (photo_uri или photo_url) если есть.
 *
 * 🎨 ANIMATION_SLOT: card_appear — Reanimated FadeInDown при появлении в списке
 * 🎨 ANIMATION_SLOT: card_severity_flash — мигание для severity=5
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Radius, Shadow } from '../constants/colors';
import { Incident, getIncidentMeta } from '../constants/incidents';

function timeAgo(dateStr: string): string {
    // Бэкенд возвращает UTC без суффикса 'Z' — принудительно помечаем как UTC
    const utc = dateStr.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(dateStr)
        ? dateStr
        : dateStr + 'Z';
    const diff = Date.now() - new Date(utc).getTime();
    if (diff < 0) return 'жаңа ғана';
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'жаңа ғана';
    if (mins < 60) return `${mins} мин бұрын`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs} сағ бұрын`;
    return `${Math.floor(hrs / 24)} күн бұрын`;
}

function SeverityDots({ level }: { level: number }) {
    return (
        <View style={styles.severityRow}>
            {[1, 2, 3, 4, 5].map((i) => (
                <View
                    key={i}
                    style={[
                        styles.severityDot,
                        {
                            backgroundColor:
                                i <= level
                                    ? level >= 4 ? Colors.alert.critical
                                        : level >= 3 ? Colors.alert.high
                                            : Colors.alert.medium
                                    : Colors.bg.tertiary,
                        },
                    ]}
                />
            ))}
        </View>
    );
}

interface Props {
    item: Incident;
    onPress?: (item: Incident) => void;
    compact?: boolean;
}

export default function IncidentCard({ item, onPress, compact }: Props) {
    const meta = getIncidentMeta(item.incident_type);
    const photoUri = item.photo_uri || item.photo_url;

    return (
        // 🎨 ANIMATION_SLOT: card_appear — оберни в Animated.View с FadeInDown
        <TouchableOpacity
            style={[
                styles.card,
                !item.is_active && styles.cardResolved,
                item.severity >= 5 && item.is_active && styles.cardCritical,
            ]}
            onPress={() => onPress?.(item)}
            activeOpacity={onPress ? 0.7 : 1}
        >
            {/* Фото (Фича 1) — показывается если есть */}
            {photoUri && !compact && (
                <Image source={{ uri: photoUri }} style={styles.photo} resizeMode="cover" />
            )}

            <View style={styles.cardHeader}>
                <View style={[styles.typeIconWrap, { backgroundColor: meta.color + '20' }]}>
                    <Ionicons name={meta.icon as any} size={20} color={meta.color} />
                </View>
                <View style={styles.cardHeaderText}>
                    <Text style={styles.cardTitle}>{meta.label}</Text>
                    <Text style={styles.cardTime}>{timeAgo(item.created_at)}</Text>
                </View>

                {/* AI бейдж: только при верификации с уверенностью ≥75% */}
                {item.ai_verified && (item.ai_confidence === undefined || item.ai_confidence >= 0.75) && (
                    <View style={styles.aiBadge}>
                        <Ionicons name="checkmark-circle" size={14} color={Colors.brand.primary} />
                        <Text style={styles.aiBadgeText}>AI</Text>
                    </View>
                )}
                {photoUri && (
                    <View style={[styles.aiBadge, { backgroundColor: Colors.alert.info + '20' }]}>
                        <Ionicons name="camera" size={12} color={Colors.alert.info} />
                    </View>
                )}
                {!item.is_active && (
                    <View style={[styles.aiBadge, { backgroundColor: Colors.incident.resolved + '20' }]}>
                        <Ionicons name="checkmark-done" size={14} color={Colors.incident.resolved} />
                        <Text style={[styles.aiBadgeText, { color: Colors.incident.resolved }]}>Шешілді</Text>
                    </View>
                )}
            </View>

            {!compact && item.description ? (
                <Text style={styles.cardDesc} numberOfLines={2}>{item.description}</Text>
            ) : null}

            <View style={styles.cardFooter}>
                <SeverityDots level={item.severity} />

                <View style={styles.cardStat}>
                    <Ionicons name="people-outline" size={14} color={Colors.text.muted} />
                    <Text style={styles.cardStatText}>{item.confirmations_count}/3</Text>
                </View>

                <View style={styles.cardStat}>
                    <Ionicons name="location-outline" size={14} color={Colors.text.muted} />
                    <Text style={styles.cardStatText}>
                        {item.latitude.toFixed(3)}, {item.longitude.toFixed(3)}
                    </Text>
                </View>

                {onPress && (
                    <Ionicons name="chevron-forward" size={16} color={Colors.text.muted} style={{ marginLeft: 'auto' }} />
                )}
            </View>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    card: {
        backgroundColor: Colors.bg.secondary,
        borderRadius: Radius.lg,
        padding: Spacing.md,
        marginBottom: Spacing.sm,
        borderWidth: 1,
        borderColor: Colors.border,
        ...Shadow.card,
    },
    cardResolved: { opacity: 0.6 },
    cardCritical: { borderColor: Colors.alert.critical + '60' },

    // Фича 1: фото
    photo: {
        width: '100%', height: 120,
        borderRadius: Radius.md, marginBottom: Spacing.sm,
    },

    cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
    typeIconWrap: {
        width: 36, height: 36, borderRadius: Radius.sm,
        alignItems: 'center', justifyContent: 'center', marginRight: Spacing.sm,
    },
    cardHeaderText: { flex: 1 },
    cardTitle: { fontSize: 15, fontWeight: '600', color: Colors.text.primary },
    cardTime: { fontSize: 12, color: Colors.text.muted, marginTop: 1 },
    aiBadge: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: Colors.brand.glow,
        paddingHorizontal: 8, paddingVertical: 3,
        borderRadius: Radius.full, gap: 3, marginLeft: 6,
    },
    aiBadgeText: { fontSize: 10, fontWeight: '700', color: Colors.brand.primary },
    cardDesc: { fontSize: 13, color: Colors.text.secondary, lineHeight: 18, marginBottom: 8 },
    cardFooter: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    severityRow: { flexDirection: 'row', gap: 3 },
    severityDot: { width: 6, height: 6, borderRadius: 3 },
    cardStat: { flexDirection: 'row', alignItems: 'center', gap: 3 },
    cardStatText: { fontSize: 11, color: Colors.text.muted },
});
