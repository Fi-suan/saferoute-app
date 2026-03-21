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
     * Dev:        http://localhost:8000   (cd backend && node server.js)
     * Production: https://saferoute-api.onrender.com  ← автоматически после деплоя
     *
     * Переопределить: app.json extras.BACKEND_URL
     */
    BACKEND_URL: extra.BACKEND_URL ?? 'https://saferoute-api.onrender.com',

    /** WebSocket live feed URL */
    BACKEND_WS: extra.BACKEND_WS ?? 'wss://saferoute-api.onrender.com/ws/live',


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
