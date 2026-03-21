/**
 * SafeRoute / Sapa Jol — App Configuration
 *
 * Единый источник конфигурации. Не хранить BACKEND_URL в colors.ts или других местах.
 * В production — переменные передаются через app.config.js extras.
 */

import Constants from 'expo-constants';

// Берём из app.json extras (если есть) или используем дефолты
const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, string>;

export const Config = {
    /**
     * REST API base URL
     *
     * Dev:        http://10.0.2.2:8000  (Android эмулятор → localhost)
     *             http://192.168.x.x:8000  (реальный телефон → IP компа)
     * Production: https://saferoute-api-ce71onrender.com  ← DEPLOYED ✅
     *
     * Переопределить: app.json extras.BACKEND_URL
     */
    BACKEND_URL: extra.BACKEND_URL ?? 'https://saferoute-api-ce7l.onrender.com',

    /** WebSocket live feed URL */
    BACKEND_WS: extra.BACKEND_WS ?? 'wss://https://saferoute-api-ce7l.onrender.com/ws/live',


    /** Polling interval for incidents (ms) */
    INCIDENTS_POLL_INTERVAL_MS: 10_000,

    /** Default proximity alert radius (km) */
    DEFAULT_PROXIMITY_RADIUS_KM: 2.0,

    /** Confirmations required to auto-resolve an incident */
    CONFIRMATIONS_TO_RESOLVE: 3,

    /** Location watch interval (ms) */
    LOCATION_INTERVAL_MS: 5_000,

    /** Location watch distance (m) */
    LOCATION_DISTANCE_M: 50,

    /** App version (for display) */
    VERSION: Constants.expoConfig?.version ?? '1.0.0',
} as const;
