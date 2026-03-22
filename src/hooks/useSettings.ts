/**
 * Settings Hook — SafeRoute / Sapa Jol
 *
 * Читает/пишет настройки из AsyncStorage.
 * Радиус сближения убран из настроек — захардкожен в Config.DEFAULT_PROXIMITY_RADIUS_KM.
 */
import { useEffect, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE } from '../constants/storage';

export interface AppSettings {
    soundEnabled: boolean;
    vibrationEnabled: boolean;
    language: 'kk' | 'ru';
}

const DEFAULTS: AppSettings = {
    soundEnabled: true,
    vibrationEnabled: true,
    language: 'kk',
};

async function loadSettings(): Promise<AppSettings> {
    try {
        const [sound, vib, lang] = await AsyncStorage.multiGet([
            STORAGE.SOUND_ENABLED,
            STORAGE.VIBRATION_ENABLED,
            STORAGE.LANGUAGE,
        ]);
        return {
            soundEnabled: sound[1] !== null ? sound[1] === 'true' : DEFAULTS.soundEnabled,
            vibrationEnabled: vib[1] !== null ? vib[1] === 'true' : DEFAULTS.vibrationEnabled,
            language: (lang[1] as 'kk' | 'ru') ?? DEFAULTS.language,
        };
    } catch {
        return DEFAULTS;
    }
}

export function useSettings() {
    const [settings, setSettings] = useState<AppSettings>(DEFAULTS);
    const [loaded, setLoaded] = useState(false);

    useEffect(() => {
        loadSettings().then(s => {
            setSettings(s);
            setLoaded(true);
        });
    }, []);

    const update = useCallback(async (patch: Partial<AppSettings>) => {
        const next = { ...settings, ...patch };
        setSettings(next);
        const pairs: [string, string][] = [];
        if (patch.soundEnabled !== undefined)
            pairs.push([STORAGE.SOUND_ENABLED, String(patch.soundEnabled)]);
        if (patch.vibrationEnabled !== undefined)
            pairs.push([STORAGE.VIBRATION_ENABLED, String(patch.vibrationEnabled)]);
        if (patch.language !== undefined)
            pairs.push([STORAGE.LANGUAGE, patch.language]);
        try {
            await AsyncStorage.multiSet(pairs);
        } catch { /* ignore */ }
    }, [settings]);

    return { settings, update, loaded };
}
