import { supabaseConfigValid } from './supabase';

/**
 * Temporary switch for the Firebase -> Supabase migration.
 * VITE_BACKEND=supabase runs the CRM against Supabase; defaults to Firebase.
 * Remove once the migration is complete.
 */
const requested = String(import.meta.env.VITE_BACKEND || 'firebase').toLowerCase();

export const isSupabaseBackend = requested === 'supabase' && supabaseConfigValid;
