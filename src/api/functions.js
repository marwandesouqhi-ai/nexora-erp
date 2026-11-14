import { httpsCallable } from 'firebase/functions';
import { functions } from '@/api/firebase';
import { getSupabase } from '@/api/supabase';
import { isSupabaseBackend } from '@/api/backend';

/**
 * Backend-neutral server-function client.
 *   callFunction('createManagedUser', payload)
 * runs the Firebase callable of that name, or on Supabase the matching Edge Function
 * (supabase/functions/*). Returns the function's data directly and throws an Error with
 * `.code` (e.g. 'already-exists', 'permission-denied') and a user-facing `.message`.
 */

// Firebase callable name -> [edge function, action]
const SUPABASE_ROUTES = {
    createManagedUser: ['manage-users', 'create'],
    updateManagedUser: ['manage-users', 'update'],
    updateManagedUserSecure: ['manage-users', 'update_secure'],
    deleteManagedUser: ['manage-users', 'delete'],
    createInvitation: ['invitations', 'create'],
    resendInvitation: ['invitations', 'resend'],
    revokeInvitation: ['invitations', 'revoke'],
    listManagedInvitations: ['invitations', 'list'],
    verifyInvitation: ['invitations', 'verify'],
    acceptInvitation: ['invitations', 'accept'],
    provisionCompany: ['platform-admin', 'provision_company'],
    provisionPlatformStaff: ['platform-admin', 'provision_staff'],
    updatePlatformStaff: ['platform-admin', 'update_staff'],
    suspendPlatformStaff: ['platform-admin', 'suspend_staff'],
    sendWhatsappMessage: ['whatsapp', 'send'],
    checkWhatsappConnection: ['whatsapp', 'check'],
};

async function invokeEdge(fn, action, data) {
    const { data: result, error } = await getSupabase().functions.invoke(fn, { body: { action, ...data } });
    if (!error) return result;

    // FunctionsHttpError carries the Response; our functions answer { error, code }.
    let payload = null;
    try {
        payload = await error.context?.json?.();
    } catch {
        // not JSON
    }
    const err = new Error(payload?.error || error.message || 'Function call failed');
    err.code = payload?.code || 'internal';
    err.status = error.context?.status;
    throw err;
}

export async function callFunction(name, data = {}) {
    if (isSupabaseBackend) {
        if (name === 'recordAuthenticationEvent') {
            return invokeEdge('manage-users', 'record_event', { action_name: data.action });
        }
        const route = SUPABASE_ROUTES[name];
        if (!route) throw new Error(`No Supabase Edge Function mapped for "${name}".`);
        return invokeEdge(route[0], route[1], data);
    }
    const result = await httpsCallable(functions, name)(data);
    return result.data;
}
