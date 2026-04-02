/**
 * auth.ts — SafeRoute / Sapa Jol
 *
 * Device-based JWT authentication.
 * Token is obtained during device registration and stored in SecureStore.
 */
import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'saferoute:auth:token';

/** Store auth token received from backend registration */
export async function storeAuthToken(token: string): Promise<void> {
    try {
        await SecureStore.setItemAsync(TOKEN_KEY, token);
    } catch { /* SecureStore unavailable */ }
}

/** Get stored auth token for API requests */
export async function getAuthToken(): Promise<string | null> {
    try {
        return await SecureStore.getItemAsync(TOKEN_KEY);
    } catch {
        return null;
    }
}

/** Clear auth token on logout */
export async function backendLogout(): Promise<void> {
    try {
        await SecureStore.deleteItemAsync(TOKEN_KEY);
    } catch { /* ignore */ }
}
