/**
 * AsyncStorage / SecureStore key constants
 * Единый источник — нет магических строк по всему коду.
 *
 * УДАЛЕНО:
 *  - USER_ROLE       → роль теперь часть USER_PROFILE (единый источник правды)
 *  - PROXIMITY_RADIUS_KM → радиус захардкожен в Config.DEFAULT_PROXIMITY_RADIUS_KM
 */
export const STORAGE = {
    ONBOARDING_DONE: 'saferoute:onboarding_done',
    DEVICE_ID: 'saferoute:device_id',
    SOUND_ENABLED: 'saferoute:settings:sound',
    VIBRATION_ENABLED: 'saferoute:settings:vibration',
    LANGUAGE: 'saferoute:settings:language',
    REPORT_QUEUE: 'saferoute:offline:report_queue',
    ROUTE_MODE: 'saferoute:route:mode',
    TRIP_HISTORY: 'saferoute:trip:history',
    /** Полный профиль пользователя (имя, телефон, роль, статистика) */
    USER_PROFILE: 'saferoute:user:profile',
} as const;

export type StorageKey = (typeof STORAGE)[keyof typeof STORAGE];
