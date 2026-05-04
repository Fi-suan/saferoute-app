/**
 * ErrorBoundary — изолирует крэши на уровне поддерева React.
 *
 * Позволяет приложению пережить ошибку в одном экране
 * (карте, профиле, оповещениях) без падения всего root.
 *
 * Логгирование: console.error + опциональный onError-колбэк
 * (в будущем — точка интеграции Sentry / Crashlytics).
 */
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Radius } from '../constants/colors';

interface Props {
    children: React.ReactNode;
    /** Текст-заголовок, опц. — иначе встроенный (kk) */
    title?: string;
    /** Кнопка "Повторить" — опц. */
    retryLabel?: string;
    /** Колбэк для внешнего логгирования (Sentry и т.п.) */
    onError?: (error: Error, info: React.ErrorInfo) => void;
}

interface State {
    error: Error | null;
}

export default class ErrorBoundary extends React.Component<Props, State> {
    state: State = { error: null };

    static getDerivedStateFromError(error: Error): State {
        return { error };
    }

    componentDidCatch(error: Error, info: React.ErrorInfo): void {
        // Console для разработки, hook для прод-логгера
        // eslint-disable-next-line no-console
        console.error('[ErrorBoundary]', error, info.componentStack);
        this.props.onError?.(error, info);
    }

    reset = () => this.setState({ error: null });

    render() {
        if (!this.state.error) return this.props.children;

        return (
            <View style={styles.wrap}>
                <View style={styles.iconBox}>
                    <Ionicons name="warning" size={32} color={Colors.alert.critical} />
                </View>
                <Text style={styles.title}>{this.props.title ?? 'Қате орын алды'}</Text>
                <Text style={styles.message}>
                    {this.state.error.message || 'Белгісіз қате'}
                </Text>
                <TouchableOpacity style={styles.button} onPress={this.reset}>
                    <Ionicons name="refresh" size={18} color={Colors.bg.primary} />
                    <Text style={styles.buttonText}>{this.props.retryLabel ?? 'Қайталау'}</Text>
                </TouchableOpacity>
            </View>
        );
    }
}

const styles = StyleSheet.create({
    wrap: {
        flex: 1,
        backgroundColor: Colors.bg.primary,
        alignItems: 'center',
        justifyContent: 'center',
        padding: Spacing.xl,
    },
    iconBox: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: Colors.alert.critical + '18',
        borderWidth: 1,
        borderColor: Colors.alert.critical + '40',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: Spacing.lg,
    },
    title: {
        fontSize: 20,
        fontWeight: '700',
        color: Colors.text.primary,
        marginBottom: Spacing.sm,
        textAlign: 'center',
    },
    message: {
        fontSize: 14,
        color: Colors.text.secondary,
        textAlign: 'center',
        marginBottom: Spacing.xl,
        maxWidth: 320,
        lineHeight: 20,
    },
    button: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: Colors.brand.primary,
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.md,
        borderRadius: Radius.md,
    },
    buttonText: {
        fontSize: 15,
        fontWeight: '700',
        color: Colors.bg.primary,
    },
});
