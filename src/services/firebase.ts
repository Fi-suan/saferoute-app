/**
 * firebase.ts — SafeRoute / Sapa Jol
 *
 * Firebase initialization with AsyncStorage persistence for React Native.
 *
 * Setup steps for user:
 *  1. console.firebase.google.com → Создать проект
 *  2. Authentication → Email/Password → включить
 *  3. Firestore → Создать базу данных (Production или Test mode)
 *  4. Настройки проекта → Ваши приложения → Web → Конфигурация SDK
 *  5. Скопировать значения в .env файл
 */
import { getApps, initializeApp } from 'firebase/app';
import { getAuth, initializeAuth, inMemoryPersistence } from 'firebase/auth';
import {
    getFirestore,
    doc,
    setDoc,
    getDoc,
} from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Config } from '../config';
import type { UserProfile } from '../constants/livestock';

// ── Init (guard against hot-reload double-init) ──────────────────────────────
const app = getApps().length === 0
    ? initializeApp(Config.FIREBASE)
    : getApps()[0];

// Use inMemoryPersistence for React Native (Firebase 12.x JS SDK).
// Auth state is managed via AsyncStorage in App.tsx through onAuthStateChanged.
export const auth = (() => {
    try {
        return initializeAuth(app, { persistence: inMemoryPersistence });
    } catch {
        return getAuth(app);
    }
})();

export const db = getFirestore(app);

// ── Auth helpers ─────────────────────────────────────────────────────────────

export async function firebaseRegister(
    email: string,
    password: string,
    profile: UserProfile,
): Promise<void> {
    const { createUserWithEmailAndPassword } = await import('firebase/auth');
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await setDoc(doc(db, 'users', cred.user.uid), {
        ...profile,
        email,
        createdAt: new Date().toISOString(),
    });
}

export async function firebaseLogin(
    email: string,
    password: string,
): Promise<UserProfile> {
    const { signInWithEmailAndPassword } = await import('firebase/auth');
    const cred = await signInWithEmailAndPassword(auth, email, password);
    const snap = await getDoc(doc(db, 'users', cred.user.uid));
    if (!snap.exists()) throw new Error('profile_not_found');
    return snap.data() as UserProfile;
}

export async function firebaseLogout(): Promise<void> {
    const { signOut } = await import('firebase/auth');
    await signOut(auth);
}

/** True when Firebase project config has been filled in */
export function isFirebaseConfigured(): boolean {
    return Config.FIREBASE.apiKey.length > 0;
}
