/**
 * Toast — SafeRoute / Sapa Jol
 *
 * Lightweight bottom toast (slide up + fade out) for non-blocking feedback,
 * e.g. after submitting a report. Use via useToast() hook.
 */
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Radius, Shadow } from '../constants/colors';

interface ToastMessage {
    text: string;
    icon?: string;
    color?: string;
}

export function useToast() {
    const [toast, setToast] = useState<ToastMessage | null>(null);
    const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const showToast = useCallback((msg: ToastMessage) => {
        if (hideTimer.current) clearTimeout(hideTimer.current);
        setToast(msg);
        hideTimer.current = setTimeout(() => setToast(null), 2600);
    }, []);

    useEffect(() => {
        return () => {
            if (hideTimer.current) clearTimeout(hideTimer.current);
        };
    }, []);

    const ToastComponent = <Toast message={toast} />;

    return { showToast, ToastComponent };
}

function Toast({ message }: { message: ToastMessage | null }) {
    const anim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.timing(anim, {
            toValue: message ? 1 : 0,
            duration: 220,
            useNativeDriver: true,
        }).start();
    }, [message, anim]);

    if (!message) return null;

    const translateY = anim.interpolate({
        inputRange: [0, 1],
        outputRange: [60, 0],
    });

    return (
        <Animated.View
            pointerEvents="none"
            style={[styles.toast, { opacity: anim, transform: [{ translateY }] }]}
        >
            <Ionicons
                name={(message.icon ?? 'checkmark-circle') as any}
                size={18}
                color={message.color ?? Colors.brand.primary}
            />
            <Text style={styles.text}>{message.text}</Text>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    toast: {
        position: 'absolute',
        bottom: 118,
        alignSelf: 'center',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: 'rgba(15, 15, 15, 0.96)',
        borderWidth: 1,
        borderColor: Colors.border,
        borderRadius: Radius.full,
        paddingHorizontal: 16,
        paddingVertical: 11,
        maxWidth: 320,
        ...Shadow.card,
    },
    text: {
        color: Colors.text.primary,
        fontSize: 13.5,
        fontWeight: '600',
        flexShrink: 1,
    },
});
