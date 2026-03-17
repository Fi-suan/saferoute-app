/**
 * Device ID Service — SafeRoute / Sapa Jol
 *
 * Генерирует и сохраняет уникальный UUID для устройства в SecureStore.
 * UUID персистентен между перезапусками приложения.
 *
 * Почему НЕ используем IMEI/Android ID:
 * - IMEI: запрещён с Android 10+ / iOS без системных прав
 * - getAndroidId: меняется при factory reset, нет на iOS
 * - getIosIdForVendorAsync: меняется при удалении всех приложений вендора
 *
 * UUID + SecureStore — кроссплатформенное, стабильное, privacy-compliant решение.
 */
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import { STORAGE } from '../constants/storage';

let _cachedDeviceId: string | null = null;

/**
 * Возвращает уникальный ID устройства.
 * При первом вызове генерирует UUID и сохраняет в SecureStore.
 * Последующие вызовы возвращают кэшированное значение.
 */
export async function getDeviceId(): Promise<string> {
    // Вернуть из памяти (быстро)
    if (_cachedDeviceId) return _cachedDeviceId;

    try {
        // Попробовать прочитать из SecureStore
        const stored = await SecureStore.getItemAsync(STORAGE.DEVICE_ID);
        if (stored) {
            _cachedDeviceId = stored;
            return stored;
        }
    } catch {
        // SecureStore недоступен — генерируем fallback
    }

    // Создать новый UUID
    const newId = Crypto.randomUUID();

    try {
        await SecureStore.setItemAsync(STORAGE.DEVICE_ID, newId);
    } catch {
        // Если SecureStore недоступен — используем только in-memory (пока сессия)
    }

    _cachedDeviceId = newId;
    return newId;
}

/** Синхронное получение (только если уже был загружен ранее) */
export function getDeviceIdSync(): string {
    return _cachedDeviceId ?? 'uninitialized';
}
