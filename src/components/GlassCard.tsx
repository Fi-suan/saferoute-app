/**
 * GlassCard — Nothing Phone frosted glass card.
 *
 * Uses expo-blur BlurView on supported platforms, falls back to
 * a semi-transparent View on Android versions without blur support.
 */
import React from 'react';
import { View, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { BlurView } from 'expo-blur';
import { Colors, Radius, Shadow } from '../constants/colors';

interface Props {
    children: React.ReactNode;
    style?: StyleProp<ViewStyle>;
    intensity?: number;
    noBorder?: boolean;
    noShadow?: boolean;
    tint?: 'dark' | 'light' | 'default';
}

export default function GlassCard({
    children,
    style,
    intensity = 40,
    noBorder = false,
    noShadow = false,
    tint = 'dark',
}: Props) {
    return (
        <BlurView
            intensity={intensity}
            tint={tint}
            style={[
                styles.card,
                !noBorder && styles.border,
                !noShadow && Shadow.card,
                style,
            ]}
        >
            {/* Inner fill layer for glass color */}
            <View style={styles.fill}>{children}</View>
        </BlurView>
    );
}

const styles = StyleSheet.create({
    card: {
        borderRadius: Radius.lg,
        overflow: 'hidden',
        backgroundColor: Colors.bg.glass,
    },
    border: {
        borderWidth: 1,
        borderColor: Colors.border,
    },
    fill: {
        flex: 1,
        backgroundColor: Colors.bg.glass,
    },
});
