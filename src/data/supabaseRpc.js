import { getSupabase } from '@/api/supabase';

/**
 * Calls a Postgres RPC (the server-side replacement for Firestore transactions)
 * and turns PostgREST errors into plain Errors with the Postgres message,
 * e.g. "Insufficient stock for X (Available: 1, Requested: 2)".
 */
export async function callRpc(name, args = {}) {
    const { data, error } = await getSupabase().rpc(name, args);
    if (error) {
        const err = new Error(error.message || `RPC ${name} failed`);
        err.code = error.code;
        err.details = error.details;
        throw err;
    }
    return data;
}
