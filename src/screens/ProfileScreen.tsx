/**
 * ProfileScreen — SafeRoute / Sapa Jol
 *
 * Дизайн вдохновлён Nothing Phone: dot-matrix числа, геометрия, монохром + зелёный акцент.
 * Структура (как в референсе): Header → Active Route card → Stats grid → Livestock → Settings
 *
 * 🎨 ANIMATION_SLOT: avatar_glow — пульсирующий ring вокруг аватара (Reanimated)
 * 🎨 ANIMATION_SLOT: stats_count_up — числа считаются вверх при появлении (Reanimated)
 * 🎨 ANIMATION_SLOT: role_badge_transition — смена роли с цветовым переходом
 * 🎨 ANIMATION_SLOT: grid_card_press — тактильный scale при нажатии на карточку
 */
import React, { useState } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    TextInput, Modal, Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useAppDialog } from '../components/AppDialog';
import { Colors, Spacing, Radius, Shadow } from '../constants/colors';
import { useUserProfile } from '../hooks/useUserProfile';
import { useSettings } from '../hooks/useSettings';
import { ROUTES, LIVESTOCK_META, UserRole } from '../constants/livestock';
import { useIncidents } from '../hooks/useIncidents';
import { Config } from '../config';
import { getDeviceId } from '../services/deviceId';
import { AppResetEvent } from '../services/appReset';
import { deleteUserData } from '../services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE } from '../constants/storage';
import { useT } from '../i18n';
import { useNotificationLog } from '../hooks/useNotificationLog';

const ROLE_ICON: Record<UserRole, { icon: string; color: string }> = {
    driver: { icon: 'car', color: Colors.brand.primary },
    livestock_owner: { icon: 'paw', color: Colors.alert.high },
};



/** Nothing Phone стиль: числа в monospace, геометрические карточки */
function StatCard({
    value, label, icon, color, onPress,
}: {
    value: string | number; label: string; icon: string; color?: string; onPress?: () => void;
}) {
    return (
        <TouchableOpacity
            style={styles.statCard}
            onPress={onPress}
            activeOpacity={onPress ? 0.7 : 1}
        >
            <View style={[styles.statIcon, { backgroundColor: (color ?? Colors.brand.primary) + '18' }]}>
                <Ionicons name={icon as any} size={16} color={color ?? Colors.brand.primary} />
            </View>
            {/* 🎨 ANIMATION_SLOT: stats_count_up */}
            <Text style={[styles.statValue, { color: color ?? Colors.brand.primary }]}>
                {value}
            </Text>
            <Text style={styles.statLabel}>{label}</Text>
        </TouchableOpacity>
    );
}

function SectionHeader({ title }: { title: string }) {
    return (
        <View style={styles.sectionHeaderWrap}>
            <View style={styles.sectionDot} />
            <Text style={styles.sectionHeader}>{title}</Text>
            <View style={styles.sectionLine} />
        </View>
    );
}

