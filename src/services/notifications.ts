/**
 * Push Notifications Service — SafeRoute / Sapa Jol
 *
 * ВАЖНО: В Expo Go (SDK 53+) push-уведомления (remote) не работают.
 * Локальные уведомления (scheduleProximityNotification) — работают.
 * Для полноценных push нужен development build.
 *
 * Реализован graceful fallback: все функции не кидают исключений.
 */
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import axios from 'axios';
import { Config } from '../config';
import { getDeviceId } from './deviceId';

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

/**
 * Запрашивает разрешение на локальные уведомления.
 * Remote push (FCM) в Expo Go SDK53+ не работают — не пытаемся их запросить.
 */
export async function registerForPushNotifications(): Promise<string | null> {
    if (!_notificationsSupported) return null;

    try {
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

        // Пытаемся получить Expo Push Token (только для dev builds)
        // В Expo Go — падает с ошибкой, ловим тихо
        try {
            const token = await Notifications.getExpoPushTokenAsync();
            const deviceId = await getDeviceId();
            // Отправить токен на бэкенд (тихо, не блокирует UI)
            axios.post(`${Config.BACKEND_URL}/api/v1/devices/register`, {
                device_id: deviceId,
                fcm_token: token.data,
            }, { timeout: 5000 }).catch(() => { });
            return token.data;
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
 */
export async function scheduleProximityNotification(params: {
    title: string;
    body: string;
    incidentId: number;
}): Promise<void> {
    if (!_notificationsSupported) return;
    try {
        await Notifications.scheduleNotificationAsync({
            content: {
                title: params.title,
                body: params.body,
                data: { incidentId: params.incidentId },
                sound: 'default',
            },
            trigger: null, // Немедленно
        });
    } catch {
        // Тихо игнорируем
    }
}
