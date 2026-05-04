/**
 * NavigationCard — нижняя карточка пошаговой навигации.
 * Прогресс-бар + текущий шаг + превью следующего шага.
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Colors, Spacing, Radius, Shadow } from '../../constants/colors';
import { DirectionsResult } from '../../services/directions';
import { useT } from '../../i18n';

interface NavigationCardProps {
    navResult: DirectionsResult;
    navStepIdx: number;
    onStop: () => void;
}

export default function NavigationCard({ navResult, navStepIdx, onStop }: NavigationCardProps) {
    const t = useT();
    const currentStep = navResult.steps[navStepIdx];
    const nextStep = navResult.steps[navStepIdx + 1];
    const progress = ((navStepIdx + 1) / navResult.steps.length) * 100;

    const handleStop = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        onStop();
    };

    return (
        <View style={styles.navCard}>
            <View style={styles.navProgress}>
                <View style={[styles.navProgressFill, { width: `${progress}%` as any }]} />
            </View>

            <View style={styles.navCardHeader}>
                <View style={styles.navIconBox}>
                    <Ionicons name="navigate" size={24} color={Colors.brand.primary} />
                </View>
                <View style={{ flex: 1 }}>
                    {currentStep && (
                        <Text style={styles.navInstructionText} numberOfLines={2}>
                            {currentStep.instruction}
                        </Text>
                    )}
                    <Text style={styles.navDistText}>
                        {currentStep?.distance}
                        {' · '}
                        <Text style={styles.navTotalText}>{t('route_mode_label')} {navResult.totalDistance}</Text>
                    </Text>
                </View>
                <TouchableOpacity style={styles.navStopBtn} onPress={handleStop}>
                    <Ionicons name="stop" size={16} color={Colors.alert.critical} />
                </TouchableOpacity>
            </View>

            {nextStep && (
                <View style={styles.navNextStep}>
                    <Text style={styles.navNextLabel}>Затем: </Text>
                    <Text style={styles.navNextText} numberOfLines={1}>
                        {nextStep.instruction}
                    </Text>
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    navCard: {
        position: 'absolute', bottom: 0, left: 0, right: 0,
        backgroundColor: Colors.bg.secondary,
        borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl,
        borderTopWidth: 1, borderColor: Colors.brand.primary + '30',
        paddingBottom: 32, paddingTop: 0,
        ...Shadow.card,
    },
    navProgress: {
        height: 2, backgroundColor: Colors.bg.tertiary,
        borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl, overflow: 'hidden',
    },
    navProgressFill: { height: '100%', backgroundColor: Colors.brand.primary },
    navCardHeader: {
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: Spacing.lg, paddingTop: Spacing.lg,
        gap: Spacing.md,
    },
    navIconBox: {
        width: 48, height: 48, borderRadius: Radius.md,
        backgroundColor: Colors.brand.primary + '15',
        borderWidth: 1, borderColor: Colors.brand.primary + '30',
        alignItems: 'center', justifyContent: 'center',
    },
    navInstructionText: { fontSize: 17, fontWeight: '700', color: Colors.text.primary, lineHeight: 22 },
    navDistText: { fontSize: 13, color: Colors.text.secondary, marginTop: 3 },
    navTotalText: { color: Colors.text.muted },
    navStopBtn: {
        width: 36, height: 36, borderRadius: Radius.full,
        borderWidth: 1, borderColor: Colors.alert.critical + '40',
        alignItems: 'center', justifyContent: 'center',
        backgroundColor: Colors.alert.critical + '10',
    },
    navNextStep: {
        flexDirection: 'row', alignItems: 'center',
        marginHorizontal: Spacing.lg, marginTop: Spacing.sm,
        paddingTop: Spacing.sm,
        borderTopWidth: 1, borderColor: Colors.divider,
    },
    navNextLabel: { fontSize: 12, color: Colors.text.muted, marginRight: 4 },
    navNextText: { fontSize: 12, color: Colors.text.secondary, flex: 1 },
});
