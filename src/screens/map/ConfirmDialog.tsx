/**
 * ConfirmDialog — модалка подтверждения инцидента
 * (когда водитель находится в радиусе 0.5 км от инцидента).
 */
import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import LottieView from 'lottie-react-native';
import { Colors, Spacing, Radius } from '../../constants/colors';
import { getIncidentMeta, Incident } from '../../constants/incidents';
import { useT } from '../../i18n';

interface ConfirmDialogProps {
    incident: Incident | null;
    onConfirm: (isResolved: boolean) => void;
    onViewDetail: () => void;
    onClose: () => void;
}

export default function ConfirmDialog({ incident, onConfirm, onViewDetail, onClose }: ConfirmDialogProps) {
    const t = useT();

    return (
        <Modal visible={!!incident} transparent animationType="fade" onRequestClose={onClose}>
            <View style={styles.overlay}>
                <View style={styles.card}>
                    <LottieView
                        source={require('../../assets/lottie/confirm_question.json')}
                        autoPlay loop
                        style={{ width: 90, height: 90 }}
                    />
                    <Text style={styles.title}>{t('confirm_title')}</Text>
                    <Text style={styles.desc}>{t('confirm_desc')}</Text>
                    {incident && (
                        <Text style={styles.incidentType}>
                            {getIncidentMeta(incident.incident_type).label}
                        </Text>
                    )}
                    <View style={styles.buttons}>
                        <TouchableOpacity
                            style={[styles.btn, { backgroundColor: Colors.brand.primary }]}
                            onPress={() => onConfirm(true)}
                        >
                            <Ionicons name="checkmark" size={18} color={Colors.bg.primary} />
                            <Text style={styles.btnText}>{t('confirm_yes')}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.btn, { backgroundColor: Colors.alert.critical }]}
                            onPress={() => onConfirm(false)}
                        >
                            <Ionicons name="close" size={18} color={Colors.white} />
                            <Text style={[styles.btnText, { color: Colors.white }]}>{t('confirm_no')}</Text>
                        </TouchableOpacity>
                    </View>
                    <TouchableOpacity style={styles.detail} onPress={onViewDetail}>
                        <Text style={styles.detailText}>{t('confirm_view')}</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', alignItems: 'center', justifyContent: 'center' },
    card: {
        backgroundColor: Colors.bg.secondary, borderRadius: Radius.xl,
        padding: Spacing.xl, alignItems: 'center', width: 320,
        borderWidth: 1, borderColor: Colors.border,
    },
    title: { fontSize: 20, fontWeight: '700', color: Colors.text.primary, marginTop: 12 },
    desc: { fontSize: 14, color: Colors.text.secondary, textAlign: 'center', marginTop: 8 },
    incidentType: { fontSize: 13, color: Colors.text.muted, marginTop: 4, marginBottom: Spacing.lg },
    buttons: { flexDirection: 'row', gap: 12, width: '100%' },
    btn: {
        flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        gap: 6, paddingVertical: 14, borderRadius: Radius.lg,
    },
    btnText: { fontSize: 15, fontWeight: '700', color: Colors.bg.primary },
    detail: { marginTop: Spacing.sm },
    detailText: { fontSize: 13, color: Colors.brand.primary, fontWeight: '600' },
});
