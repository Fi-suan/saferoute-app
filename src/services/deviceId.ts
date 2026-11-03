/**
 * Device ID Service — SafeRoute / Sapa Zhol
 *
 * Уникальный UUID устройства. Хранение: SecureStore (основное) +
 * AsyncStorage (фолбэк) — на некоторых устройствах SecureStore молча
 * сбоит между перезапусками, и UUID генерился заново при каждом входе,
 * ломая подтверждения инцидентов (unique device_id). Теперь: чтение из
 * SecureStore → AsyncStorage → генерация; запись в оба хранилища.
 */
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE } from '../constants/storage';

let _cachedDeviceId: string | null = null;

export async function getDeviceId(): Promise<string> {
    // Вернуть из памяти (быстро)
    if (_cachedDeviceId) return _cachedDeviceId;

    // 1) SecureStore
    try {
        const stored = await SecureStore.getItemAsync(STORAGE.DEVICE_ID);
        if (stored) {
            _cachedDeviceId = stored;
            return stored;
        }
    } catch {
        // SecureStore недоступен — идём дальше
    }

    // 2) AsyncStorage фолбэк (переживает перезапуск даже без SecureStore)
    try {
        const stored = await AsyncStorage.getItem(STORAGE.DEVICE_ID);
        if (stored) {
            _cachedDeviceId = stored;
            // Восстановить и в SecureStore
            SecureStore.setItemAsync(STORAGE.DEVICE_ID, stored).catch(() => {});
            return stored;
        }
    } catch {
        /* ignore */
    }

    // 3) Генерация нового + запись в оба хранилища
    const newId = Crypto.randomUUID();
    _cachedDeviceId = newId;

    try {
        await SecureStore.setItemAsync(STORAGE.DEVICE_ID, newId);
    } catch {
        /* ignore */
    }
    try {
        await AsyncStorage.setItem(STORAGE.DEVICE_ID, newId);
    } catch {
        /* ignore */
    }

    return newId;
}
