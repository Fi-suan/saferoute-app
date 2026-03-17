/**
 * ProximityBanner Component — SafeRoute / Sapa Jol
 *
 * Анимированный баннер предупреждения о близком инциденте.
 * Вынесен из MapScreen.tsx (~20 строк inline).
 */
import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Radius, Shadow } from '../constants/colors';
import { Incident, getIncidentMeta } from '../constants/incidents';

interface Props {
    incident: Incident;
    onDismiss: () => void;
    onViewDetail?: (incident: Incident) => void;
}

export default function ProximityBanner({ incident, onDismiss, onViewDetail }: Props) {
    const translateY = useRef(new Animated.Value(-80)).current;
    const opacity = useRef(new Animated.Value(0)).current;
    const meta = getIncidentMeta(incident.incident_type);

    useEffect(() => {
        // Slide-in анимация
        Animated.parallel([
            Animated.spring(translateY, {
                toValue: 0,
                useNativeDriver: true,
                tension: 80,
                friction: 10,
            }),
            Animated.timing(opacity, {
                toValue: 1,
                duration: 200,
                useNativeDriver: true,
            }),
        ]).start();
    }, []);

    const dismiss = () => {
        Animated.parallel([
            Animated.timing(translateY, { toValue: -80, duration: 200, useNativeDriver: true }),
            Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }),
        ]).start(onDismiss);
    };

    return (
        <Animated.View style={[styles.banner, { transform: [{ translateY }], opacity }]}>
            <View style={[styles.accentBar, { backgroundColor: meta.color }]} />
            <Ionicons name="warning" size={22} color={Colors.alert.critical} />
            <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={styles.title}>Абай болыңыз! Алдыда қауіп!</Text>
                <Text style={styles.desc} numberOfLines={1}>
                    {incident.incident_type === 'crash'
                        ? 'ЖКО'
                        : incident.incident_type === 'animal'
                            ? 'Жануарлар жолда'
                            : 'Қауіпті аймақ'}
                    {incident.description ? ` — ${incident.description}` : ''}
                </Text>
            </View>
            {onViewDetail && (
                <TouchableOpacity onPress={() => onViewDetail(incident)} style={styles.detailBtn}>
                    <Text style={styles.detailBtnText}>Толығырақ</Text>
                </TouchableOpacity>
            )}
            <TouchableOpacity onPress={dismiss} style={styles.closeBtn}>
                <Ionicons name="close-circle" size={22} color={Colors.text.muted} />
            </TouchableOpacity>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    banner: {
        position: 'absolute',
        top: 140,
        left: Spacing.md,
        right: Spacing.md,
        backgroundColor: Colors.bg.secondary,
        borderRadius: Radius.lg,
        padding: Spacing.md,
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: Colors.alert.critical + '50',
        overflow: 'hidden',
        ...Shadow.card,
    },
    accentBar: {
        position: 'absolute',
        left: 0, top: 0, bottom: 0,
        width: 4,
        borderTopLeftRadius: Radius.lg,
        borderBottomLeftRadius: Radius.lg,
    },
    title: { fontSize: 14, fontWeight: '700', color: Colors.alert.critical },
    desc: { fontSize: 12, color: Colors.text.secondary, marginTop: 2 },
    detailBtn: {
        paddingHorizontal: 10, paddingVertical: 6,
        backgroundColor: Colors.brand.glow,
        borderRadius: Radius.md, marginRight: 6,
    },
    detailBtnText: { fontSize: 11, fontWeight: '700', color: Colors.brand.primary },
    closeBtn: { padding: 2 },
});
