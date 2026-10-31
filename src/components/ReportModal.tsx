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
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Modal,
    TextInput,
    ScrollView,
    ActivityIndicator,
    Image,
    Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { Colors, Spacing, Radius, Shadow } from '../constants/colors';
import { INCIDENT_TYPES_LIST } from '../constants/incidents';
import { GeoPoint } from '../hooks/useLocation';
// SDK 54: readAsStringAsync переехал в /legacy — из 'expo-file-system' кидает ошибку
import * as FileSystem from 'expo-file-system/legacy';
import { useT } from '../i18n';
import { useAppDialog } from './AppDialog';

interface Props {
    visible: boolean;
    /** Non-blocking success feedback (toast). If omitted, falls back to a dialog. */
    onSuccess?: (message: string, queued: boolean) => void;
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

export default function ReportModal({ visible, onClose, location, onSubmit, onSuccess }: Props) {
    const t = useT();
    const [reportType, setReportType] = useState('crash');
    const [reportDesc, setReportDesc] = useState('');
    const [severity, setSeverity] = useState(3);
    const [photoUri, setPhotoUri] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [descError, setDescError] = useState<string | null>(null);
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
        if (!lib.granted) {
            // Раньше здесь был молчаливый return — тап «не работал». Честно
            // объясняем и даём путь в настройки.
            showDialog({
                title: t('photo_denied_title'),
                message: t('photo_denied_msg'),
                icon: 'camera',
                iconColor: Colors.alert.high,
                buttons: [
                    {
                        text: t('open_settings'),
                        icon: 'settings',
                        style: 'default',
                        onPress: () => Linking.openSettings().catch(() => undefined),
                    },
                    { text: t('understand'), style: 'cancel' },
                ],
            });
            return;
        }
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

    const handleSubmit = async (skipPhoto = false) => {
        if (!location) {
            showDialog({
                title: t('common_error'),
                message: t('report_no_location'),
                icon: 'warning',
                iconColor: Colors.alert.critical,
                buttons: [{ text: t('common_close'), style: 'default' }],
            });
            return;
        }
        // Пустая метка бесполезна для других водителей
        if (reportDesc.trim().length < 3) {
            setDescError(t('report_desc_required'));
            return;
        }
        setDescError(null);
        setSubmitting(true);

        // Resize + compress photo before base64 to avoid OOM on weak devices.
        // Фолбэк: если сжатие сорвалось (HEIC/особые форматы) — читаем оригинал
        // напрямую как base64; диалог показываем только если не вышло вообще.
        // skipPhoto: путь «Отправить без фото» — стейт ещё мог не обновиться.
        let photo_base64: string | undefined;
        let photoFailed = false;
        if (photoUri && !skipPhoto) {
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
                console.warn('[ReportModal] resize failed, trying original file:', e);
                try {
                    photo_base64 = await FileSystem.readAsStringAsync(photoUri, {
                        encoding: 'base64',
                    });
                } catch (e2) {
                    console.warn('[ReportModal] original read failed:', e2);
                    photoFailed = true;
                }
            }
        }

        if (photoFailed) {
            setSubmitting(false);
            showDialog({
                title: t('report_photo_error'),
                message: t('report_photo_error_msg'),
                icon: 'warning',
                iconColor: Colors.alert.high,
                buttons: [
                    {
                        text: t('report_send_no_photo'),
                        style: 'default',
                        onPress: () => {
                            setPhotoUri(null);
                            // skipPhoto=true: state ещё старый, пересабыть не выйдет
                            handleSubmit(true);
                        },
                    },
                    { text: t('no_exit'), style: 'cancel' },
                ],
            });
            return;
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
            if (onSuccess) {
                onSuccess(
                    result.queued ? t('report_queued_msg') : t('report_success_msg'),
                    !!result.queued,
                );
            } else {
                showDialog({
                    title: result.queued ? t('report_queued_title') : t('report_done_title'),
                    message: result.queued ? t('report_queued_msg') : t('report_success_msg'),
                    icon: result.queued ? 'cloud-offline' : 'checkmark-circle',
                    iconColor: result.queued ? Colors.text.muted : Colors.brand.primary,
                    buttons: [{ text: t('understand'), style: 'default' }],
                });
            }
        } else {
            showDialog({
                title: t('common_error'),
                message: result.error ?? t('unknown_error'),
                icon: 'close-circle',
                iconColor: Colors.alert.critical,
                buttons: [{ text: t('common_close'), style: 'cancel' }],
            });
        }
    };

