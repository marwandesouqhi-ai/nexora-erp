import { createClient } from '@supabase/supabase-js';

/**
 * Supabase client for the CRM (Firebase -> Supabase migration).
 * Only the public anon/publishable key belongs here; never a service-role key.
 */
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const supabaseConfigValid = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = supabaseConfigValid
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
  : null;

export function getSupabase() {
  if (!supabase) {
    throw new Error('Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.');
  }
  return supabase;
}
