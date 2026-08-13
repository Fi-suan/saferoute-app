/**
 * MapFilters — чипы фильтров (Все / Инциденты / Скот) поверх карты.
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Colors, Spacing, Radius } from '../../constants/colors';
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
        <View style={styles.filterRow}>
            {chips.map((f) => (
                <TouchableOpacity
                    key={f.key}
                    style={[styles.filterChip, filter === f.key && styles.filterChipActive]}
                    onPress={() => {
                        Haptics.selectionAsync();
                        onChange(f.key);
                    }}
                >
                    <Ionicons
                        name={f.icon as any}
                        size={13}
                        color={filter === f.key ? Colors.bg.primary : Colors.text.secondary}
                    />
                    <Text
                        style={[
                            styles.filterChipText,
                            filter === f.key && styles.filterChipTextActive,
                        ]}
                    >
                        {f.label}
                    </Text>
                </TouchableOpacity>
            ))}
        </View>
    );
}

const styles = StyleSheet.create({
    filterRow: {
        position: 'absolute',
        top: 142,
        left: Spacing.md,
        right: Spacing.md,
        flexDirection: 'row',
        gap: 8,
    },
    filterChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: Radius.sm,
        backgroundColor: 'rgba(0,0,0,0.85)',
        borderWidth: 1,
        borderColor: Colors.border,
    },
    filterChipActive: { backgroundColor: Colors.brand.primary, borderColor: Colors.brand.primary },
    filterChipText: { fontSize: 12, fontWeight: '600', color: Colors.text.secondary },
    filterChipTextActive: { color: Colors.bg.primary },
});
