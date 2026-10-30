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

    BACKEND_URL: extra.BACKEND_URL ?? 'http://192.168.8.252:8000',

    /** Supabase credentials for direct Realtime subscriptions */
    SUPABASE_URL: extra.SUPABASE_URL ?? 'https://iqgawigwaempfnwtqovy.supabase.co',
    SUPABASE_ANON_KEY: extra.SUPABASE_ANON_KEY ?? 'sb_publishable_mtjnCty0nl-EXsssgG0BUg_k0wZtT90',

    /** Polling interval for incidents (ms) — 4s for contest demo */
    INCIDENTS_POLL_INTERVAL_MS: 4_000,

    /** Default proximity alert radius (km) */
    DEFAULT_PROXIMITY_RADIUS_KM: 2.0,

    /** Confirmations required to auto-resolve an incident */
    CONFIRMATIONS_TO_RESOLVE: 3,

    /** Location watch interval (ms) */
    LOCATION_INTERVAL_MS: 5_000,

    /** Location watch distance (m) */
    LOCATION_DISTANCE_M: 50,

    /** Google Maps SDK key (restricted by package name, used only for map rendering) */
    GOOGLE_MAPS_API_KEY: extra.googleMapsApiKey ?? '',

    /** App version (for display) */
    VERSION: Constants.expoConfig?.version ?? '1.0.0',
} as const;
