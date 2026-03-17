/**
 * IncidentDetailScreen — SafeRoute / Sapa Jol
 *
 * Read-only детальный просмотр инцидента.
 * Новые фичи:
 * - Фича 1: Полноразмерное фото (photo_uri / photo_url)
 * - Фича 5: Share кнопка — делиться через нативный диалог
 *
 * Confirmation buttons убраны — они появляются только
 * через ProximityBanner когда пользователь реально рядом.
 *
 * 🎨 ANIMATION_SLOT: photo_expand — тап на фото → fullscreen с Reanimated zoom
 * 🎨 ANIMATION_SLOT: detail_enter — shared element transition с карты
 * 🎨 ANIMATION_SLOT: ai_confidence_bar — анимированный прогресс бар AI confidence
 */
import React from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    Linking, Image, Share, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute as useNavRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Colors, Spacing, Radius, Shadow } from '../constants/colors';
import { getIncidentMeta } from '../constants/incidents';
import { RootStackParamList } from '../navigation/RootNavigator';

type NavProp = NativeStackNavigationProp<RootStackParamList>;

const SEVERITY_LABELS: Record<number, { label: string; color: string }> = {
    1: { label: 'Өте төмен', color: Colors.alert.low },
    2: { label: 'Төмен', color: Colors.alert.info },
    3: { label: 'Орташа', color: Colors.alert.medium },
    4: { label: 'Жоғары', color: Colors.alert.high },
    5: { label: 'КРИТИКАЛЫҚ', color: Colors.alert.critical },
};

const EMERGENCY_CONTACTS = [
    { label: 'Бірыңғай (112)', number: '112', icon: 'call', color: Colors.alert.critical },
    { label: 'Полиция (102)', number: '102', icon: 'shield', color: Colors.alert.high },
    { label: 'Жедел жәрдем (103)', number: '103', icon: 'medical', color: Colors.alert.info },
];

