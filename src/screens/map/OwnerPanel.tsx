/**
 * OwnerPanel — модалка владельца скота:
 * выбор типа животного, количества, активация/деактивация manual mode.
 */
import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Colors, Spacing, Radius } from '../../constants/colors';
import { LIVESTOCK_META, LivestockType } from '../../constants/livestock';
import { useT } from '../../i18n';
import { LIVESTOCK_TYPES } from './constants';
import type { TranslationKey } from '../../i18n/translations';

interface OwnerPanelProps {
    visible: boolean;
    isManualMode: boolean;
    selectedType: LivestockType;
    livestockCount: number;
    hasLocation: boolean;
    onClose: () => void;
    onSelectType: (type: LivestockType) => void;
    onChangeCount: (count: number) => void;
    onActivate: () => void;
    onDeactivate: () => void;
}

export default function OwnerPanel({
    visible,
    isManualMode,
    selectedType,
    livestockCount,
    hasLocation,
    onClose,
    onSelectType,
    onChangeCount,
    onActivate,
    onDeactivate,
}: OwnerPanelProps) {
    const t = useT();

    const livestockLabel = (type: LivestockType): string => {
        const key = `livestock_${type}` as TranslationKey;
        return t(key) || LIVESTOCK_META[type].label;
    };

    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
            <View style={styles.overlay}>
                <TouchableOpacity style={styles.backdrop} onPress={onClose} activeOpacity={1} />
                <View style={styles.panel}>
                    <View style={styles.handle} />

                    {isManualMode ? (
                        <>
                            <View style={styles.activeHeader}>
                                <View style={styles.activeDot} />
                                <Text style={styles.title}>{t('owner_active_title')}</Text>
                            </View>
                            <Text style={styles.subtitle}>{t('owner_active_subtitle')}</Text>
                            <View style={styles.activeCard}>
                                <Text style={styles.activeEmoji}>{LIVESTOCK_META[selectedType].emoji}</Text>
                                <View>
                                    <Text style={styles.activeType}>{livestockLabel(selectedType)}</Text>
                                    <Text style={styles.activeCount}>{livestockCount} {t('heads_unit')}</Text>
                                </View>
                            </View>
                            <TouchableOpacity style={styles.deactivateBtn} onPress={onDeactivate}>
                                <Ionicons name="stop-circle" size={20} color={Colors.white} />
                                <Text style={styles.deactivateBtnText}>{t('owner_deactivate')}</Text>
                            </TouchableOpacity>
                        </>
                    ) : (
                        <>
                            <Text style={styles.title}>{t('owner_panel_title')}</Text>
                            <Text style={styles.subtitle}>{t('owner_panel_subtitle')}</Text>

                            <Text style={styles.sectionLabel}>{t('owner_type_label')}</Text>
                            <View style={styles.typeGrid}>
                                {LIVESTOCK_TYPES.map(type => (
                                    <TouchableOpacity
                                        key={type}
                                        style={[styles.typeChip, selectedType === type && styles.typeChipActive]}
                                        onPress={() => { Haptics.selectionAsync(); onSelectType(type); }}
                                    >
                                        <Text style={styles.typeChipEmoji}>{LIVESTOCK_META[type].emoji}</Text>
                                        <Text style={[styles.typeChipLabel, selectedType === type && styles.typeChipLabelActive]}>
                                            {livestockLabel(type)}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            <Text style={styles.sectionLabel}>{t('owner_count_label')}</Text>
                            <View style={styles.stepper}>
                                <TouchableOpacity
                                    style={styles.stepperBtn}
                                    onPress={() => { Haptics.selectionAsync(); onChangeCount(Math.max(1, livestockCount - 5)); }}
                                >
                                    <Ionicons name="remove" size={20} color={Colors.text.primary} />
                                </TouchableOpacity>
                                <Text style={styles.stepperValue}>{livestockCount}</Text>
                                <TouchableOpacity
                                    style={styles.stepperBtn}
                                    onPress={() => { Haptics.selectionAsync(); onChangeCount(livestockCount + 5); }}
                                >
                                    <Ionicons name="add" size={20} color={Colors.text.primary} />
                                </TouchableOpacity>
                            </View>

                            <TouchableOpacity
                                style={[styles.activateBtn, !hasLocation && styles.activateBtnDisabled]}
                                onPress={onActivate}
                                disabled={!hasLocation}
                            >
                                <Ionicons name="radio" size={20} color={Colors.bg.primary} />
                                <Text style={styles.activateBtnText}>{t('owner_activate')}</Text>
                            </TouchableOpacity>
                            {!hasLocation && <Text style={styles.noLocation}>{t('owner_no_gps')}</Text>}
                        </>
                    )}
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: { flex: 1, justifyContent: 'flex-end' },
    backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
    panel: {
        backgroundColor: Colors.bg.secondary,
        borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl,
        paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm, paddingBottom: 40,
        borderWidth: 1, borderColor: Colors.border,
    },
    handle: {
        width: 36, height: 4, borderRadius: 2,
        backgroundColor: Colors.border, alignSelf: 'center', marginBottom: Spacing.lg,
    },
    title: { fontSize: 20, fontWeight: '800', color: Colors.text.primary, marginBottom: 6 },
    subtitle: { fontSize: 13, color: Colors.text.secondary, lineHeight: 18, marginBottom: Spacing.lg },
    sectionLabel: { fontSize: 12, fontWeight: '700', color: Colors.text.muted, letterSpacing: 0.8, marginBottom: 10, textTransform: 'uppercase' },
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
    noLocation: { fontSize: 12, color: Colors.alert.medium, textAlign: 'center', marginTop: 8 },
    activeHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
    activeDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.brand.primary },
    activeCard: {
        flexDirection: 'row', alignItems: 'center', gap: 16,
        backgroundColor: Colors.bg.tertiary, borderRadius: Radius.lg,
        padding: Spacing.md, marginVertical: Spacing.lg,
        borderWidth: 1, borderColor: Colors.brand.primary + '40',
    },
    activeEmoji: { fontSize: 40 },
    activeType: { fontSize: 16, fontWeight: '700', color: Colors.text.primary },
    activeCount: { fontSize: 13, color: Colors.text.secondary, marginTop: 2 },
    deactivateBtn: {
        backgroundColor: Colors.alert.critical, borderRadius: Radius.lg,
        paddingVertical: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    },
    deactivateBtnText: { fontSize: 16, fontWeight: '700', color: Colors.white },
});
