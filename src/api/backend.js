import { supabaseConfigValid } from './supabase';

/**
 * Temporary switch used during the Firebase → Supabase migration.
 * Set VITE_BACKEND=supabase to run a migrated module against Supabase.
 * Defaults to Firebase so current behaviour does not change.
 * Remove this file once the migration is complete.
 */
const requested = String(import.meta.env.VITE_BACKEND || 'firebase').toLowerCase();

if (requested !== 'firebase' && requested !== 'supabase') {
    console.warn(`[backend] Unknown VITE_BACKEND "${requested}", falling back to "firebase".`);
}

if (requested === 'supabase' && !supabaseConfigValid) {
    console.warn('[backend] VITE_BACKEND=supabase but the Supabase env vars are missing; falling back to "firebase".');
}

export const BACKEND = requested === 'supabase' && supabaseConfigValid ? 'supabase' : 'firebase';
export const isSupabaseBackend = BACKEND === 'supabase';
export const isFirebaseBackend = BACKEND === 'firebase';