export default function IncidentDetailScreen() {
    const navigation = useNavigation<NavProp>();
    const route = useNavRoute();
    const { incident } = (route.params as { incident: RootStackParamList['IncidentDetail']['incident'] });

    const meta = getIncidentMeta(incident.incident_type);
    const sevCfg = SEVERITY_LABELS[incident.severity] ?? SEVERITY_LABELS[3];
    const photoUri = incident.photo_uri || incident.photo_url;

    // Фича 5: Share
    const handleShare = async () => {
        const coordStr = `${incident.latitude.toFixed(4)}°N, ${incident.longitude.toFixed(4)}°E`;
        const shareText =
            `⚠️ SafeRoute / Sapa Jol\n` +
            `${meta.label} — A-17 трассасы\n` +
            `📍 ${coordStr}\n` +
            `⚡ Қауіп деңгейі: ${sevCfg.label}\n` +
            `${incident.description ? `💬 ${incident.description}\n` : ''}` +
            `\n🛡️ Sapa Jol қолданбасын жүктеп алыңыз — жол қауіпсіздігі үшін`;

        try {
            await Share.share({ message: shareText, title: 'SafeRoute инцидент' });
        } catch (e) {
            Alert.alert('Қате', 'Бөлісу мүмкін болмады');
        }
    };

    return (
        <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
            {/* Navigation */}
            <View style={styles.navBar}>
                <TouchableOpacity
                    style={styles.backBtn}
                    onPress={() => navigation.canGoBack() ? navigation.goBack() : null}
                >
                    <Ionicons name="arrow-back" size={20} color={Colors.text.primary} />
                </TouchableOpacity>
                <Text style={styles.navTitle}>Инцидент</Text>
                {/* Фича 5: Кнопка Share */}
                <TouchableOpacity style={styles.shareBtn} onPress={handleShare}>
                    <Ionicons name="share-social-outline" size={20} color={Colors.brand.primary} />
                </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
                {/* Фича 1: Полноразмерное фото */}
                {photoUri && (
                    <TouchableOpacity activeOpacity={0.9}>
                        {/* 🎨 ANIMATION_SLOT: photo_expand — Reanimated zoom при тапе */}
                        <Image source={{ uri: photoUri }} style={styles.photo} resizeMode="cover" />
                        <View style={styles.photoBadge}>
                            <Ionicons name="camera" size={12} color={Colors.white} />
                            <Text style={styles.photoBadgeText}>Фото (пайдаланушы)</Text>
                        </View>
                    </TouchableOpacity>
                )}

                {/* Hero */}
                <View style={styles.hero}>
                    <View style={[styles.heroIcon, { backgroundColor: meta.color + '20', borderColor: meta.color + '40' }]}>
                        <Ionicons name={meta.icon as any} size={40} color={meta.color} />
                    </View>
                    <View style={styles.heroInfo}>
                        <Text style={styles.heroType}>{meta.label}</Text>
                        <View style={[styles.severityBadge, { backgroundColor: sevCfg.color + '20' }]}>
                            <View style={[styles.severityDot, { backgroundColor: sevCfg.color }]} />
                            <Text style={[styles.severityText, { color: sevCfg.color }]}>
                                {sevCfg.label}
                            </Text>
                        </View>
                        <Text style={styles.heroDate}>
                            {new Date(incident.created_at).toLocaleString('kk-KZ', {
                                day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit',
                            })}
                        </Text>
                    </View>
                </View>

                {/* Описание */}
                {incident.description && (
                    <View style={styles.section}>
                        <Text style={styles.sectionLabel}>СИПАТТАМА</Text>
                        <Text style={styles.descText}>{incident.description}</Text>
                    </View>
                )}

                {/* Координаты */}
                <View style={styles.section}>
                    <Text style={styles.sectionLabel}>ОРНАЛАСУ</Text>
                    <TouchableOpacity
                        style={styles.coordRow}
                        onPress={() =>
                            Linking.openURL(
                                `https://maps.google.com/?q=${incident.latitude},${incident.longitude}`,
                            )
                        }
                    >
                        <Ionicons name="location" size={16} color={Colors.brand.primary} />
                        <Text style={styles.coordText}>
                            {incident.latitude.toFixed(5)}, {incident.longitude.toFixed(5)}
                        </Text>
                        <Ionicons name="open-outline" size={14} color={Colors.text.muted} />
                    </TouchableOpacity>
                </View>

                {/* AI анализ */}
                <View style={styles.section}>
                    <Text style={styles.sectionLabel}>AI ТЕКСЕРУ</Text>
                    <View style={styles.aiBanner}>
                        <View style={styles.aiBannerRow}>
                            <Ionicons
                                name={incident.ai_verified ? 'checkmark-circle' : 'time'}
                                size={18}
                                color={incident.ai_verified ? Colors.brand.primary : Colors.text.muted}
                            />
                            <Text style={[styles.aiBannerStatus, { color: incident.ai_verified ? Colors.brand.primary : Colors.text.muted }]}>
                                {incident.ai_verified ? 'Расталды' : 'Тексеруде...'}
                            </Text>
                            {incident.ai_confidence !== undefined && (
                                <Text style={styles.aiConfidence}>
                                    {Math.round(incident.ai_confidence * 100)}%
                                </Text>
                            )}
                        </View>
                        {/* 🎨 ANIMATION_SLOT: ai_confidence_bar — анимированный прогресс */}
                        {incident.ai_confidence !== undefined && (
                            <View style={styles.aiBar}>
                                <View style={[styles.aiBarFill, { width: `${incident.ai_confidence * 100}%` as any }]} />
                            </View>
                        )}
                        {incident.ai_analysis && (
                            <Text style={styles.aiAnalysisText}>{incident.ai_analysis}</Text>
                        )}
                        {!incident.ai_verified && !incident.ai_analysis && (
                            <Text style={styles.aiAnalysisText}>
                                AI сараптамасы кезегінде. Қауымдастық растауы болғаннан кейін жарияланады.
                            </Text>
                        )}
                    </View>
                </View>

                {/* Статистика */}
                <View style={styles.statsRow}>
                    <View style={styles.statCard}>
                        <Ionicons name="people" size={20} color={Colors.brand.primary} />
                        <Text style={styles.statValue}>{incident.confirmations_count}</Text>
                        <Text style={styles.statLabel}>Растама</Text>
                    </View>
                    <View style={styles.statCard}>
                        <Ionicons name="time" size={20} color={Colors.alert.high} />
                        <Text style={styles.statValue}>
                            {Math.round((Date.now() - new Date(incident.created_at).getTime()) / 60000)} мин
                        </Text>
                        <Text style={styles.statLabel}>Бұрын</Text>
                    </View>
                    <View style={styles.statCard}>
                        <Ionicons name="shield" size={20} color={incident.is_active ? Colors.alert.critical : Colors.brand.primary} />
                        <Text style={styles.statValue}>{incident.is_active ? 'Белсенді' : 'Шешілді'}</Text>
                        <Text style={styles.statLabel}>Күй</Text>
                    </View>
                </View>

                {/* Кнопки Share + Map */}
                <View style={styles.actionRow}>
                    <TouchableOpacity style={styles.actionBtn} onPress={handleShare}>
                        <Ionicons name="share-social" size={18} color={Colors.brand.primary} />
                        <Text style={styles.actionBtnText}>Бөлісу</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.actionBtn}
                        onPress={() => Linking.openURL(`https://maps.google.com/?q=${incident.latitude},${incident.longitude}`)}
                    >
                        <Ionicons name="map" size={18} color={Colors.brand.primary} />
                        <Text style={styles.actionBtnText}>Картада</Text>
                    </TouchableOpacity>
                </View>

                {/* Экстренные контакты */}
                <View style={styles.section}>
                    <Text style={styles.sectionLabel}>ЖЕДЕЛ БАЙЛАНЫС</Text>
                    <View style={styles.emergencyList}>
                        {EMERGENCY_CONTACTS.map((c) => (
                            <TouchableOpacity
                                key={c.number}
                                style={[styles.emergencyBtn, { borderColor: c.color + '40' }]}
                                onPress={() => Linking.openURL(`tel:${c.number}`)}
                            >
                                <View style={[styles.emergencyIcon, { backgroundColor: c.color + '20' }]}>
                                    <Ionicons name={c.icon as any} size={18} color={c.color} />
                                </View>
                                <View>
                                    <Text style={styles.emergencyLabel}>{c.label}</Text>
                                    <Text style={[styles.emergencyNumber, { color: c.color }]}>{c.number}</Text>
                                </View>
                                <Ionicons name="call-outline" size={16} color={c.color} style={{ marginLeft: 'auto' }} />
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                <View style={{ height: 40 }} />
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.bg.primary },
    navBar: {
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: Spacing.md, paddingVertical: 12,
        borderBottomWidth: 1, borderBottomColor: Colors.border,
    },
    backBtn: {
        width: 36, height: 36, borderRadius: Radius.full,
        alignItems: 'center', justifyContent: 'center',
        backgroundColor: Colors.bg.secondary, marginRight: Spacing.sm,
        borderWidth: 1, borderColor: Colors.border,
    },
    shareBtn: {
        width: 36, height: 36, borderRadius: Radius.full,
        alignItems: 'center', justifyContent: 'center',
        backgroundColor: Colors.brand.glow, marginLeft: 'auto',
    },
    navTitle: { fontSize: 17, fontWeight: '700', color: Colors.text.primary, flex: 1 },
    scroll: { padding: Spacing.md },

    // Фича 1: Фото
    photo: {
        width: '100%', height: 220,
        borderRadius: Radius.lg, marginBottom: 4,
    },
    photoBadge: {
        flexDirection: 'row', alignItems: 'center', gap: 4,
        backgroundColor: 'rgba(0,0,0,0.5)',
        paddingHorizontal: 10, paddingVertical: 4,
        borderRadius: Radius.full, alignSelf: 'flex-start', marginBottom: Spacing.md,
    },
    photoBadgeText: { fontSize: 11, color: Colors.white, fontWeight: '600' },

    hero: {
        flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
        backgroundColor: Colors.bg.secondary,
        borderRadius: Radius.lg, padding: Spacing.md,
        marginBottom: Spacing.md, borderWidth: 1, borderColor: Colors.border,
        ...Shadow.card,
    },
    heroIcon: {
        width: 72, height: 72, borderRadius: Radius.lg,
        alignItems: 'center', justifyContent: 'center', borderWidth: 1,
    },
    heroInfo: { flex: 1 },
    heroType: { fontSize: 20, fontWeight: '800', color: Colors.text.primary },
    heroDate: { fontSize: 12, color: Colors.text.muted, marginTop: 4 },
    severityBadge: {
        flexDirection: 'row', alignItems: 'center', gap: 5,
        paddingHorizontal: 10, paddingVertical: 4, borderRadius: Radius.full,
        alignSelf: 'flex-start', marginTop: 6,
    },
    severityDot: { width: 6, height: 6, borderRadius: 3 },
    severityText: { fontSize: 12, fontWeight: '700' },

    section: { marginBottom: Spacing.md },
    sectionLabel: {
        fontSize: 10, fontWeight: '800', color: Colors.text.muted,
        letterSpacing: 1.2, marginBottom: 8, textTransform: 'uppercase',
    },
    descText: {
        fontSize: 15, color: Colors.text.secondary, lineHeight: 22,
        backgroundColor: Colors.bg.secondary, borderRadius: Radius.md,
        padding: Spacing.md, borderWidth: 1, borderColor: Colors.border,
    },

    coordRow: {
        flexDirection: 'row', alignItems: 'center', gap: 8,
        backgroundColor: Colors.bg.secondary, borderRadius: Radius.md,
        padding: Spacing.md, borderWidth: 1, borderColor: Colors.border,
    },
    coordText: { flex: 1, fontSize: 14, color: Colors.text.secondary, fontFamily: 'monospace' },

    aiBanner: {
        backgroundColor: Colors.bg.secondary, borderRadius: Radius.lg,
        padding: Spacing.md, borderWidth: 1, borderColor: Colors.border, gap: 8,
    },
    aiBannerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    aiBannerStatus: { flex: 1, fontSize: 14, fontWeight: '600' },
    aiConfidence: { fontSize: 13, color: Colors.text.muted, fontWeight: '700' },
    aiBar: {
        height: 4, backgroundColor: Colors.border, borderRadius: 2, overflow: 'hidden',
    },
    aiBarFill: {
        height: '100%', backgroundColor: Colors.brand.primary, borderRadius: 2,
    },
    aiAnalysisText: { fontSize: 13, color: Colors.text.muted, lineHeight: 18 },

    statsRow: {
        flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.md,
    },
    statCard: {
        flex: 1, alignItems: 'center', gap: 4,
        backgroundColor: Colors.bg.secondary, borderRadius: Radius.lg,
        padding: Spacing.md, borderWidth: 1, borderColor: Colors.border,
    },
    statValue: { fontSize: 14, fontWeight: '800', color: Colors.text.primary },
    statLabel: { fontSize: 10, color: Colors.text.muted, textTransform: 'uppercase' },

    // Фича 5: Action buttons (Share + Map)
    actionRow: {
        flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.md,
    },
    actionBtn: {
        flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
        backgroundColor: Colors.brand.glow, borderRadius: Radius.lg,
        paddingVertical: 14, borderWidth: 1, borderColor: Colors.brand.primary + '40',
    },
    actionBtnText: { fontSize: 14, fontWeight: '700', color: Colors.brand.primary },

    emergencyList: { gap: Spacing.sm },
    emergencyBtn: {
        flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
        backgroundColor: Colors.bg.secondary, borderRadius: Radius.lg,
        padding: Spacing.md, borderWidth: 1,
    },
    emergencyIcon: {
        width: 40, height: 40, borderRadius: Radius.md,
        alignItems: 'center', justifyContent: 'center',
    },
    emergencyLabel: { fontSize: 13, color: Colors.text.secondary, fontWeight: '600' },
    emergencyNumber: { fontSize: 18, fontWeight: '800' },
});
