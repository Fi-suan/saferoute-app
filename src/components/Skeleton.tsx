/**
 * Skeleton — пульсирующий placeholder для лоадинга.
 *
 * Используется вместо голого ActivityIndicator: даёт ощущение
 * прогресса и сохраняет визуальную структуру экрана.
 */
import React, { useEffect, useRef } from 'react';
import { Animated, View, StyleSheet, ViewStyle } from 'react-native';
import { Colors, Radius, Spacing } from '../constants/colors';

interface SkeletonProps {
    width?: number | `${number}%`;
    height?: number;
    radius?: number;
    style?: ViewStyle;
}

export function Skeleton({ width = '100%', height = 16, radius = Radius.sm, style }: SkeletonProps) {
    const opacity = useRef(new Animated.Value(0.5)).current;

    useEffect(() => {
        const loop = Animated.loop(
            Animated.sequence([
                Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
                Animated.timing(opacity, { toValue: 0.5, duration: 700, useNativeDriver: true }),
            ]),
        );
        loop.start();
        return () => loop.stop();
    }, [opacity]);

    return (
        <Animated.View
            style={[
                {
                    width: width as any,
                    height,
                    borderRadius: radius,
                    backgroundColor: Colors.bg.tertiary,
                    opacity,
                },
                style,
            ]}
        />
    );
}

/** Skeleton-карточка инцидента (соответствует IncidentCard) */
export function IncidentCardSkeleton() {
    return (
        <View style={styles.card}>
            <Skeleton width={44} height={44} radius={Radius.md} />
            <View style={styles.body}>
                <Skeleton width="60%" height={14} />
                <Skeleton width="40%" height={11} style={{ marginTop: 8 }} />
            </View>
            <Skeleton width={50} height={20} radius={Radius.full} />
        </View>
    );
}

/** Список из N skeleton-карточек */
export function IncidentListSkeleton({ count = 5 }: { count?: number }) {
    return (
        <View style={styles.list}>
            {Array.from({ length: count }).map((_, i) => (
                <IncidentCardSkeleton key={i} />
            ))}
        </View>
    );
}

const styles = StyleSheet.create({
    list: { paddingHorizontal: Spacing.md, gap: Spacing.sm, paddingTop: Spacing.xs },
    card: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.md,
        backgroundColor: Colors.bg.secondary,
        borderRadius: Radius.lg,
        padding: Spacing.md,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    body: { flex: 1, gap: 4 },
});
