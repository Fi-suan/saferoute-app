/**
 * MapFilters — сегмент-контрол фильтров (Все / Метки / Скот) поверх карты.
 *
 * Design: one rounded glass container, three equal-width segments.
 * Active segment fills green — no ragged chip row.
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Colors, Radius } from '../../constants/colors';
import { useT } from '../../i18n';
import { FilterType } from './constants';

interface MapFiltersProps {
    filter: FilterType;
    onChange: (filter: FilterType) => void;
}

export default function MapFilters({ filter, onChange }: MapFiltersProps) {
    const t = useT();
    const chips: { key: FilterType; label: string; icon: string }[] = [
        { key: 'all', label: t('filter_all'), icon: 'layers' },
        { key: 'incidents', label: t('filter_incidents'), icon: 'warning' },
        { key: 'livestock', label: t('filter_livestock'), icon: 'paw' },
    ];

    return (
        <View style={styles.segment}>
            {chips.map((f) => {
                const active = filter === f.key;
                return (
                    <TouchableOpacity
                        key={f.key}
                        style={[styles.segBtn, active && styles.segBtnActive]}
                        onPress={() => {
                            Haptics.selectionAsync();
                            onChange(f.key);
                        }}
                        activeOpacity={0.8}
                    >
                        <Ionicons
                            name={f.icon as any}
                            size={15}
                            color={active ? Colors.bg.primary : Colors.text.secondary}
                        />
                        <Text style={[styles.segBtnText, active && styles.segBtnTextActive]}>
                            {f.label}
                        </Text>
                    </TouchableOpacity>
                );
            })}
        </View>
    );
}

const styles = StyleSheet.create({
    segment: {
        flexDirection: 'row',
        alignSelf: 'flex-start',
        backgroundColor: 'rgba(8, 10, 14, 0.92)',
        borderRadius: Radius.lg,
        padding: 4,
        borderWidth: 1,
        borderColor: Colors.border,
        gap: 3,
    },
    segBtn: {
        flex: 0,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 9,
        paddingHorizontal: 14,
        borderRadius: Radius.md,
    },
    segBtnActive: { backgroundColor: Colors.brand.primary },
    segBtnText: { fontSize: 13, fontWeight: '700', color: Colors.text.secondary },
    segBtnTextActive: { color: Colors.bg.primary },
});
