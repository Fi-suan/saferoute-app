/**
 * AsyncStorage / SecureStore key constants
 * Используем enum-подобный объект чтобы не было магических строк по всему коду.
 */
export const STORAGE = {
    ONBOARDING_DONE: 'saferoute:onboarding_done',
    DEVICE_ID: 'saferoute:device_id',
    SOUND_ENABLED: 'saferoute:settings:sound',
    VIBRATION_ENABLED: 'saferoute:settings:vibration',
    PROXIMITY_RADIUS_KM: 'saferoute:settings:proximity_radius',
    LANGUAGE: 'saferoute:settings:language',
    REPORT_QUEUE: 'saferoute:offline:report_queue',
    ROUTE_MODE: 'saferoute:route:mode',
    TRIP_HISTORY: 'saferoute:trip:history',
} as const;

export type StorageKey = (typeof STORAGE)[keyof typeof STORAGE];
