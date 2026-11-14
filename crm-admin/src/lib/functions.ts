import { httpsCallable } from 'firebase/functions';
import { functions } from './firebase';
import { getSupabase } from './supabase';
import { isSupabaseBackend } from './backend';

/**
 * Backend-neutral server-function client for the CRM.
 * Firebase: httpsCallable(name). Supabase: the `platform-admin` Edge Function action.
 * Throws an Error whose message is the server's user-facing text and `.code` is its code.
 */
// The deployed `platform-admin` function requires the list of enabled modules when creating a company
// (default = every module, same as the column default) and invites people by e-mail instead of
// returning a password-reset link.
const ALL_MODULES = ['sales', 'inventory', 'purchases', 'customers', 'suppliers', 'debts', 'finance', 'hr', 'reports', 'operations', 'manufacturing', 'automation', 'ai'];

const SUPABASE_ROUTES: Record<string, [string, string]> = {
  provisionCompany: ['platform-admin', 'provision_company'],
  provisionPlatformStaff: ['platform-admin', 'provision_staff'],
  updatePlatformStaff: ['platform-admin', 'update_staff'],
  suspendPlatformStaff: ['platform-admin', 'suspend_staff'],
};

export async function callFunction<TIn extends object, TOut>(name: string, data: TIn): Promise<TOut> {
  if (isSupabaseBackend) {
    const route = SUPABASE_ROUTES[name];
    if (!route) throw new Error(`No Supabase Edge Function mapped for "${name}".`);
    const body: Record<string, unknown> = { action: route[1], ...data };
    if (name === 'provisionCompany' && !body.enabledModules) body.enabledModules = ALL_MODULES;
    const { data: result, error } = await getSupabase().functions.invoke(route[0], { body });
    if (error) {
      let payload: { error?: string; code?: string } | null = null;
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        payload = await (error as any).context?.json?.();
      } catch {
        // not JSON
      }
      const err = new Error(payload?.error || error.message || 'Function call failed') as Error & { code?: string };
      err.code = payload?.code || 'internal';
      throw err;
    }
    return result as TOut;
  }
  const response = await httpsCallable<TIn, TOut>(functions, name)(data);
  return response.data;
}
