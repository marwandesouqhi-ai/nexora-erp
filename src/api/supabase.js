import { createClient } from '@supabase/supabase-js';

/**
 * Supabase client (Firebase → Supabase migration, see SUPABASE_MIGRATION_PLAN.md).
 *
 * Only the public anon key belongs here. The service-role key must never be
 * exposed through a VITE_ variable — it is used only by Edge Functions and the
 * data-migration scripts.
 */
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const supabaseConfigValid = Boolean(supabaseUrl && supabaseAnonKey);

/**
 * Created only when configured, so the app keeps running on Firebase while
 * the Supabase env vars are still empty.
 */
export const supabase = supabaseConfigValid
    ? createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true,
        },
    })
    : null;

/** Returns the client, or throws a clear error when the env vars are missing. */
export function getSupabase() {
    if (!supabase) {
        throw new Error(
            'Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file.'
        );
    }
    return supabase;
}

export default supabase;
