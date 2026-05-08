/**
 * TabNavigator — SafeRoute / Sapa Jol
 *
 * Nothing Phone стиль: minimal tab bar
 * - Активная вкладка: маленькая зелёная точка снизу (не жирный bg)
 * - Иконки тонкие outline → filled при активации
 * - Без label (чисто иконки) — минимализм
 * - Тонкая линия вверху вместо полноразмерного border
 *
 * Вкладки: Карта | Белгілер | Профиль
 *
 * 🎨 ANIMATION_SLOT: tab_switch — Reanimated анимация смены вкладки (scale + fade)
 * 🎨 ANIMATION_SLOT: tab_dot — spring-анимация появления активной точки
 */
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import MapScreen from '../screens/MapScreen';
import AlertsScreen from '../screens/AlertsScreen';
import ProfileScreen from '../screens/ProfileScreen';
import ErrorBoundary from '../components/ErrorBoundary';
import { Colors, Radius } from '../constants/colors';
import { useT } from '../i18n';
import { reportError } from '../services/sentry';
import type { TranslationKey } from '../i18n/translations';

const Tab = createBottomTabNavigator();

// Wrap each screen so a crash isolates to that tab.
const withBoundary = (Screen: React.ComponentType<any>) => (props: any) =>
    <ErrorBoundary onError={reportError}><Screen {...props} /></ErrorBoundary>;

const MapScreenSafe = withBoundary(MapScreen);
const AlertsScreenSafe = withBoundary(AlertsScreen);
const ProfileScreenSafe = withBoundary(ProfileScreen);

interface TabDef {
    name: string;
    labelKey: TranslationKey;
    icon: string;
    screen: React.ComponentType<any>;
}

const TABS: TabDef[] = [
    { name: 'Map', labelKey: 'tab_map', icon: 'map', screen: MapScreenSafe },
    { name: 'Alerts', labelKey: 'tab_alerts', icon: 'warning', screen: AlertsScreenSafe },
    { name: 'Profile', labelKey: 'tab_profile', icon: 'person-circle', screen: ProfileScreenSafe },
];

function TabIcon({ name, focused, color }: { name: string; focused: boolean; color: string }) {
    return (
        // 🎨 ANIMATION_SLOT: tab_switch — оберни в Animated.View
        <View style={styles.iconContainer}>
            <Ionicons
                name={focused ? (name as any) : (`${name}-outline` as any)}
                size={24}
                color={color}
            />
            {/* 🎨 ANIMATION_SLOT: tab_dot — spring-bounce при появлении */}
            {focused && <View style={styles.activeDot} />}
        </View>
    );
}

export default function TabNavigator() {
    const t = useT();
    return (
        <Tab.Navigator
            screenOptions={{
                headerShown: false,
                tabBarStyle: styles.tabBar,
                tabBarShowLabel: true,
                tabBarLabelStyle: { fontSize: 10, fontWeight: '600', marginTop: -2 },
                tabBarActiveTintColor: Colors.brand.primary,
                tabBarInactiveTintColor: Colors.text.muted,
            }}
        >
            {TABS.map((tab) => (
                <Tab.Screen
                    key={tab.name}
                    name={tab.name}
                    component={tab.screen}
                    options={{
                        tabBarLabel: t(tab.labelKey),
                        tabBarIcon: ({ focused, color }) => (
                            <TabIcon name={tab.icon} focused={focused} color={color} />
                        ),
                    }}
                />
            ))}
        </Tab.Navigator>
    );
}

const styles = StyleSheet.create({
    tabBar: {
        backgroundColor: Colors.bg.secondary,
        borderTopWidth: 1,
        borderTopColor: Colors.border,
        height: 72,
        paddingBottom: 8,
        paddingTop: 6,
    },
    iconContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        gap: 3,
    },
    // Nothing Phone style: крошечная точка вместо highlight-background
    activeDot: {
        width: 4,
        height: 4,
        borderRadius: 2,
        backgroundColor: Colors.brand.primary,
    },
});