export default function ProfileScreen() {
    const t = useT();
    const { showDialog, DialogComponent } = useAppDialog();
    const { profile, loaded, updateProfile } = useUserProfile();
    const { settings, update: updateSettings } = useSettings();
    const { incidents, isOnline } = useIncidents('active');
    const { log: notifLog, markAllRead, clearLog: clearNotifLog, unreadCount } = useNotificationLog();
    const [editModal, setEditModal] = useState(false);
    const [notifModal, setNotifModal] = useState(false);
    const [editName, setEditName] = useState('');
    const [editPhone, setEditPhone] = useState('');
    const [activeRouteId, setActiveRouteId] = useState<string>('a17');
    const [deviceId, setDeviceId] = useState('Жүктелуде...');
    const [showDeviceId, setShowDeviceId] = useState(false);

    // Загружаем сохранённый маршрут
    React.useEffect(() => {
        AsyncStorage.getItem(STORAGE.ACTIVE_ROUTE).then(id => {
            if (id) setActiveRouteId(id);
        });
    }, []);

    const activeRoute = ROUTES.find(r => r.id === activeRouteId) ?? ROUTES[0];
    const activeIncidents = incidents.filter(i => i.is_active).length;

    const openEdit = () => {
        setEditName(profile.name);
        setEditPhone(profile.phone);
        setEditModal(true);
    };

    const saveEdit = async () => {
        if (!editName.trim()) return;
        await updateProfile({ name: editName.trim(), phone: editPhone.trim() });
        setEditModal(false);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    };

    const handleLogout = () => {
        showDialog({
            title: t('profile_logout_title'),
            message: t('profile_logout_confirm'),
            icon: 'log-out',
            iconColor: Colors.alert.critical,
            buttons: [
                {
                    text: t('yes'),
                    style: 'destructive',
                    onPress: async () => {
                        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                        await AppResetEvent.trigger();
                    },
                },
                { text: t('no_exit'), style: 'cancel' },
            ],
        });
    };

    const handleShowDeviceId = async () => {
        const id = await getDeviceId();
        setDeviceId(id);
        setShowDeviceId(v => !v);
    };

    if (!loaded) return null;

    const roleIcon = ROLE_ICON[profile.role];
    const roleLabel = profile.role === 'driver' ? t('role_driver') : t('role_owner');
    const roleDesc = profile.role === 'driver' ? t('role_driver_desc') : t('role_owner_desc');

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

                {/* ── HEADER: Avatar + Name + Bell ─────────────────── */}
                <View style={styles.header}>
                    <TouchableOpacity style={styles.avatarWrap} onPress={openEdit}>
                        {/* 🎨 ANIMATION_SLOT: avatar_glow */}
                        <View style={styles.avatar}>
                            <Text style={styles.avatarText}>{profile.avatarInitials || 'ПА'}</Text>
                        </View>
                        <View style={styles.avatarEditBadge}>
                            <Ionicons name="pencil" size={10} color={Colors.bg.primary} />
                        </View>
                    </TouchableOpacity>

                    <View style={styles.headerMid}>
                        <Text style={styles.greeting}>{t('profile_greeting')}</Text>
                        <Text style={styles.userName} numberOfLines={1}>{profile.name}</Text>
                        {profile.phone ? (
                            <Text style={styles.userPhone}>{profile.phone}</Text>
                        ) : (
                            <TouchableOpacity onPress={openEdit}>
                                <Text style={styles.addPhone}>{t('profile_add_phone')}</Text>
                            </TouchableOpacity>
                        )}
                    </View>

                    <View style={styles.headerRight}>
                        <View style={[styles.onlineDot, { backgroundColor: isOnline ? Colors.brand.primary : Colors.alert.medium }]} />
                        <TouchableOpacity onPress={() => setNotifModal(true)}>
                            <Ionicons name="notifications-outline" size={22} color={Colors.text.secondary} />
                            {unreadCount > 0 && (
                                <View style={styles.bellBadge}>
                                    <Text style={styles.bellBadgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
                                </View>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>

                {/* ── ROLE BADGE (Nothing-style pill) — только отображение ── */}
                <View style={[styles.roleBadge, { borderColor: roleIcon.color + '40' }]}>
                    <View style={[styles.roleIconBox, { backgroundColor: roleIcon.color + '18' }]}>
                        <Ionicons name={roleIcon.icon as any} size={14} color={roleIcon.color} />
                    </View>
                    <View>
                        <Text style={[styles.roleLabel, { color: roleIcon.color }]}>{roleLabel}</Text>
                        <Text style={styles.roleDesc}>{roleDesc}</Text>
                    </View>
                    <View style={[styles.roleLockIcon, { marginLeft: 'auto' }]}>
                        <Ionicons name="lock-closed" size={12} color={Colors.text.muted} />
                    </View>
                </View>

                {/* ── ACTIVE ROUTE CARD (like "Current Order" in ref) ── */}
                <View style={styles.routeCard}>
                    <View style={styles.routeCardTop}>
                        <View>
                            <Text style={styles.routeCardLabel}>{t('profile_active_route')}</Text>
                            <Text style={styles.routeCardName}>{activeRoute.name}</Text>
                        </View>
                        <View style={[styles.routeChip, { backgroundColor: Colors.brand.primary + '20' }]}>
                            <Text style={styles.routeChipText}>{activeRoute.shortCode}</Text>
                        </View>
                    </View>

                    {/* Progress dots (Nothing-style) */}
                    <View style={styles.routeProgress}>
                        {[0, 1, 2, 3, 4].map(i => (
                            <View
                                key={i}
                                style={[
                                    styles.progressDot,
                                    i < 2 && { backgroundColor: Colors.brand.primary },
                                    i === 2 && { backgroundColor: Colors.brand.primary, transform: [{ scale: 1.5 }] },
                                ]}
                            />
                        ))}
                        <View style={styles.progressLine} />
                    </View>

                    <View style={styles.routeFromTo}>
                        <View>
                            <Text style={styles.routePointLabel}>{t('route_start')}</Text>
                            <Text style={styles.routePoint}>{activeRoute.from}</Text>
                        </View>
                        <View style={styles.routeLengthBadge}>
                            <Text style={styles.routeLength}>{activeRoute.lengthKm} км</Text>
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                            <Text style={styles.routePointLabel}>{t('route_end')}</Text>
                            <Text style={styles.routePoint}>{activeRoute.to}</Text>
                        </View>
                    </View>
                </View>

                {/* ── STATS GRID 2×2 (Nothing-style cards) ─────────── */}
                <View style={styles.grid}>
                    <StatCard
                        value={activeIncidents}
                        label={t('stat_active')}
                        icon="warning"
                        color={activeIncidents > 3 ? Colors.alert.critical : Colors.alert.high}
                    />
                    <StatCard
                        value={profile.totalReports}
                        label={t('stat_reports')}
                        icon="shield-checkmark"
                        color={Colors.brand.primary}
                    />
                    <StatCard
                        value={ROUTES.length}
                        label={t('stat_routes')}
                        icon="map"
                        color={Colors.alert.info}
                    />
                    <StatCard
                        value="A-17"
                        label={t('stat_main_road')}
                        icon="navigate"
                        color={Colors.brand.secondary}
                    />
                </View>

                {/* ── МАРШРУТТАР ───────────────────────────────────── */}
                <SectionHeader title={t('profile_routes_section')} />
                <View style={styles.card}>
                    {ROUTES.map((route, idx) => (
                        <React.Fragment key={route.id}>
                            <TouchableOpacity
                                style={styles.routeRow}
                                onPress={async () => {
                                    setActiveRouteId(route.id);
                                    Haptics.selectionAsync();
                                    await AsyncStorage.setItem(STORAGE.ACTIVE_ROUTE, route.id);
                                }}
                            >
                                <View style={[
                                    styles.routeRowDot,
                                    activeRouteId === route.id && { backgroundColor: Colors.brand.primary },
                                ]} />
                                <View style={styles.routeRowBody}>
                                    <Text style={styles.routeRowCode}>{route.shortCode}</Text>
                                    <Text style={styles.routeRowName}>{route.from} → {route.to}</Text>
                                </View>
                                <Text style={styles.routeRowKm}>{route.lengthKm} км</Text>
                                {activeRouteId === route.id && (
                                    <Ionicons name="checkmark-circle" size={18} color={Colors.brand.primary} />
                                )}
                            </TouchableOpacity>
                            {idx < ROUTES.length - 1 && <View style={styles.rowDivider} />}
                        </React.Fragment>
                    ))}
                </View>

                {/* ── МАЛ ИЕСІ СЕКЦИЯ ──────────────────────────────── */}
                {(profile.role === 'livestock_owner') && (
                    <>
                        <SectionHeader title={t('livestock_section')} />
                        <View style={styles.card}>
                            <TouchableOpacity
                                style={styles.settingsRow}
                                onPress={() => showDialog({
                                    title: t('livestock_register'),
                                    message: t('livestock_tracker_info'),
                                    icon: 'paw',
                                    iconColor: Colors.alert.high,
                                    buttons: [{ text: t('understand'), style: 'default' }]
                                })}
                            >
                                <View style={[styles.rowIcon, { backgroundColor: Colors.alert.high + '18' }]}>
                                    <Ionicons name="paw" size={18} color={Colors.alert.high} />
                                </View>
                                <View style={styles.rowBody}>
                                    <Text style={styles.rowLabel}>{t('livestock_register')}</Text>
                                    <Text style={styles.rowValue}>{t('livestock_register_desc')}</Text>
                                </View>
                                <Ionicons name="chevron-forward" size={18} color={Colors.text.muted} />
                            </TouchableOpacity>
                            <View style={styles.rowDivider} />
                            <View style={styles.trackerInfoBox}>
                                <Ionicons name="radio" size={14} color={Colors.alert.info} />
                                <Text style={styles.trackerInfoText}>{t('livestock_tracker_info')}</Text>
                            </View>
                        </View>
                    </>
                )}

                {/* ── ХАБАРЛАНДЫРУЛАР ───────────────────────────────── */}
                <SectionHeader title={t('profile_notifications_section')} />
                <View style={styles.card}>
                    <View style={styles.settingsRow}>
                        <View style={[styles.rowIcon, { backgroundColor: Colors.brand.primary + '18' }]}>
                            <Ionicons name="volume-high" size={18} color={Colors.brand.primary} />
                        </View>
                        <View style={styles.rowBody}>
                            <Text style={styles.rowLabel}>{t('profile_sound')}</Text>
                        </View>
                        <Switch
                            value={settings.soundEnabled}
                            onValueChange={v => updateSettings({ soundEnabled: v })}
                            trackColor={{ false: Colors.bg.tertiary, true: Colors.brand.primary }}
                            thumbColor={Colors.white}
                        />
                    </View>
                    <View style={styles.rowDivider} />
                    <View style={styles.settingsRow}>
                        <View style={[styles.rowIcon, { backgroundColor: Colors.alert.info + '18' }]}>
                            <Ionicons name="phone-portrait" size={18} color={Colors.alert.info} />
                        </View>
                        <View style={styles.rowBody}>
                            <Text style={styles.rowLabel}>{t('profile_vibration')}</Text>
                        </View>
                        <Switch
                            value={settings.vibrationEnabled}
                            onValueChange={v => updateSettings({ vibrationEnabled: v })}
                            trackColor={{ false: Colors.bg.tertiary, true: Colors.brand.primary }}
                            thumbColor={Colors.white}
                        />
                    </View>
                    <View style={styles.rowDivider} />
                    <View style={styles.settingsRow}>
                        <View style={[styles.rowIcon, { backgroundColor: Colors.brand.primary + '18' }]}>
                            <Ionicons name="language" size={18} color={Colors.brand.primary} />
                        </View>
                        <View style={styles.rowBody}>
                            <Text style={styles.rowLabel}>{settings.language === 'kk' ? 'Қазақша' : 'Русский'}</Text>
                        </View>
                        <TouchableOpacity
                            style={styles.langToggle}
                            onPress={() => { Haptics.selectionAsync(); updateSettings({ language: settings.language === 'kk' ? 'ru' : 'kk' }); }}
                        >
                            <Text style={styles.langToggleText}>{settings.language === 'kk' ? 'RU' : 'ҚАЗ'}</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* ── ҚОСЫМША ТУРАЛЫ ───────────────────────────────── */}
                <SectionHeader title={t('profile_about_section')} />
                <View style={styles.card}>
                    <View style={styles.settingsRow}>
                        <View style={[styles.rowIcon, { backgroundColor: Colors.brand.primary + '18' }]}>
                            <Ionicons name="shield-checkmark" size={18} color={Colors.brand.primary} />
                        </View>
                        <View style={styles.rowBody}>
                            <Text style={styles.rowLabel}>SafeRoute · Sapa Jol</Text>
                            <Text style={styles.rowValue}>Нұсқа {Config.VERSION} · Жол қауіпсіздігі</Text>
                        </View>
                    </View>
                    <View style={styles.rowDivider} />
                    <TouchableOpacity style={styles.settingsRow} onPress={handleShowDeviceId}>
                        <View style={[styles.rowIcon, { backgroundColor: Colors.text.muted + '18' }]}>
                            <Ionicons name="hardware-chip-outline" size={18} color={Colors.text.muted} />
                        </View>
                        <View style={styles.rowBody}>
                            <Text style={styles.rowLabel}>Device ID</Text>
                            <Text style={styles.rowValue} numberOfLines={1}>
                                {showDeviceId ? deviceId : '· · · · · · · · · · ·'}
                            </Text>
                        </View>
                    </TouchableOpacity>
                    <View style={styles.rowDivider} />
                    <TouchableOpacity style={styles.settingsRow} onPress={() => {
                        showDialog({
                            title: 'Деректерді жою',
                            message: 'Барлық деректеріңіз (хабарламалар, инциденттер, құрылғы) біржола жойылады. Жалғастырасыз ба?',
                            icon: 'trash',
                            iconColor: Colors.alert.critical,
                            buttons: [
                                {
                                    text: 'Жою',
                                    style: 'destructive',
                                    onPress: async () => {
                                        try {
                                            const id = await getDeviceId();
                                            await deleteUserData(id);
                                            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                                            await AppResetEvent.trigger();
                                        } catch {
                                            showDialog({
                                                title: 'Қате',
                                                message: 'Деректерді жою мүмкін болмады',
                                                icon: 'close-circle',
                                                iconColor: Colors.alert.critical,
                                                buttons: [{ text: 'Жабу', style: 'cancel' }],
                                            });
                                        }
                                    },
                                },
                                { text: 'Бас тарту', style: 'cancel' },
                            ],
                        });
                    }}>
                        <View style={[styles.rowIcon, { backgroundColor: Colors.alert.critical + '18' }]}>
                            <Ionicons name="trash-outline" size={18} color={Colors.alert.critical} />
                        </View>
                        <View style={styles.rowBody}>
                            <Text style={[styles.rowLabel, { color: Colors.alert.critical }]}>Деректерімді жою</Text>
                            <Text style={styles.rowValue}>GDPR — барлық деректер жойылады</Text>
                        </View>
                    </TouchableOpacity>
                    <View style={styles.rowDivider} />
                    <TouchableOpacity style={styles.settingsRow} onPress={handleLogout}>
                        <View style={[styles.rowIcon, { backgroundColor: Colors.alert.critical + '18' }]}>
                            <Ionicons name="log-out-outline" size={18} color={Colors.alert.critical} />
                        </View>
                        <View style={styles.rowBody}>
                            <Text style={[styles.rowLabel, { color: Colors.alert.critical }]}>{t('profile_logout')}</Text>
                            <Text style={styles.rowValue}>{t('profile_logout_desc')}</Text>
                        </View>
                    </TouchableOpacity>
                </View>

                {/* ── DOT PATTERN MISSION CARD ─────────────────────── */}
                <View style={styles.missionCard}>
                    {/* Dot grid декор в Nothing-стиле */}
                    <View style={styles.dotGrid} pointerEvents="none">
                        {Array.from({ length: 20 }).map((_, i) => (
                            <View key={i} style={styles.decorDot} />
                        ))}
                    </View>
                    <Ionicons name="leaf" size={22} color={Colors.brand.primary} />
                    <Text style={styles.missionTitle}>Sapa Jol</Text>
                    <Text style={styles.missionText}>{t('mission_text')}</Text>
                    <View style={styles.missionStats}>
                        <View style={styles.missionStat}>
                            <Text style={styles.missionStatValue}>{activeIncidents}</Text>
                            <Text style={styles.missionStatLabel}>{t('incidents_stat')}</Text>
                        </View>
                        <View style={styles.missionDivider} />
                        <View style={styles.missionStat}>
                            <Text style={styles.missionStatValue}>{ROUTES.length}</Text>
                            <Text style={styles.missionStatLabel}>{t('routes_stat')}</Text>
                        </View>
                        <View style={styles.missionDivider} />
                        <View style={styles.missionStat}>
                            <Text style={styles.missionStatValue}>A-17</Text>
                            <Text style={styles.missionStatLabel}>{t('main_road')}</Text>
                        </View>
                    </View>
                </View>

                <View style={{ height: 40 }} />
            </ScrollView>

            {/* ── NOTIFICATION HISTORY MODAL ────────────────────── */}
            <Modal visible={notifModal} transparent animationType="slide">
                <View style={styles.modalOverlay}>
                    <View style={styles.notifModalCard}>
                        <View style={styles.notifModalHeader}>
                            <Text style={styles.notifModalTitle}>{t('notif_history')}</Text>
                            {notifLog.length > 0 && (
                                <TouchableOpacity onPress={() => { markAllRead(); Haptics.selectionAsync(); }}>
                                    <Text style={styles.logActionText}>{t('notif_mark_read')}</Text>
                                </TouchableOpacity>
                            )}
                        </View>

                        {notifLog.length === 0 ? (
                            <View style={styles.notifEmpty}>
                                <Ionicons name="notifications-off-outline" size={40} color={Colors.text.muted} />
                                <Text style={styles.notifEmptyText}>{t('notif_empty')}</Text>
                            </View>
                        ) : (
                            <ScrollView style={styles.notifModalScroll} showsVerticalScrollIndicator={false}>
                                {notifLog.slice(0, 30).map((entry, idx) => (
                                    <View key={entry.id}>
                                        {idx > 0 && <View style={styles.rowDivider} />}
                                        <View style={[styles.notifRow, !entry.read && styles.notifRowUnread]}>
                                            <View style={[styles.notifDot, !entry.read && styles.notifDotActive]} />
                                            <View style={{ flex: 1 }}>
                                                <Text style={styles.notifTitle}>{entry.title}</Text>
                                                <Text style={styles.notifBody} numberOfLines={2}>{entry.body}</Text>
                                            </View>
                                            <Text style={styles.notifTime}>
                                                {new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </Text>
                                        </View>
                                    </View>
                                ))}
                            </ScrollView>
                        )}

                        <TouchableOpacity
                            style={styles.notifCloseBtn}
                            onPress={() => setNotifModal(false)}
                        >
                            <Text style={styles.notifCloseBtnText}>{t('notif_close')}</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* ── EDIT PROFILE MODAL ────────────────────────────── */}
            <Modal visible={editModal} transparent animationType="slide">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalCard}>
                        <Text style={styles.modalTitle}>{t('profile_edit_title')}</Text>

                        <Text style={styles.inputLabel}>{t('profile_name_label')}</Text>
                        <TextInput
                            style={styles.input}
                            value={editName}
                            onChangeText={setEditName}
                            placeholder="Аты-жөніңіз..."
                            placeholderTextColor={Colors.text.muted}
                            maxLength={40}
                        />

                        <Text style={styles.inputLabel}>{t('profile_phone_label')}</Text>
                        <TextInput
                            style={styles.input}
                            value={editPhone}
                            onChangeText={setEditPhone}
                            placeholder="+7 700 000 0000"
                            placeholderTextColor={Colors.text.muted}
                            keyboardType="phone-pad"
                            maxLength={17}
                        />

                        <View style={styles.modalButtons}>
                            <TouchableOpacity
                                style={[styles.modalBtn, styles.modalBtnCancel]}
                                onPress={() => setEditModal(false)}
                            >
                                <Text style={styles.modalBtnCancelText}>{t('cancel')}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.modalBtn, styles.modalBtnSave]}
                                onPress={saveEdit}
                            >
                                <Text style={styles.modalBtnSaveText}>{t('save')}</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
            {DialogComponent}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.bg.primary },
    scroll: { paddingHorizontal: Spacing.md, paddingTop: Spacing.md },

    // Header
    header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginBottom: Spacing.md },
    avatarWrap: { position: 'relative' },
    avatar: {
        width: 56, height: 56, borderRadius: 28,
        backgroundColor: Colors.brand.primary + '25',
        alignItems: 'center', justifyContent: 'center',
        borderWidth: 2, borderColor: Colors.brand.primary + '40',
    },
    avatarText: { fontSize: 20, fontWeight: '800', color: Colors.brand.primary, fontFamily: 'monospace' },
    avatarEditBadge: {
        position: 'absolute', bottom: 0, right: 0,
        width: 18, height: 18, borderRadius: 9,
        backgroundColor: Colors.brand.primary,
        alignItems: 'center', justifyContent: 'center',
        borderWidth: 2, borderColor: Colors.bg.primary,
    },
    headerMid: { flex: 1 },
    greeting: { fontSize: 12, color: Colors.text.muted, fontWeight: '500' },
    userName: { fontSize: 20, fontWeight: '800', color: Colors.text.primary },
    userPhone: { fontSize: 12, color: Colors.text.muted, marginTop: 2 },
    addPhone: { fontSize: 12, color: Colors.brand.primary, marginTop: 2, fontWeight: '600' },
    headerRight: { alignItems: 'center', gap: 8 },
    onlineDot: { width: 8, height: 8, borderRadius: 4 },

    // Role badge
    roleBadge: {
        flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
        backgroundColor: Colors.bg.secondary, borderRadius: Radius.lg,
        padding: Spacing.sm, marginBottom: Spacing.md,
        borderWidth: 1,
    },
    roleIconBox: { width: 32, height: 32, borderRadius: Radius.sm, alignItems: 'center', justifyContent: 'center' },
    roleLabel: { fontSize: 14, fontWeight: '700' },
    roleDesc: { fontSize: 11, color: Colors.text.muted, marginTop: 1 },
    roleLockIcon: { width: 20, height: 20, alignItems: 'center', justifyContent: 'center' },
    langToggle: {
        paddingHorizontal: 12, paddingVertical: 6,
        backgroundColor: Colors.bg.tertiary,
        borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.border,
    },
    langToggleText: { fontSize: 11, fontWeight: '800', color: Colors.text.secondary },

    // Bell badge
    bellBadge: {
        position: 'absolute', top: -4, right: -6,
        minWidth: 16, height: 16, borderRadius: 8,
        backgroundColor: Colors.alert.critical,
        alignItems: 'center', justifyContent: 'center',
        paddingHorizontal: 3, borderWidth: 1.5, borderColor: Colors.bg.primary,
    },
    bellBadgeText: { fontSize: 9, fontWeight: '800', color: Colors.white },

    // Notification modal
    notifModalCard: {
        backgroundColor: Colors.bg.secondary, borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl,
        paddingTop: Spacing.lg, paddingBottom: 40, borderTopWidth: 1, borderTopColor: Colors.border,
        maxHeight: '80%',
    },
    notifModalHeader: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: Spacing.lg, marginBottom: Spacing.md,
    },
    notifModalTitle: { fontSize: 14, fontWeight: '800', color: Colors.text.muted, letterSpacing: 1.2 },
    notifModalScroll: { paddingHorizontal: Spacing.sm },
    notifEmpty: { alignItems: 'center', paddingVertical: 40, gap: 10 },
    notifEmptyText: { fontSize: 14, color: Colors.text.muted },
    notifCloseBtn: {
        marginHorizontal: Spacing.lg, marginTop: Spacing.lg,
        backgroundColor: Colors.brand.primary, borderRadius: Radius.lg,
        paddingVertical: 14, alignItems: 'center',
    },
    notifCloseBtnText: { fontSize: 15, fontWeight: '700', color: Colors.bg.primary },

    // Notification log rows
    logActionText: { fontSize: 11, color: Colors.brand.primary, fontWeight: '600' },
    notifRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: Spacing.sm, gap: 10 },
    notifRowUnread: { backgroundColor: Colors.brand.primary + '06' },
    notifDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: Colors.bg.tertiary },
    notifDotActive: { backgroundColor: Colors.brand.primary },
    notifTitle: { fontSize: 13, fontWeight: '600', color: Colors.text.primary },
    notifBody: { fontSize: 12, color: Colors.text.secondary, marginTop: 1 },
    notifTime: { fontSize: 11, color: Colors.text.muted },

    // Route card (референс: "Current Order")
    routeCard: {
        backgroundColor: Colors.bg.secondary, borderRadius: Radius.xl,
        padding: Spacing.md, marginBottom: Spacing.md,
        borderWidth: 1, borderColor: Colors.border, ...Shadow.card,
    },
    routeCardTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: Spacing.md },
    routeCardLabel: { fontSize: 10, fontWeight: '800', color: Colors.text.muted, letterSpacing: 1.2 },
    routeCardName: { fontSize: 18, fontWeight: '800', color: Colors.text.primary, marginTop: 2 },
    routeChip: {
        paddingHorizontal: 14, paddingVertical: 6, borderRadius: Radius.full,
    },
    routeChipText: { fontSize: 14, fontWeight: '800', color: Colors.brand.primary, fontFamily: 'monospace' },
    routeProgress: {
        flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.md, gap: 0, position: 'relative',
    },
    progressDot: {
        width: 10, height: 10, borderRadius: 5,
        backgroundColor: Colors.border, zIndex: 1, marginHorizontal: '8%',
    },
    progressLine: {
        position: 'absolute', left: 0, right: 0, height: 2,
        backgroundColor: Colors.border, zIndex: 0,
    },
    routeFromTo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    routePointLabel: { fontSize: 10, color: Colors.text.muted, textTransform: 'uppercase', letterSpacing: 0.5 },
    routePoint: { fontSize: 14, fontWeight: '700', color: Colors.text.primary, marginTop: 2 },
    routeLengthBadge: { backgroundColor: Colors.border, paddingHorizontal: 12, paddingVertical: 4, borderRadius: Radius.full },
    routeLength: { fontSize: 11, color: Colors.text.muted, fontFamily: 'monospace' },

    // Stats grid (2×2 ячейки)
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.md },
    statCard: {
        width: '47.5%', backgroundColor: Colors.bg.secondary,
        borderRadius: Radius.lg, padding: Spacing.md,
        borderWidth: 1, borderColor: Colors.border, gap: 6,
    },
    statIcon: { width: 32, height: 32, borderRadius: Radius.sm, alignItems: 'center', justifyContent: 'center' },
    statValue: { fontSize: 22, fontWeight: '800', fontFamily: 'monospace' },
    statLabel: { fontSize: 11, color: Colors.text.muted, fontWeight: '500' },

    // Section headers (Nothing-style: point + line)
    sectionHeaderWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: Spacing.sm, marginTop: Spacing.sm },
    sectionDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.brand.primary },
    sectionHeader: { fontSize: 10, fontWeight: '800', color: Colors.text.muted, letterSpacing: 1.5 },
    sectionLine: { flex: 1, height: 1, backgroundColor: Colors.border },

    // Cards
    card: {
        backgroundColor: Colors.bg.secondary, borderRadius: Radius.lg,
        borderWidth: 1, borderColor: Colors.border, overflow: 'hidden',
        marginBottom: Spacing.md,
    },
    settingsRow: { flexDirection: 'row', alignItems: 'center', padding: Spacing.md, gap: Spacing.md, minHeight: 54 },
    rowIcon: { width: 36, height: 36, borderRadius: Radius.sm, alignItems: 'center', justifyContent: 'center' },
    rowBody: { flex: 1 },
    rowLabel: { fontSize: 15, color: Colors.text.primary, fontWeight: '500' },
    rowValue: { fontSize: 12, color: Colors.text.muted, marginTop: 2 },
    rowDivider: { height: 1, backgroundColor: Colors.border, marginLeft: 64 },

    // Route list
    routeRow: { flexDirection: 'row', alignItems: 'center', padding: Spacing.md, gap: Spacing.sm, minHeight: 54 },
    routeRowDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.border },
    routeRowBody: { flex: 1 },
    routeRowCode: { fontSize: 13, fontWeight: '800', color: Colors.text.primary, fontFamily: 'monospace' },
    routeRowName: { fontSize: 11, color: Colors.text.muted, marginTop: 2 },
    routeRowKm: { fontSize: 12, color: Colors.text.muted, fontFamily: 'monospace' },

    // Radius
    radiusSection: { flexDirection: 'row', alignItems: 'center', padding: Spacing.md, gap: Spacing.md, minHeight: 64 },
    radiusRow: { flexDirection: 'row', gap: 6, marginTop: 6, alignItems: 'center' },
    radiusBtn: {
        width: 32, height: 32, borderRadius: Radius.sm,
        alignItems: 'center', justifyContent: 'center',
        backgroundColor: Colors.bg.tertiary, borderWidth: 1, borderColor: Colors.border,
    },
    radiusBtnActive: { backgroundColor: Colors.brand.primary, borderColor: Colors.brand.primary },
    radiusBtnText: { fontSize: 12, fontWeight: '700', color: Colors.text.muted, fontFamily: 'monospace' },
    radiusBtnTextActive: { color: Colors.bg.primary },
    radiusUnit: { fontSize: 12, color: Colors.text.muted },

    // Livestock info
    trackerInfoBox: {
        flexDirection: 'row', gap: 8, alignItems: 'flex-start',
        padding: Spacing.md, backgroundColor: Colors.alert.info + '10',
        margin: Spacing.sm, borderRadius: Radius.md,
    },
    trackerInfoText: { flex: 1, fontSize: 12, color: Colors.text.muted, lineHeight: 17 },

    // Mission card (dot-grid декор)
    missionCard: {
        backgroundColor: Colors.bg.secondary, borderRadius: Radius.xl,
        padding: Spacing.lg, alignItems: 'center',
        borderWidth: 1, borderColor: Colors.brand.primary + '30',
        overflow: 'hidden', gap: 6,
    },
    dotGrid: {
        position: 'absolute', top: 0, right: 0, bottom: 0,
        flexDirection: 'row', flexWrap: 'wrap', width: 100, opacity: 0.08,
        padding: 8, gap: 6,
    },
    decorDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: Colors.brand.primary },
    missionTitle: { fontSize: 20, fontWeight: '900', color: Colors.brand.primary, fontFamily: 'monospace' },
    missionText: { fontSize: 13, color: Colors.text.muted, textAlign: 'center', lineHeight: 19 },
    missionStats: { flexDirection: 'row', gap: 0, marginTop: Spacing.sm },
    missionStat: { alignItems: 'center', paddingHorizontal: Spacing.lg },
    missionStatValue: { fontSize: 22, fontWeight: '800', color: Colors.brand.primary, fontFamily: 'monospace' },
    missionStatLabel: { fontSize: 10, color: Colors.text.muted, marginTop: 2 },
    missionDivider: { width: 1, backgroundColor: Colors.border },

    // Edit Modal
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
    modalCard: {
        backgroundColor: Colors.bg.secondary, borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl,
        padding: Spacing.lg, paddingBottom: 40, borderTopWidth: 1, borderTopColor: Colors.border,
    },
    modalTitle: { fontSize: 18, fontWeight: '700', color: Colors.text.primary, marginBottom: Spacing.md },
    inputLabel: { fontSize: 11, fontWeight: '700', color: Colors.text.muted, marginBottom: 6, marginTop: 12, textTransform: 'uppercase', letterSpacing: 0.5 },
    input: {
        backgroundColor: Colors.bg.tertiary, borderRadius: Radius.md,
        padding: Spacing.md, color: Colors.text.primary, fontSize: 15,
        borderWidth: 1, borderColor: Colors.border,
    },
    modalButtons: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.lg },
    modalBtn: { flex: 1, padding: 14, borderRadius: Radius.lg, alignItems: 'center' },
    modalBtnCancel: { backgroundColor: Colors.bg.tertiary, borderWidth: 1, borderColor: Colors.border },
    modalBtnSave: { backgroundColor: Colors.brand.primary },
    modalBtnCancelText: { fontSize: 15, fontWeight: '600', color: Colors.text.secondary },
    modalBtnSaveText: { fontSize: 15, fontWeight: '700', color: Colors.bg.primary },
});
