/**
 * AppDialog — SafeRoute / Sapa Jol
 *
 * Кастомный диалог в стиле Nothing Phone.
 * Заменяет нативные Alert.alert() во всём приложении.
 *
 * Использование:
 *   const { showDialog, DialogComponent } = useAppDialog();
 *   // В render: {DialogComponent}
 *   // Триггер: showDialog({ title, message, buttons })
 */
import React, { useState, useCallback } from 'react';
import {
    Modal, View, Text, StyleSheet, TouchableOpacity, Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Radius } from '../constants/colors';

export interface DialogButton {
    text: string;
    onPress?: () => void;
    style?: 'default' | 'cancel' | 'destructive';
    icon?: string;
}

export interface DialogConfig {
    title: string;
    message?: string;
    icon?: string;
    iconColor?: string;
    buttons: DialogButton[];
}

interface AppDialogProps {
    config: DialogConfig | null;
    onDismiss: () => void;
}

export function AppDialog({ config, onDismiss }: AppDialogProps) {
    if (!config) return null;

    const getButtonStyle = (style?: DialogButton['style']) => {
        switch (style) {
            case 'destructive': return styles.btnDestructive;
            case 'cancel': return styles.btnCancel;
            default: return styles.btnDefault;
        }
    };

    const getButtonTextStyle = (style?: DialogButton['style']) => {
        switch (style) {
            case 'destructive': return styles.btnTextDestructive;
            case 'cancel': return styles.btnTextCancel;
            default: return styles.btnTextDefault;
        }
    };

    return (
        <Modal visible transparent animationType="fade">
            <View style={styles.overlay}>
                <View style={styles.card}>
                    {/* Icon */}
                    {config.icon && (
                        <View style={[styles.iconWrap, { backgroundColor: (config.iconColor ?? Colors.brand.primary) + '18' }]}>
                            <Ionicons
                                name={config.icon as any}
                                size={32}
                                color={config.iconColor ?? Colors.brand.primary}
                            />
                        </View>
                    )}

                    {/* Dot accent */}
                    <View style={styles.dotRow}>
                        <View style={styles.dot} />
                        <View style={[styles.dot, styles.dotMid]} />
                        <View style={styles.dot} />
                    </View>

                    {/* Title */}
                    <Text style={styles.title}>{config.title}</Text>

                    {/* Message */}
                    {config.message ? (
                        <Text style={styles.message}>{config.message}</Text>
                    ) : null}

                    {/* Divider */}
                    <View style={styles.divider} />

                    {/* Buttons */}
                    <View style={[styles.btnRow, config.buttons.length === 1 && styles.btnRowSingle]}>
                        {config.buttons.map((btn, idx) => (
                            <TouchableOpacity
                                key={idx}
                                style={[styles.btn, getButtonStyle(btn.style)]}
                                onPress={() => {
                                    onDismiss();
                                    btn.onPress?.();
                                }}
                                activeOpacity={0.75}
                            >
                                {btn.icon && (
                                    <Ionicons
                                        name={btn.icon as any}
                                        size={16}
                                        color={btn.style === 'default' ? Colors.bg.primary : btn.style === 'destructive' ? Colors.white : Colors.text.secondary}
                                        style={{ marginRight: 4 }}
                                    />
                                )}
                                <Text style={getButtonTextStyle(btn.style)}>{btn.text}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>
            </View>
        </Modal>
    );
}

/** Хук для управления диалогом */
export function useAppDialog() {
    const [config, setConfig] = useState<DialogConfig | null>(null);

    const showDialog = useCallback((cfg: DialogConfig) => {
        setConfig(cfg);
    }, []);

    const hideDialog = useCallback(() => {
        setConfig(null);
    }, []);

    const DialogComponent = <AppDialog config={config} onDismiss={hideDialog} />;

    return { showDialog, hideDialog, DialogComponent };
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.75)',
        alignItems: 'center',
        justifyContent: 'center',
        padding: Spacing.lg,
    },
    card: {
        backgroundColor: Colors.bg.secondary,
        borderRadius: Radius.xl,
        padding: Spacing.lg,
        width: '100%',
        maxWidth: 340,
        borderWidth: 1,
        borderColor: Colors.border,
        alignItems: 'center',
    },
    iconWrap: {
        width: 64,
        height: 64,
        borderRadius: Radius.lg,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: Spacing.md,
    },
    dotRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginBottom: Spacing.sm,
    },
    dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: Colors.border },
    dotMid: { backgroundColor: Colors.brand.primary, width: 6, height: 6, borderRadius: 3 },
    title: {
        fontSize: 18,
        fontWeight: '800',
        color: Colors.text.primary,
        textAlign: 'center',
        letterSpacing: -0.3,
        marginBottom: Spacing.sm,
    },
    message: {
        fontSize: 14,
        color: Colors.text.secondary,
        textAlign: 'center',
        lineHeight: 20,
        marginBottom: Spacing.md,
    },
    divider: {
        width: '100%',
        height: 1,
        backgroundColor: Colors.border,
        marginVertical: Spacing.md,
    },
    btnRow: {
        flexDirection: 'row',
        gap: Spacing.sm,
        width: '100%',
    },
    btnRowSingle: {
        flexDirection: 'column',
    },
    btn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 13,
        borderRadius: Radius.lg,
    },
    btnDefault: { backgroundColor: Colors.brand.primary },
    btnCancel: { backgroundColor: Colors.bg.tertiary, borderWidth: 1, borderColor: Colors.border },
    btnDestructive: { backgroundColor: Colors.alert.critical },
    btnTextDefault: { fontSize: 14, fontWeight: '700', color: Colors.bg.primary },
    btnTextCancel: { fontSize: 14, fontWeight: '600', color: Colors.text.secondary },
    btnTextDestructive: { fontSize: 14, fontWeight: '700', color: Colors.white },
});
