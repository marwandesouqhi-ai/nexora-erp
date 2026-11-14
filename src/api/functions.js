import { httpsCallable } from 'firebase/functions';
import { functions } from '@/api/firebase';
import { getSupabase } from '@/api/supabase';
import { isSupabaseBackend } from '@/api/backend';

/**
 * Backend-neutral server-function client.
 *   callFunction('createInvitation', payload)
 * runs the Firebase callable of that name, or on Supabase the Edge Function already deployed
 * in the nexora-erp project:
 *   company-invitations  invitations + managing existing users
 *   erp-integrations     WhatsApp gateway + Gemini assistant
 * Returns the function's data and throws an Error with `.code` and a user-facing `.message`.
 */

const unsupported = (message) => () => {
    const err = new Error(message);
    err.code = 'unimplemented';
    throw err;
};

const acceptUrl = (token) => `${window.location.origin}/accept-invitation?token=${encodeURIComponent(token)}`;
// company-invitations returns the one-time token (delivery: 'manual'); hand the UI a ready link.
const withAcceptUrl = (result) => (result?.token ? { ...result, accept_url: acceptUrl(result.token) } : result);

// Firebase callable name -> { fn, action, request?, response? } | { unsupported }
const SUPABASE_ROUTES = {
    createInvitation: { fn: 'company-invitations', action: 'create', response: withAcceptUrl },
    resendInvitation: { fn: 'company-invitations', action: 'resend', response: withAcceptUrl },
    revokeInvitation: { fn: 'company-invitations', action: 'revoke' },
    listManagedInvitations: { fn: 'company-invitations', action: 'list' },
    verifyInvitation: { fn: 'company-invitations', action: 'verify' },
    acceptInvitation: { fn: 'company-invitations', action: 'accept' },
    // Editing an existing member (name / role / status / permissions) — email and password are not editable here.
    updateManagedUser: { fn: 'company-invitations', action: 'update_user' },
    updateManagedUserSecure: { fn: 'company-invitations', action: 'update_user' },
    // The deployed server deliberately has no direct "create user with a password" or "delete user".
    createManagedUser: { unsupported: 'إضافة مستخدم بكلمة مرور مباشرة غير مدعومة على Supabase. أرسل دعوة للمستخدم بدلاً من ذلك.' },
    deleteManagedUser: { unsupported: 'حذف المستخدم غير مدعوم على Supabase. أوقف الحساب (suspended) بدلاً من حذفه.' },
    sendWhatsappMessage: { fn: 'erp-integrations', action: 'whatsapp_send' },
    checkWhatsappConnection: { fn: 'erp-integrations', action: 'whatsapp_status' },
};

async function invokeEdge(fn, action, data) {
    const { data: result, error } = await getSupabase().functions.invoke(fn, { body: { action, ...data } });
    if (!error) return result;

    // FunctionsHttpError carries the Response; the deployed functions answer { error }.
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
        // The deployed project has no login/logout audit function; sign-in must never depend on it.
        if (name === 'recordAuthenticationEvent') return { success: true };
        const route = SUPABASE_ROUTES[name];
        if (!route) throw new Error(`No Supabase Edge Function mapped for "${name}".`);
        if (route.unsupported) return unsupported(route.unsupported)();
        const result = await invokeEdge(route.fn, route.action, data);
        return route.response ? route.response(result) : result;
    }
    const result = await httpsCallable(functions, name)(data);
    return result.data;
}
