/**
 * useUserProfile.ts — профиль пользователя SafeRoute
 *
 * Единый источник правды для профиля.
 * Хранит: имя, телефон, роль ('driver' | 'livestock_owner'), статистика.
 * Персистируется через AsyncStorage (STORAGE.USER_PROFILE).
 */
import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { UserProfile } from '../constants/livestock';
import { STORAGE } from '../constants/storage';

/**
 * Build avatar initials from a free-form name. Works for any script
 * (Cyrillic, Latin, etc.) and handles single-word names + edge cases.
 *  - "Айбек Жанбосынов" → "АЖ"
 *  - "Айбек"           → "АЙ"
 *  - "  "  / undefined → "?"
 */
export function deriveInitials(rawName: string | undefined): string {
    const name = (rawName ?? '').trim();
    if (!name) return '?';
    const words = name.split(/\s+/).filter(Boolean);
    if (words.length >= 2) {
        return (words[0][0] + words[1][0]).toUpperCase();
    }
    // Single word — take first two characters
    return words[0].slice(0, 2).toUpperCase();
}

const DEFAULT_PROFILE: UserProfile = {
    name: 'Пайдаланушы',
    phone: '',
    role: 'driver',
    joinedAt: new Date().toISOString(),
    totalReports: 0,
    avatarInitials: deriveInitials('Пайдаланушы'),
};

interface UseUserProfileReturn {
    profile: UserProfile;
    loaded: boolean;
    updateProfile: (patch: Partial<UserProfile>) => Promise<void>;
    incrementReports: () => Promise<void>;
}

export function useUserProfile(): UseUserProfileReturn {
    const [profile, setProfile] = useState<UserProfile>(DEFAULT_PROFILE);
    const [loaded, setLoaded] = useState(false);

    useEffect(() => {
        AsyncStorage.getItem(STORAGE.USER_PROFILE).then(raw => {
            if (raw) {
                try { setProfile(JSON.parse(raw)); } catch { /* use default */ }
            }
            setLoaded(true);
        });
    }, []);

    const updateProfile = useCallback(async (patch: Partial<UserProfile>) => {
        // Recompute initials only if the name changed; otherwise keep them.
        const initials = patch.name !== undefined
            ? deriveInitials(patch.name)
            : profile.avatarInitials;
        const updated = { ...profile, ...patch, avatarInitials: initials };
        setProfile(updated);
        await AsyncStorage.setItem(STORAGE.USER_PROFILE, JSON.stringify(updated));
    }, [profile]);

    const incrementReports = useCallback(async () => {
        await updateProfile({ totalReports: profile.totalReports + 1 });
    }, [updateProfile, profile.totalReports]);

    return { profile, loaded, updateProfile, incrementReports };
}
