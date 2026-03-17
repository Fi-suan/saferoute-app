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
import { Colors, Radius } from '../constants/colors';

const Tab = createBottomTabNavigator();

const TABS = [
    { name: 'Map', label: 'Карта', icon: 'map', screen: MapScreen },
    { name: 'Alerts', label: 'Белгілер', icon: 'warning', screen: AlertsScreen },
    { name: 'Profile', label: 'Профиль', icon: 'person-circle', screen: ProfileScreen },
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
    return (
        <Tab.Navigator
            screenOptions={{
                headerShown: false,
                tabBarStyle: styles.tabBar,
                tabBarShowLabel: false,   // Nothing-style: без подписей
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
        height: 64,
        paddingBottom: 0,
        paddingTop: 0,
    },
    iconContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        height: 64,
        paddingTop: 8,
        gap: 4,
    },
    // Nothing Phone style: крошечная точка вместо highlight-background
    activeDot: {
        width: 4,
        height: 4,
        borderRadius: 2,
        backgroundColor: Colors.brand.primary,
    },
});
