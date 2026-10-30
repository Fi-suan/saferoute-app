/**
 * AppDialog — SafeRoute / Sapa Jol
 *
 * Native-alert style custom dialog: icon chip, bold title, message, and a
 * vertically stacked button list separated by hairlines (like iOS alerts).
 * Text buttons read clearly — no full-width colored bars.
 *
 * Usage:
 *   const { showDialog, DialogComponent } = useAppDialog();
 *   // In render: {DialogComponent}
 *   showDialog({ title, message, buttons })
 */
import React, { useState, useCallback } from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity } from 'react-native';
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

const ACCENT: Record<NonNullable<DialogButton['style']>, string> = {
    default: Colors.brand.primary,
    cancel: Colors.text.secondary,
    destructive: Colors.alert.critical,
};

export function AppDialog({ config, onDismiss }: AppDialogProps) {
    if (!config) return null;

    return (
        <Modal visible transparent animationType="fade" onRequestClose={onDismiss}>
            <View style={styles.overlay}>
                <View style={styles.card}>
                    {config.icon && (
                        <View
                            style={[
                                styles.iconChip,
                                {
                                    backgroundColor:
                                        (config.iconColor ?? Colors.brand.primary) + '18',
                                },
                            ]}
                        >
                            <Ionicons
                                name={config.icon as any}
                                size={26}
                                color={config.iconColor ?? Colors.brand.primary}
                            />
                        </View>
                    )}

                    <Text style={styles.title}>{config.title}</Text>

                    {config.message ? <Text style={styles.message}>{config.message}</Text> : null}

                    <View style={styles.buttonList}>
                        {config.buttons.map((btn, idx) => (
                            <React.Fragment key={idx}>
                                {idx > 0 && <View style={styles.hairline} />}
                                <TouchableOpacity
                                    style={styles.buttonRow}
                                    onPress={() => {
                                        onDismiss();
                                        btn.onPress?.();
                                    }}
                                    activeOpacity={0.6}
                                >
                                    {btn.icon && (
                                        <Ionicons
                                            name={btn.icon as any}
                                            size={17}
                                            color={ACCENT[btn.style ?? 'default']}
                                            style={{ marginRight: 7 }}
                                        />
                                    )}
                                    <Text
                                        style={[
                                            styles.buttonText,
                                            { color: ACCENT[btn.style ?? 'default'] },
                                            btn.style !== 'cancel' && styles.buttonTextBold,
                                        ]}
                                        numberOfLines={1}
                                    >
                                        {btn.text}
                                    </Text>
                                </TouchableOpacity>
                            </React.Fragment>
                        ))}
                    </View>
                </View>
            </View>
        </Modal>
    );
}

/** Hook for dialog state management */
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
        backgroundColor: 'rgba(0,0,0,0.72)',
        alignItems: 'center',
        justifyContent: 'center',
        padding: Spacing.xl,
    },
    card: {
        backgroundColor: Colors.bg.secondary,
        borderRadius: Radius.xl + 2,
        width: '100%',
        maxWidth: 320,
        borderWidth: 1,
        borderColor: Colors.border,
        alignItems: 'center',
        paddingTop: Spacing.lg,
        overflow: 'hidden',
    },
    iconChip: {
        width: 56,
        height: 56,
        borderRadius: Radius.lg,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: Spacing.md,
    },
    title: {
        fontSize: 17,
        fontWeight: '800',
        color: Colors.text.primary,
        textAlign: 'center',
        letterSpacing: -0.2,
        marginBottom: Spacing.sm,
        paddingHorizontal: Spacing.lg,
    },
    message: {
        fontSize: 13.5,
        color: Colors.text.secondary,
        textAlign: 'center',
        lineHeight: 19,
        marginBottom: Spacing.lg,
        paddingHorizontal: Spacing.lg,
    },
    buttonList: {
        width: '100%',
        borderTopWidth: 1,
        borderTopColor: Colors.divider,
    },
    hairline: {
        width: '100%',
        height: 1,
        backgroundColor: Colors.divider,
    },
    buttonRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        paddingHorizontal: Spacing.md,
    },
    buttonText: {
        fontSize: 14,
        fontWeight: '500',
    },
    buttonTextBold: {
        fontWeight: '700',
    },
});
