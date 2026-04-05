/**
 * Push Notifications Service — SafeRoute / Sapa Jol
 *
 * ВАЖНО: В Expo Go (SDK 53+) push-уведомления (remote) не работают.
 * Локальные уведомления (scheduleProximityNotification) — работают.
 * Для полноценных push нужен development build.
 *
 * Реализован graceful fallback: все функции не кидают исключений.
 */
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { getDeviceId } from './deviceId';
import { registerDevice } from './api';
import { storeAuthToken } from './auth';

// Флаг: поддерживаются ли уведомления в текущей среде
let _notificationsSupported = true;

// Настройка показа уведомлений когда приложение ОТКРЫТО
try {
    Notifications.setNotificationHandler({
        handleNotification: async () => ({
            shouldShowAlert: true,
            shouldPlaySound: true,
            shouldSetBadge: false,
            shouldShowBanner: true,
            shouldShowList: true,
        }),
    });
} catch {
    _notificationsSupported = false;
}

async function registerAndStoreToken(role: string, fcmToken?: string): Promise<void> {
    const deviceId = await getDeviceId();
    try {
        const res = await registerDevice({
            device_id: deviceId,
            role,
            fcm_token: fcmToken,
        });
        if (res?.token) {
            await storeAuthToken(res.token);
        }
    } catch (e) {
        console.warn('[Notifications] registerAndStoreToken failed:', e);
    }
}

/**
 * Запрашивает разрешение на локальные уведомления.
 * Remote push (FCM) в Expo Go SDK53+ не работают — не пытаемся их запросить.
 */
export async function registerForPushNotifications(role: string = 'driver'): Promise<string | null> {
    if (!_notificationsSupported) return null;

    try {
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;

        if (existingStatus !== 'granted') {
            const { status } = await Notifications.requestPermissionsAsync();
            finalStatus = status;
        }

        if (finalStatus !== 'granted') {
            _notificationsSupported = false;
            return null;
        }

        // Для Android — создаём канал (нужен для локальных тоже)
        if (Platform.OS === 'android') {
            await Notifications.setNotificationChannelAsync('saferoute-alerts', {
                name: 'SafeRoute Alerts',
                importance: Notifications.AndroidImportance.HIGH,
                vibrationPattern: [0, 250, 250, 250],
                lightColor: '#2ECC71',
                sound: 'default',
            });
        }

        // Пытаемся получить Expo Push Token (только для dev builds)
        if (Constants.appOwnership === 'expo') {
            console.log("[Notifications] Expo Go detected: bypassing remote push (SDK 53 limit). Local notifications work.");
            await registerAndStoreToken(role);
            return null;
        }

        try {
            const pushToken = await Notifications.getExpoPushTokenAsync();
            await registerAndStoreToken(role, pushToken.data);
            return pushToken.data;
        } catch {
            // Expo Go без EAS — токен недоступен, но локальные уведомления работают
            return null;
        }
    } catch {
        _notificationsSupported = false;
        return null;
    }
}

/**
 * Локальное уведомление о proximity-инциденте.
 * Работает В EXPO GO. Показывается немедленно.
 * Уважает настройки sound/vibration из AsyncStorage.
 */
export async function scheduleProximityNotification(params: {
    title: string;
    body: string;
    incidentId: number;
    soundEnabled?: boolean;
}): Promise<void> {
    if (!_notificationsSupported) return;
    const sound = params.soundEnabled !== false;
    try {
        await Notifications.scheduleNotificationAsync({
            content: {
                title: params.title,
                body: params.body,
                data: { incidentId: params.incidentId },
                sound: sound ? 'default' : undefined,
            },
            trigger: null, // Немедленно
        });
    } catch (e) {
        console.warn('[Notifications] scheduleProximityNotification failed:', e);
    }
}
