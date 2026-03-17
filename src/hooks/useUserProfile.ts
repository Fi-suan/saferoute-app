/**
 * useUserProfile.ts — профиль пользователя SafeRoute
 *
 * Хранит: имя, телефон, роль (водитель/мал иесі/екеуі де)
 * Персистируется через AsyncStorage
 */
import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { UserProfile, UserRole } from '../constants/livestock';

const PROFILE_KEY = 'saferoute:user:profile';

const DEFAULT_PROFILE: UserProfile = {
    name: 'Пайдаланушы',
    phone: '',
    role: 'driver',
    joinedAt: new Date().toISOString(),
    totalReports: 0,
    avatarInitials: 'ПА',
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
        AsyncStorage.getItem(PROFILE_KEY).then(raw => {
            if (raw) {
                try { setProfile(JSON.parse(raw)); } catch { /* use default */ }
            }
            setLoaded(true);
        });
    }, []);

    const updateProfile = useCallback(async (patch: Partial<UserProfile>) => {
        const initials = patch.name
            ? patch.name.trim().split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
            : profile.avatarInitials;
        const updated = { ...profile, ...patch, avatarInitials: initials };
        setProfile(updated);
        await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(updated));
    }, [profile]);

    const incrementReports = useCallback(async () => {
        await updateProfile({ totalReports: profile.totalReports + 1 });
    }, [updateProfile, profile.totalReports]);

    return { profile, loaded, updateProfile, incrementReports };
}
