/**
 * AlertsScreen — SafeRoute / Sapa Jol (REFACTORED)
 *
 * Использует:
 * - Переиспользуемый IncidentCard (убрано дублирование кода с MapScreen)
 * - useIncidents хук (единый источник данных)
 * - Навигация к IncidentDetailScreen при тапе на карточку
 */
import React, { useState } from 'react';
import {
    View, Text, StyleSheet, FlatList,
    TouchableOpacity, RefreshControl, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, CompositeNavigationProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { Colors, Spacing, Radius } from '../constants/colors';
import { Incident } from '../constants/incidents';
import { useIncidents } from '../hooks/useIncidents';
import IncidentCard from '../components/IncidentCard';
import { RootStackParamList } from '../navigation/RootNavigator';

// Составной тип: Tab экран + выход в Root Stack
type NavProp = CompositeNavigationProp<
    BottomTabNavigationProp<Record<string, undefined>>,
    NativeStackNavigationProp<RootStackParamList>
>;

export default function AlertsScreen() {
    const navigation = useNavigation<NavProp>();
    const [activeTab, setActiveTab] = useState<'active' | 'all'>('active');
    const { incidents, loading, refreshing, refresh, pendingReportsCount } = useIncidents(activeTab);

    const handleCardPress = (incident: Incident) => {
        if (navigation.canGoBack !== undefined || true) {
            navigation.navigate('IncidentDetail', { incident });
        }
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            {/* Header */}
            <View style={styles.header}>
                <View>
                    <Text style={styles.headerTitle}>Инциденттер</Text>
                    <Text style={styles.headerSub}>
                        {incidents.length} {activeTab === 'active' ? 'белсенді' : 'барлығы'}
                        {pendingReportsCount > 0 && ` · ${pendingReportsCount} жіберілуде`}
                    </Text>
                </View>
                <View style={[styles.onlineBadge, { backgroundColor: Colors.brand.glow }]}>
                    <Ionicons name="shield-checkmark" size={14} color={Colors.brand.primary} />
                    <Text style={styles.onlineBadgeText}>A-17</Text>
                </View>
            </View>

            {/* Tabs */}
            <View style={styles.tabs}>
                {(['active', 'all'] as const).map((t) => (
                    <TouchableOpacity
                        key={t}
                        style={[styles.tab, activeTab === t && styles.tabActive]}
                        onPress={() => setActiveTab(t)}
                    >
                        <Ionicons
                            name={t === 'active' ? 'alert-circle' : 'time'}
                            size={16}
                            color={activeTab === t ? Colors.brand.primary : Colors.text.muted}
                        />
                        <Text style={[styles.tabText, activeTab === t && styles.tabTextActive]}>
                            {t === 'active' ? 'Белсенді' : 'Барлығы'}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            {/* List */}
            {loading ? (
                <View style={styles.centered}>
                    <ActivityIndicator size="large" color={Colors.brand.primary} />
                </View>
            ) : (
                <FlatList
                    data={incidents}
                    keyExtractor={(item) => String(item.id)}
                    renderItem={({ item }) => (
                        <IncidentCard item={item} onPress={handleCardPress} />
                    )}
                    contentContainerStyle={styles.list}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={refresh}
                            tintColor={Colors.brand.primary}
                            colors={[Colors.brand.primary]}
                        />
                    }
                    ListEmptyComponent={
                        <View style={styles.centered}>
                            <Ionicons name="shield-checkmark" size={48} color={Colors.brand.primary} />
                            <Text style={styles.emptyText}>Инцидент жоқ</Text>
                            <Text style={styles.emptySubtext}>Жол таза! Барыңызда сою болсын.</Text>
                        </View>
                    }
                />
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.bg.primary },
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: Spacing.md, paddingTop: Spacing.md, paddingBottom: Spacing.sm,
    },
    headerTitle: { fontSize: 24, fontWeight: '800', color: Colors.text.primary },
    headerSub: { fontSize: 13, color: Colors.text.muted, marginTop: 2 },
    onlineBadge: {
        flexDirection: 'row', alignItems: 'center', gap: 4,
        paddingHorizontal: 10, paddingVertical: 5, borderRadius: Radius.full,
    },
    onlineBadgeText: { fontSize: 11, fontWeight: '700', color: Colors.brand.primary },
    tabs: {
        flexDirection: 'row', marginHorizontal: Spacing.md, marginBottom: Spacing.sm,
        backgroundColor: Colors.bg.secondary, borderRadius: Radius.lg,
        padding: 4, borderWidth: 1, borderColor: Colors.border,
    },
    tab: {
        flex: 1, flexDirection: 'row', alignItems: 'center',
        justifyContent: 'center', paddingVertical: 10, borderRadius: Radius.md, gap: 6,
    },
    tabActive: { backgroundColor: Colors.bg.tertiary },
    tabText: { fontSize: 14, fontWeight: '600', color: Colors.text.muted },
    tabTextActive: { color: Colors.brand.primary },
    list: { paddingHorizontal: Spacing.md, paddingBottom: 100 },
    centered: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
    emptyText: { fontSize: 18, fontWeight: '600', color: Colors.text.primary, marginTop: Spacing.md },
    emptySubtext: { fontSize: 14, color: Colors.text.muted, marginTop: 4 },
});
