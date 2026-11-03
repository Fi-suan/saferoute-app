/**
 * Notifications Service — SafeRoute / Sapa Zhol
 *
 * expo-notifications is loaded LAZILY (on first use) so it never sits on the
 * critical startup path. In Expo Go its import triggers a deprecation error
 * about removed remote push (SDK 53+); local notifications still work, so we
 * keep them and simply avoid the module until a notification is really needed.
 *
 * Remote push (FCM) only works in dev/production builds — never requested in Expo Go.
 */
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { getDeviceId } from './deviceId';
import { updateFcmToken } from './api';

type NotificationsModule = typeof import('expo-notifications');

let _module: NotificationsModule | null = null;
let _handlerReady = false;
let _notificationsSupported = true;

/** Lazy-load expo-notifications and set the foreground handler once. */
async function getNotifications(): Promise<NotificationsModule | null> {
    if (!_notificationsSupported) return null;
    if (!_module) {
        try {
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            _module = require('expo-notifications');
        } catch {
            _notificationsSupported = false;
            return null;
        }
    }
    if (!_handlerReady) {
        _handlerReady = true;
        try {
            const mod = _module;
            if (!mod) return null;
            mod.setNotificationHandler({
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
            return null;
        }
    }
    return _module;
}

async function registerAndStoreToken(role: string, fcmToken?: string): Promise<void> {
    // Только обновляем токен: роль/телефон/имя трогать нельзя (fix из миграции 007)
    const deviceId = await getDeviceId();
    if (!fcmToken) return;
    try {
        await updateFcmToken(deviceId, fcmToken);
    } catch (e) {
        console.warn('[Notifications] registerAndStoreToken failed:', e);
    }
}

/**
 * Requests local notification permission + (outside Expo Go) a push token.
 * Safe to call in any environment — degrades to null silently.
 */
export async function registerForPushNotifications(
    role: string = 'driver',
): Promise<string | null> {
    const Notifications = await getNotifications();
    if (!Notifications) return null;

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

        // Android needs a channel for local notifications too
        if (Platform.OS === 'android') {
            await Notifications.setNotificationChannelAsync('saferoute-alerts', {
                name: 'SafeRoute Alerts',
                importance: Notifications.AndroidImportance.HIGH,
                vibrationPattern: [0, 250, 250, 250],
                lightColor: '#2ECC71',
                sound: 'default',
            });
        }

        // Expo Go: remote push removed since SDK 53 — keep local notifications only
        if (Constants.appOwnership === 'expo') {
            return null;
        }

        try {
            const pushToken = await Notifications.getExpoPushTokenAsync();
            await registerAndStoreToken(role, pushToken.data);
            return pushToken.data;
        } catch {
            return null;
        }
    } catch {
        _notificationsSupported = false;
        return null;
    }
}

/**
 * Local notification about a proximity incident.
 * Works in Expo Go. Shows immediately. Respects sound settings.
 */
export async function scheduleProximityNotification(params: {
    title: string;
    body: string;
    incidentId: number;
    soundEnabled?: boolean;
}): Promise<void> {
    const Notifications = await getNotifications();
    if (!Notifications) return;
    const sound = params.soundEnabled !== false;
    try {
        await Notifications.scheduleNotificationAsync({
            content: {
                title: params.title,
                body: params.body,
                data: { incidentId: params.incidentId },
                sound: sound ? 'default' : undefined,
            },
            trigger: null, // immediately
        });
    } catch (e) {
        console.warn('[Notifications] scheduleProximityNotification failed:', e);
    }
}