    return (
        <Modal visible={visible} animationType="slide" transparent>
            <View style={styles.overlay}>
                <View style={styles.content}>
                    <View style={styles.header}>
                        <Text style={styles.title}>{t('report_btn')}</Text>
                        <TouchableOpacity onPress={onClose}>
                            <Ionicons name="close" size={24} color={Colors.text.secondary} />
                        </TouchableOpacity>
                    </View>

                    <ScrollView showsVerticalScrollIndicator={false}>
                        {/* Тип инцидента */}
                        <Text style={styles.label}>{t('report_type_label')}</Text>
                        <View style={styles.typeRow}>
                            {INCIDENT_TYPES_LIST.map((t) => (
                                <TouchableOpacity
                                    key={t.key}
                                    style={[
                                        styles.typeChip,
                                        reportType === t.key && styles.typeChipActive,
                                    ]}
                                    onPress={() => setReportType(t.key)}
                                >
                                    <Ionicons
                                        name={t.icon as any}
                                        size={16}
                                        color={
                                            reportType === t.key
                                                ? Colors.bg.primary
                                                : Colors.text.secondary
                                        }
                                    />
                                    <Text
                                        style={[
                                            styles.typeChipText,
                                            reportType === t.key && styles.typeChipTextActive,
                                        ]}
                                    >
                                        {t.label}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        {/* Тяжесть. С фото опасность оценивает AI — ручной выбор
                            остаётся только для репортов без фото */}
                        {photoUri ? (
                            <>
                                <Text style={styles.label}>{t('report_severity_label')}</Text>
                                <View style={styles.aiSeverityNote}>
                                    <Ionicons name="sparkles" size={16} color={Colors.brand.primary} />
                                    <Text style={styles.aiSeverityNoteText}>
                                        {t('ai_severity_note')}
                                    </Text>
                                </View>
                            </>
                        ) : (
                            <>
                                <Text style={styles.label}>{t('report_severity_label')}</Text>
                                <View style={styles.severityRow}>
                            {(
                                [
                                    { n: 1, label: t('sev_low'), color: Colors.alert.medium },
                                    { n: 2, label: t('sev_medium'), color: Colors.alert.medium },
                                    { n: 3, label: t('sev_high'), color: Colors.alert.high },
                                    {
                                        n: 4,
                                        label: t('sev_critical'),
                                        color: Colors.alert.critical,
                                    },
                                    { n: 5, label: t('sev_max'), color: Colors.alert.critical },
                                ] as const
                            ).map(({ n, label, color }) => (
                                <TouchableOpacity
                                    key={n}
                                    style={[
                                        styles.severityBtn,
                                        severity === n && {
                                            backgroundColor: color,
                                            borderColor: color,
                                        },
                                    ]}
                                    onPress={() => setSeverity(n)}
                                >
                                    <Text
                                        style={[
                                            styles.severityBtnText,
                                            severity === n && { color: Colors.white },
                                        ]}
                                    >
                                        {n}
                                    </Text>
                                    <Text
                                        style={[
                                            styles.severityLabel,
                                            severity === n && { color: Colors.white },
                                        ]}
                                    >
                                        {label}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                                </View>
                            </>
                        )}

                        {/* Описание */}
                        <Text style={styles.label}>{t('report_desc_label')}</Text>
                        <TextInput
                            style={styles.textInput}
                            placeholder={t('report_desc_placeholder')}
                            placeholderTextColor={Colors.text.muted}
                            value={reportDesc}
                            onChangeText={(v) => {
                                setReportDesc(v);
                                if (descError) setDescError(null);
                            }}
                            multiline
                            numberOfLines={3}
                        />
                        {descError && (
                            <Text style={styles.descError}>{descError}</Text>
                        )}

                        {/* Фото */}
                        <Text style={styles.label}>{t('report_photo_label')}</Text>
                        <TouchableOpacity style={styles.photoBtn} onPress={pickPhoto}>
                            {photoUri ? (
                                <Image source={{ uri: photoUri }} style={styles.photoPreview} />
                            ) : (
                                <>
                                    <Ionicons name="camera" size={24} color={Colors.text.muted} />
                                    <Text style={styles.photoBtnText}>{t('report_photo_btn')}</Text>
                                </>
                            )}
                        </TouchableOpacity>
                        {photoUri && (
                            <TouchableOpacity onPress={() => setPhotoUri(null)}>
                                <Text style={styles.removePhoto}>{t('report_photo_remove')}</Text>
                            </TouchableOpacity>
                        )}

                        {/* Координаты */}
                        <View style={styles.locationRow}>
                            <Ionicons name="location" size={14} color={Colors.brand.primary} />
                            <Text style={styles.locationText}>
                                {location
                                    ? `${location.lat.toFixed(4)}, ${location.lon.toFixed(4)}`
                                    : t('location_detecting')}
                            </Text>
                        </View>

                        {/* Submit */}
                        <TouchableOpacity
                            style={[styles.submitBtn, submitting && { opacity: 0.6 }]}
                            onPress={() => handleSubmit()}
                            disabled={submitting}
                        >
                            {submitting ? (
                                <ActivityIndicator color={Colors.bg.primary} />
                            ) : (
                                <>
                                    <Ionicons
                                        name="shield-checkmark"
                                        size={18}
                                        color={Colors.bg.primary}
                                    />
                                    <Text style={styles.submitBtnText}>
                                        {photoUri ? t('report_submit_photo') : t('report_submit')}
                                    </Text>
                                </>
                            )}
                        </TouchableOpacity>
                        <Text style={styles.aiNote}>{t('report_ai_note')}</Text>
                    </ScrollView>
                </View>
            </View>
            {DialogComponent}
        </Modal>
    );
}

const styles = StyleSheet.create({
    descError: { color: Colors.alert.critical, fontSize: 12, marginTop: 4 },
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
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: Spacing.lg,
    },
    title: { fontSize: 20, fontWeight: '700', color: Colors.text.primary },
    label: {
        fontSize: 11,
        fontWeight: '700',
        color: Colors.text.muted,
        marginBottom: 8,
        marginTop: 12,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    typeChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingVertical: 10,
        paddingHorizontal: 14,
        borderRadius: Radius.lg,
        backgroundColor: Colors.bg.tertiary,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    typeChipActive: { backgroundColor: Colors.brand.primary, borderColor: Colors.brand.primary },
    typeChipText: { fontSize: 13, fontWeight: '600', color: Colors.text.secondary },
    typeChipTextActive: { color: Colors.bg.primary },
    severityRow: { flexDirection: 'row', gap: 8 },
    aiSeverityNote: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: Colors.brand.primary + '14',
        borderWidth: 1,
        borderColor: Colors.brand.primary + '40',
        borderRadius: Radius.md,
        padding: 10,
    },
    aiSeverityNoteText: { flex: 1, fontSize: 12, color: Colors.text.secondary },
    severityBtn: {
        flex: 1,
        height: 52,
        borderRadius: Radius.md,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: Colors.bg.tertiary,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    severityBtnText: { fontSize: 16, fontWeight: '700', color: Colors.text.secondary },
    severityLabel: { fontSize: 9, fontWeight: '600', color: Colors.text.muted, marginTop: 1 },
    textInput: {
        backgroundColor: Colors.bg.tertiary,
        borderRadius: Radius.md,
        padding: Spacing.md,
        color: Colors.text.primary,
        fontSize: 14,
        minHeight: 60,
        textAlignVertical: 'top',
        borderWidth: 1,
        borderColor: Colors.border,
    },
    photoBtn: {
        borderRadius: Radius.md,
        borderWidth: 1,
        borderColor: Colors.border,
        borderStyle: 'dashed',
        backgroundColor: Colors.bg.tertiary,
        alignItems: 'center',
        justifyContent: 'center',
        height: 80,
        gap: 6,
        flexDirection: 'row',
    },
    photoBtnText: { fontSize: 14, color: Colors.text.muted },
    photoPreview: { width: '100%', height: 80, borderRadius: Radius.md },
    removePhoto: { fontSize: 12, color: Colors.alert.critical, textAlign: 'center', marginTop: 6 },
    locationRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginTop: 12,
        paddingVertical: 8,
    },
    locationText: { fontSize: 12, color: Colors.text.muted },
    submitBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: Colors.brand.primary,
        borderRadius: Radius.lg,
        paddingVertical: 16,
        marginTop: 12,
    },
    submitBtnText: { fontSize: 16, fontWeight: '700', color: Colors.bg.primary },
    aiNote: {
        fontSize: 11,
        color: Colors.text.muted,
        textAlign: 'center',
        marginTop: 8,
        marginBottom: 8,
    },
});
