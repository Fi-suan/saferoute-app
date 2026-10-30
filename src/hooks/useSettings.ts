/**
 * Settings Hook — SafeRoute / Sapa Jol
 *
 * Backed by a global zustand store: language change propagates to EVERY
 * mounted component instantly (previously each useSettings() instance kept
 * its own local state — switching language in Profile left other screens
 * in the old language).
 */
import { useEffect, useCallback } from 'react';
import { create } from 'zustand';
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

interface SettingsStore {
    settings: AppSettings;
    loaded: boolean;
    setSettings: (s: AppSettings) => void;
    setLoaded: (v: boolean) => void;
}

const useSettingsStore = create<SettingsStore>(set => ({
    settings: DEFAULTS,
    loaded: false,
    setSettings: settings => set({ settings }),
    setLoaded: loaded => set({ loaded }),
}));

// Load persisted settings once per app run
let initialized = false;
function ensureLoaded(): void {
    if (initialized) return;
    initialized = true;
    (async () => {
        try {
            const [sound, vib, lang] = await AsyncStorage.multiGet([
                STORAGE.SOUND_ENABLED,
                STORAGE.VIBRATION_ENABLED,
                STORAGE.LANGUAGE,
            ]);
            useSettingsStore.getState().setSettings({
                soundEnabled: sound[1] !== null ? sound[1] === 'true' : DEFAULTS.soundEnabled,
                vibrationEnabled: vib[1] !== null ? vib[1] === 'true' : DEFAULTS.vibrationEnabled,
                language: (lang[1] as 'kk' | 'ru') ?? DEFAULTS.language,
            });
        } catch { /* keep defaults */ }
        useSettingsStore.getState().setLoaded(true);
    })();
}

export function useSettings() {
    const { settings, loaded, setSettings } = useSettingsStore();

    useEffect(() => {
        ensureLoaded();
    }, []);

    const update = useCallback(
        async (patch: Partial<AppSettings>) => {
            const prev = useSettingsStore.getState().settings;
            const next = { ...prev, ...patch };
            setSettings(next); // optimistic, global
            const pairs: [string, string][] = [];
            if (patch.soundEnabled !== undefined)
                pairs.push([STORAGE.SOUND_ENABLED, String(patch.soundEnabled)]);
            if (patch.vibrationEnabled !== undefined)
                pairs.push([STORAGE.VIBRATION_ENABLED, String(patch.vibrationEnabled)]);
            if (patch.language !== undefined) pairs.push([STORAGE.LANGUAGE, patch.language]);
            try {
                await AsyncStorage.multiSet(pairs);
            } catch (err) {
                console.warn('[useSettings] persist failed, reverting:', err);
                setSettings(prev);
            }
        },
        [setSettings],
    );

    return { settings, update, loaded };
}
