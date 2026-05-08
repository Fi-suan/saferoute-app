/**
 * Sentry — error monitoring & crash reporting.
 *
 * Wrapped in a thin module so the rest of the app doesn't import Sentry directly.
 * If SENTRY_DSN is not configured, all calls are no-ops (safe in dev).
 *
 * Usage:
 *   - call `initSentry()` once at app startup (App.tsx)
 *   - `reportError(error, info)` is called automatically by ErrorBoundary
 *   - `setUserContext({ deviceId, role })` after onboarding
 */
import Constants from 'expo-constants';
import type { ErrorInfo } from 'react';

const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, string>;
const SENTRY_DSN = extra.sentryDsn ?? '';

let isInitialized = false;

// Minimal shape of the Sentry API we use. Avoids needing `sentry-expo`
// types when the package isn't installed yet.
interface SentryShim {
    init: (cfg: Record<string, unknown>) => void;
    Native: {
        captureException: (e: unknown, ctx?: Record<string, unknown>) => void;
        setUser: (u: { id: string; role?: string } | null) => void;
    };
}

// Lazy require — Sentry pulls in native modules. Guarded so the app builds
// without the package while it's not yet installed.
function getSentry(): SentryShim | null {
    if (!SENTRY_DSN) return null;
    try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        return require('sentry-expo') as SentryShim;
    } catch {
        return null;
    }
}

export function initSentry(): void {
    if (isInitialized) return;
    const Sentry = getSentry();
    if (!Sentry) return;

    Sentry.init({
        dsn: SENTRY_DSN,
        enableInExpoDevelopment: false,
        debug: __DEV__,
        tracesSampleRate: 0.1, // 10% of transactions for performance monitoring
    });
    isInitialized = true;
}

export function reportError(error: Error, info?: ErrorInfo): void {
    const Sentry = getSentry();
    if (!Sentry) return;
    Sentry.Native.captureException(error, info
        ? { contexts: { react: { componentStack: info.componentStack } } }
        : undefined);
}

export function setUserContext(user: { deviceId: string; role?: string }): void {
    const Sentry = getSentry();
    if (!Sentry) return;
    Sentry.Native.setUser({ id: user.deviceId, role: user.role });
}

export function clearUserContext(): void {
    const Sentry = getSentry();
    if (!Sentry) return;
    Sentry.Native.setUser(null);
}
