/**
 * firebase.ts — DEPRECATED
 *
 * Firebase has been removed in favor of own backend API on Render.
 * Auth is now handled by src/services/auth.ts.
 *
 * This file provides no-op stubs for any lingering imports.
 */

export function isFirebaseConfigured(): boolean { return false; }
export async function firebaseRegister(): Promise<void> { }
export async function firebaseLogin(): Promise<never> { throw new Error('Firebase removed'); }
export async function firebaseLogout(): Promise<void> { }
