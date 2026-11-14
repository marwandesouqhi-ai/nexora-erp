import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { httpsCallable } from 'firebase/functions';
import { auth, functions } from '@/api/firebase';
import { supabase } from '@/api/supabase';
import { isSupabaseBackend } from '@/api/backend';

/**
 * Backend-neutral authentication API (Firebase -> Supabase migration, phase 3).
 * Components call these instead of touching firebase/auth or supabase directly,
 * so the VITE_BACKEND flag is the only switch.
 */

/** Normalised error codes so the UI does not care which backend failed. */
export const AUTH_ERRORS = {
    INVALID_CREDENTIALS: 'invalid-credentials',
    INVALID_EMAIL: 'invalid-email',
    TOO_MANY_REQUESTS: 'too-many-requests',
    UNKNOWN: 'unknown',
};

function normaliseError(err) {
    const code = err?.code || '';
    const msg = String(err?.message || '').toLowerCase();
    if (
        ['auth/invalid-credential', 'auth/wrong-password', 'auth/user-not-found'].includes(code) ||
        msg.includes('invalid login credentials')
    ) {
        return AUTH_ERRORS.INVALID_CREDENTIALS;
    }
    if (code === 'auth/invalid-email' || msg.includes('invalid email') || msg.includes('unable to validate email')) {
        return AUTH_ERRORS.INVALID_EMAIL;
    }
    if (code === 'auth/too-many-requests' || err?.status === 429 || msg.includes('rate limit')) {
        return AUTH_ERRORS.TOO_MANY_REQUESTS;
    }
    return AUTH_ERRORS.UNKNOWN;
}

/** Signs in and returns `{ user }` with a `uid` field on both backends. */
export async function signInWithPassword(email, password) {
    try {
        if (isSupabaseBackend) {
            const { data, error } = await supabase.auth.signInWithPassword({ email, password });
            if (error) throw error;
            return { user: { ...data.user, uid: data.user.id } };
        }
        const credential = await signInWithEmailAndPassword(auth, email, password);
        return { user: credential.user };
    } catch (err) {
        const wrapped = new Error(err?.message || 'auth failed');
        wrapped.authCode = normaliseError(err);
        wrapped.cause = err;
        throw wrapped;
    }
}

/** Server-side audit trail of login/logout. Supabase side is covered by activity_logs (phase 4). */
export async function recordAuthenticationEvent(action) {
    if (isSupabaseBackend) return;
    await httpsCallable(functions, 'recordAuthenticationEvent')({ action });
}

export async function signOutUser() {
    if (isSupabaseBackend) {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
        return;
    }
    await signOut(auth);
}

/** The currently signed-in raw auth user (or null), with a `uid` field. */
export async function getCurrentAuthUser() {
    if (isSupabaseBackend) {
        const { data } = await supabase.auth.getUser();
        return data?.user ? { ...data.user, uid: data.user.id } : null;
    }
    return auth.currentUser;
}
