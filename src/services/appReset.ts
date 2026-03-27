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
let _listener: Listener | null = null;

export const AppResetEvent = {
    subscribe: (fn: Listener) => {
        _listener = fn;
    },
    trigger: async () => {
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
        _listener?.();
    },
};
