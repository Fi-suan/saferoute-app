/**
 * ReportModal Component — SafeRoute / Sapa Jol
 *
 * Форма отчёта об инциденте. Вынесена из MapScreen (~80 строк inline).
 * Добавлены:
 * - expo-image-picker для фото
 * - Реальный device ID (не 'demo-device')
 * - Offline-очередь через useIncidents.submitReport
 */
import React, { useState } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity, Modal,
    TextInput, ScrollView, ActivityIndicator, Image, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { Colors, Spacing, Radius, Shadow } from '../constants/colors';
import { INCIDENT_TYPES_LIST } from '../constants/incidents';
import { GeoPoint } from '../hooks/useLocation';
import * as FileSystem from 'expo-file-system';
import { useAppDialog } from './AppDialog';

interface Props {
    visible: boolean;
    onClose: () => void;
    location: GeoPoint | null;
    onSubmit: (params: {
        incident_type: string;
        description: string;
        severity: number;
        latitude: number;
        longitude: number;
        photo_uri?: string;
        photo_base64?: string;
    }) => Promise<{ ok: boolean; error?: string; queued?: boolean }>;
}

export default function ReportModal({ visible, onClose, location, onSubmit }: Props) {
    const [reportType, setReportType] = useState('crash');
    const [reportDesc, setReportDesc] = useState('');
    const [severity, setSeverity] = useState(3);
    const [photoUri, setPhotoUri] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const { showDialog, DialogComponent } = useAppDialog();

    const pickPhoto = async () => {
        // Сначала пробуем камеру
        const cam = await ImagePicker.requestCameraPermissionsAsync();
        if (cam.granted) {
            const result = await ImagePicker.launchCameraAsync({
                mediaTypes: 'images' as const,
                quality: 0.6,
                allowsEditing: true,
                aspect: [4, 3],
            });
            if (!result.canceled && result.assets[0]) {
                setPhotoUri(result.assets[0].uri);
            }
            return;
        }
        // Галерея
        const lib = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!lib.granted) return;
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: 'images' as const,
            quality: 0.6,
            allowsEditing: true,
            aspect: [4, 3],
        });
        if (!result.canceled && result.assets[0]) {
            setPhotoUri(result.assets[0].uri);
        }
    };

    const handleSubmit = async () => {
        if (!location) {
            showDialog({
                title: 'Қате',
                message: 'Геолокация жоқ. Рұқсат беріңіз.',
                icon: 'warning',
                iconColor: Colors.alert.critical,
                buttons: [{ text: 'Жабу', style: 'default' }],
            });
            return;
        }
        setSubmitting(true);

        // Resize + compress photo before base64 to avoid OOM on weak devices
        let photo_base64: string | undefined;
        if (photoUri) {
            try {
                const resized = await ImageManipulator.manipulateAsync(
                    photoUri,
                    [{ resize: { width: 800 } }],
                    { compress: 0.5, format: ImageManipulator.SaveFormat.JPEG },
                );
                const base64Data = await FileSystem.readAsStringAsync(resized.uri, {
                    encoding: 'base64',
                });
                photo_base64 = base64Data;
            } catch (e) {
                console.warn('[ReportModal] Failed to process photo:', e);
            }
        }

        const result = await onSubmit({
            incident_type: reportType,
            description: reportDesc.trim(),
            severity,
            latitude: location.lat,
            longitude: location.lon,
            photo_uri: photoUri ?? undefined,
            photo_base64,
        });
        setSubmitting(false);
        if (result.ok) {
            setReportDesc('');
            setPhotoUri(null);
            setSeverity(3);
            setReportType('crash');
            onClose();
            showDialog({
                title: result.queued ? 'Кезекте' : 'Дайын!',
                message: result.queued
                    ? 'Интернет жоқ. Белгі кезекке қойылды — байланыс болғанда жіберіледі.'
                    : 'Белгі қойылды. AI тексеруі жүргізілуде.',
                icon: result.queued ? 'cloud-offline' : 'checkmark-circle',
                iconColor: result.queued ? Colors.text.muted : Colors.brand.primary,
                buttons: [{ text: 'Түсіндім', style: 'default' }],
            });
        } else {
            showDialog({
                title: 'Қате',
                message: result.error ?? 'Белгісіз қате',
                icon: 'close-circle',
                iconColor: Colors.alert.critical,
                buttons: [{ text: 'Жабу', style: 'cancel' }],
            });
        }
    };

    return (
        <Modal visible={visible} animationType="slide" transparent>
            <View style={styles.overlay}>
                <View style={styles.content}>
                    <View style={styles.header}>
                        <Text style={styles.title}>Белгі қою</Text>
                        <TouchableOpacity onPress={onClose}>
                            <Ionicons name="close" size={24} color={Colors.text.secondary} />
                        </TouchableOpacity>
                    </View>

                    <ScrollView showsVerticalScrollIndicator={false}>
                        {/* Тип инцидента */}
                        <Text style={styles.label}>Инцидент түрі</Text>
                        <View style={styles.typeRow}>
                            {INCIDENT_TYPES_LIST.map((t) => (
                                <TouchableOpacity
                                    key={t.key}
                                    style={[styles.typeChip, reportType === t.key && styles.typeChipActive]}
                                    onPress={() => setReportType(t.key)}
                                >
                                    <Ionicons
                                        name={t.icon as any}
                                        size={16}
                                        color={reportType === t.key ? Colors.bg.primary : Colors.text.secondary}
                                    />
                                    <Text style={[
                                        styles.typeChipText,
                                        reportType === t.key && styles.typeChipTextActive,
                                    ]}>
                                        {t.label}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        {/* Тяжесть */}
                        <Text style={styles.label}>Қауіп деңгейі</Text>
                        <View style={styles.severityRow}>
                            {[1, 2, 3, 4, 5].map((s) => (
                                <TouchableOpacity
                                    key={s}
                                    style={[
                                        styles.severityBtn,
                                        severity === s && {
                                            backgroundColor:
                                                s >= 4
                                                    ? Colors.alert.critical
                                                    : s >= 3
                                                        ? Colors.alert.high
                                                        : Colors.alert.medium,
                                        },
                                    ]}
                                    onPress={() => setSeverity(s)}
                                >
                                    <Text style={[
                                        styles.severityBtnText,
                                        severity === s && { color: Colors.white },
                                    ]}>
                                        {s}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        {/* Описание */}
                        <Text style={styles.label}>Сипаттама</Text>
                        <TextInput
                            style={styles.textInput}
                            placeholder="Не болды..."
                            placeholderTextColor={Colors.text.muted}
                            value={reportDesc}
                            onChangeText={setReportDesc}
                            multiline
                            numberOfLines={3}
                        />

                        {/* Фото */}
                        <Text style={styles.label}>Фото (AI үшін)</Text>
                        <TouchableOpacity style={styles.photoBtn} onPress={pickPhoto}>
                            {photoUri ? (
                                <Image source={{ uri: photoUri }} style={styles.photoPreview} />
                            ) : (
                                <>
                                    <Ionicons name="camera" size={24} color={Colors.text.muted} />
                                    <Text style={styles.photoBtnText}>Камера / Галерея</Text>
                                </>
                            )}
                        </TouchableOpacity>
                        {photoUri && (
                            <TouchableOpacity onPress={() => setPhotoUri(null)}>
                                <Text style={styles.removePhoto}>Фотоны жою</Text>
                            </TouchableOpacity>
                        )}

                        {/* Координаты */}
                        <View style={styles.locationRow}>
                            <Ionicons name="location" size={14} color={Colors.brand.primary} />
                            <Text style={styles.locationText}>
                                {location
                                    ? `${location.lat.toFixed(4)}, ${location.lon.toFixed(4)}`
                                    : 'Анықталуда...'}
                            </Text>
                        </View>

                        {/* Submit */}
                        <TouchableOpacity
                            style={[styles.submitBtn, submitting && { opacity: 0.6 }]}
                            onPress={handleSubmit}
                            disabled={submitting}
                        >
                            {submitting ? (
                                <ActivityIndicator color={Colors.bg.primary} />
                            ) : (
                                <>
                                    <Ionicons name="shield-checkmark" size={18} color={Colors.bg.primary} />
                                    <Text style={styles.submitBtnText}>
                                        Белгі қою{photoUri ? ' (AI + фото)' : ' (AI тексереді)'}
                                    </Text>
                                </>
                            )}
                        </TouchableOpacity>
                        <Text style={styles.aiNote}>
                            AI сіздің хабарламаңызды жариялау алдында тексереді
                        </Text>
                    </ScrollView>
                </View>
            </View>
            {DialogComponent}
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
    content: {
        backgroundColor: Colors.bg.secondary,
        borderTopLeftRadius: Radius.xl,
        borderTopRightRadius: Radius.xl,
        padding: Spacing.lg,
        paddingBottom: 40,
        borderTopWidth: 1,
        borderTopColor: Colors.border,
        maxHeight: '90%',
    },
    header: {
        flexDirection: 'row', alignItems: 'center',
        justifyContent: 'space-between', marginBottom: Spacing.lg,
    },
    title: { fontSize: 20, fontWeight: '700', color: Colors.text.primary },
    label: {
        fontSize: 11, fontWeight: '700', color: Colors.text.muted,
        marginBottom: 8, marginTop: 12,
        textTransform: 'uppercase', letterSpacing: 0.5,
    },
    typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    typeChip: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        paddingVertical: 10, paddingHorizontal: 14,
        borderRadius: Radius.lg, backgroundColor: Colors.bg.tertiary,
        borderWidth: 1, borderColor: Colors.border,
    },
    typeChipActive: { backgroundColor: Colors.brand.primary, borderColor: Colors.brand.primary },
    typeChipText: { fontSize: 13, fontWeight: '600', color: Colors.text.secondary },
    typeChipTextActive: { color: Colors.bg.primary },
    severityRow: { flexDirection: 'row', gap: 8 },
    severityBtn: {
        width: 42, height: 42, borderRadius: Radius.md,
        alignItems: 'center', justifyContent: 'center',
        backgroundColor: Colors.bg.tertiary, borderWidth: 1, borderColor: Colors.border,
    },
    severityBtnText: { fontSize: 16, fontWeight: '700', color: Colors.text.secondary },
    textInput: {
        backgroundColor: Colors.bg.tertiary, borderRadius: Radius.md, padding: Spacing.md,
        color: Colors.text.primary, fontSize: 14, minHeight: 60, textAlignVertical: 'top',
        borderWidth: 1, borderColor: Colors.border,
    },
    photoBtn: {
        borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border,
        borderStyle: 'dashed', backgroundColor: Colors.bg.tertiary,
        alignItems: 'center', justifyContent: 'center',
        height: 80, gap: 6, flexDirection: 'row',
    },
    photoBtnText: { fontSize: 14, color: Colors.text.muted },
    photoPreview: { width: '100%', height: 80, borderRadius: Radius.md },
    removePhoto: { fontSize: 12, color: Colors.alert.critical, textAlign: 'center', marginTop: 6 },
    locationRow: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        marginTop: 12, paddingVertical: 8,
    },
    locationText: { fontSize: 12, color: Colors.text.muted },
    submitBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
        backgroundColor: Colors.brand.primary, borderRadius: Radius.lg,
        paddingVertical: 16, marginTop: 12,
    },
    submitBtnText: { fontSize: 16, fontWeight: '700', color: Colors.bg.primary },
    aiNote: { fontSize: 11, color: Colors.text.muted, textAlign: 'center', marginTop: 8, marginBottom: 8 },
});
