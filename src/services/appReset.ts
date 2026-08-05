/**
 * appReset — глобальный событийный модуль для выхода из аккаунта.
 *
 * App.tsx подписывается через AppResetEvent.subscribe().
 * ProfileScreen вызывает AppResetEvent.trigger() после очистки storage.
 *
 * Паттерн: module-level singleton без зависимостей.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE } from '../constants/storage';

type Listener = () => void;
const _listeners = new Set<Listener>();

export const AppResetEvent = {
    subscribe: (fn: Listener) => {
        _listeners.add(fn);
        return () => { _listeners.delete(fn); };
    },
    trigger: async () => {
        // Гасим фоновые повторы регистрации — иначе после логаута они
        // перерегистрируют устройство со старой ролью.
        try {
            const { stopRegistrationRetry } = await import('./registration');
            stopRegistrationRetry();
        } catch { /* ignore */ }

        // Clear auth token
        try {
            const { backendLogout } = await import('./auth');
            await backendLogout();
        } catch { /* ignore */ }

        // Clear local storage
        await AsyncStorage.multiRemove([
            STORAGE.ONBOARDING_DONE,
            STORAGE.USER_PROFILE,
            STORAGE.ACTIVE_ROUTE,
            STORAGE.ROUTE_MODE,
            STORAGE.REPORT_QUEUE,
        ]);
        _listeners.forEach(fn => fn());
    },
};
