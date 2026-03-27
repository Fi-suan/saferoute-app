/**
 * auth.ts — SafeRoute / Sapa Jol
 *
 * Auth service using own backend API (Render).
 * Endpoints: POST /auth/register, POST /auth/login, GET /auth/profile
 *
 * Currently the backend may not have auth endpoints yet.
 * Registration always works locally (AsyncStorage).
 * Login will work when backend adds auth endpoints.
 */
import api from './api';
import * as SecureStore from 'expo-secure-store';
import type { UserProfile } from '../constants/livestock';

const TOKEN_KEY = 'saferoute:auth:token';

/**
 * Register a new user.
 * Returns profile from backend if auth endpoint exists, null otherwise.
 * Caller should always save profile to AsyncStorage regardless.
 */
export async function backendRegister(data: {
    name: string;
    phone: string;
    email?: string;
    password?: string;
    role: string;
}): Promise<{ token?: string; profile?: UserProfile } | null> {
    try {
        const res = await api.post('/auth/register', data);
        if (res.data?.token) {
            await SecureStore.setItemAsync(TOKEN_KEY, res.data.token);
        }
        return res.data;
    } catch {
        // Backend auth not yet implemented — silent fallback
        return null;
    }
}

/**
 * Login with email + password.
 * Returns profile if successful, throws if fails.
 */
export async function backendLogin(
    email: string,
    password: string,
): Promise<UserProfile> {
    const res = await api.post('/auth/login', { email, password });
    if (res.data?.token) {
        await SecureStore.setItemAsync(TOKEN_KEY, res.data.token);
    }
    if (!res.data?.profile) throw new Error('no_profile');
    return res.data.profile;
}

/** Clear auth token on logout */
export async function backendLogout(): Promise<void> {
    try {
        await SecureStore.deleteItemAsync(TOKEN_KEY);
    } catch { /* ignore */ }
}

/** Get stored auth token (for future API auth headers) */
export async function getAuthToken(): Promise<string | null> {
    try {
        return await SecureStore.getItemAsync(TOKEN_KEY);
    } catch {
        return null;
    }
}
