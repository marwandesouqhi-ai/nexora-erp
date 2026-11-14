// Shared helpers for the Nexora Edge Functions (Deno runtime).
// Secrets/env available automatically: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY.
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';

export const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export class HttpError extends Error {
  constructor(public status: number, message: string, public code = 'error') {
    super(message);
  }
}

export const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

/** Wraps a handler with CORS preflight and uniform error responses ({ error, code }). */
export function serve(handler: (req: Request) => Promise<Response>): (req: Request) => Promise<Response> {
  return async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
    try {
      return await handler(req);
    } catch (err) {
      if (err instanceof HttpError) return json({ error: err.message, code: err.code }, err.status);
      console.error('Unhandled error', err);
      return json({ error: (err as Error)?.message || 'Internal error', code: 'internal' }, 500);
    }
  };
}

/** Service-role client: bypasses RLS. Never expose it to the browser. */
export const adminClient = (): SupabaseClient =>
  createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

export interface Caller {
  id: string;
  email: string;
}

/** Validates the caller's JWT against Supabase Auth and returns the user. */
export async function requireCaller(req: Request): Promise<Caller> {
  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token) throw new HttpError(401, 'Authentication is required.', 'unauthenticated');
  const anon = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await anon.auth.getUser(token);
  if (error || !data.user) throw new HttpError(401, 'Authentication is required.', 'unauthenticated');
  return { id: data.user.id, email: data.user.email || '' };
}

export async function readBody(req: Request): Promise<Record<string, unknown>> {
  try {
    const body = await req.json();
    return body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export const normalizeEmail = (email: unknown) => String(email ?? '').trim().toLowerCase();
export const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** URL-safe random token (32 bytes). */
export function randomToken(bytes = 32): string {
  const buf = crypto.getRandomValues(new Uint8Array(bytes));
  return btoa(String.fromCharCode(...buf)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// ─── Authorization (mirrors the Firebase callable checks) ────────────────────
export const MANAGED_ROLES = new Set([
  'owner', 'admin', 'manager', 'accountant', 'sales_rep',
  'general_manager', 'sales_manager', 'inventory_manager',
  'purchasing_manager', 'warehouse_employee', 'viewer', 'custom',
]);

export const MANAGEABLE_PERMISSION_KEYS = new Set([
  'can_view_dashboard', 'can_view_operations', 'can_view_reports', 'can_view_activity_log', 'can_view_financials',
  'can_view_sales', 'can_create_sales', 'can_edit_sales', 'can_delete_sales',
  'can_view_inventory', 'can_edit_inventory', 'can_view_purchases', 'can_create_purchases',
  'can_view_customers', 'can_edit_customers', 'can_delete_customers',
  'can_view_suppliers', 'can_edit_suppliers', 'can_view_debts', 'can_edit_debts',
  'can_view_accounts', 'can_manage_accounts', 'can_view_employees', 'can_edit_employees',
  'can_manage_payroll', 'can_manage_users', 'can_manage_settings', 'can_edit_prices',
  'can_manage_automations', 'can_use_ai_assistant',
]);

export const sanitizeOverrides = (input: unknown): Record<string, boolean> => {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {};
  return Object.fromEntries(
    Object.entries(input as Record<string, unknown>).filter(
      ([key, value]) => MANAGEABLE_PERMISSION_KEYS.has(key) && typeof value === 'boolean',
    ),
  ) as Record<string, boolean>;
};

export interface Actor {
  id: string;
  email: string;
  company_id: string | null;
  role: string | null;
  name: string;
  /** Active platform administrators act as super admins (cross-tenant). */
  isSuper: boolean;
}

const isActive = (row: { is_active?: boolean | null; status?: string | null } | null) =>
  !!row && row.is_active !== false && row.status !== 'suspended';

/** Caller must be allowed to manage users (owner/admin unless overridden, or explicit override). */
export async function requireUserManager(admin: SupabaseClient, caller: Caller): Promise<Actor> {
  const [{ data: staff }, { data: profile }] = await Promise.all([
    admin.from('platform_staff').select('role,status,is_active').eq('id', caller.id).maybeSingle(),
    admin.from('profiles').select('company_id,name,role,status,is_active,permission_overrides').eq('id', caller.id).maybeSingle(),
  ]);
  const isSuper = isActive(staff) && staff?.role === 'platform_admin';
  if (!isSuper) {
    if (!profile || !isActive(profile)) throw new HttpError(403, 'User not found or suspended.', 'permission-denied');
    const overrides = (profile.permission_overrides || {}) as Record<string, boolean>;
    const can = ['owner', 'admin'].includes(profile.role)
      ? overrides['can_manage_users'] !== false
      : overrides['can_manage_users'] === true;
    if (!can) throw new HttpError(403, 'User management permission is required.', 'permission-denied');
  }
  return {
    id: caller.id,
    email: caller.email,
    company_id: profile?.company_id ?? null,
    role: profile?.role ?? null,
    name: profile?.name ?? '',
    isSuper,
  };
}

export async function requirePlatformAdmin(admin: SupabaseClient, caller: Caller) {
  const { data: staff } = await admin.from('platform_staff').select('role,status,is_active').eq('id', caller.id).maybeSingle();
  if (!staff || staff.role !== 'platform_admin' || !isActive(staff)) {
    throw new HttpError(403, 'Platform administrator access is required.', 'permission-denied');
  }
  return staff;
}

export function assertTargetCompany(actor: Actor, companyId: string | null | undefined) {
  if (!companyId) throw new HttpError(400, 'An organization is required.', 'invalid-argument');
  if (!actor.isSuper && actor.company_id !== companyId) {
    throw new HttpError(403, 'You can only manage users in your organization.', 'permission-denied');
  }
}

export function assertAssignableRole(actor: Actor, role: string) {
  if (!MANAGED_ROLES.has(role)) throw new HttpError(400, 'Invalid role.', 'invalid-argument');
  if (!actor.isSuper && role === 'owner') {
    throw new HttpError(403, 'Only a system administrator can assign an owner role.', 'permission-denied');
  }
}

/** Refuses to suspend/demote/delete the last active owner/admin of a company. */
export async function assertNotLastActiveAdmin(
  admin: SupabaseClient,
  companyId: string,
  targetId: string,
  next: { role: string; status?: string | null; is_active?: boolean | null },
) {
  if (isActive(next) && ['owner', 'admin'].includes(next.role)) return;
  const { data } = await admin.from('profiles').select('id,role,status,is_active').eq('company_id', companyId);
  const remaining = (data || []).some((p) => p.id !== targetId && ['owner', 'admin'].includes(p.role) && isActive(p));
  if (!remaining) {
    throw new HttpError(
      412,
      'The last active organization administrator cannot be suspended, revoked, or demoted.',
      'failed-precondition',
    );
  }
}

/** Writes a tenant audit record (activity_logs). Failures never block the operation. */
export async function writeAuditLog(
  admin: SupabaseClient,
  entry: { actorId?: string; companyId?: string | null; action: string; entityType?: string; details?: string; metadata?: Record<string, unknown> },
) {
  const { error } = await admin.from('activity_logs').insert({
    company_id: entry.companyId ?? null,
    user_id: entry.actorId ?? null,
    action: entry.action,
    entity_type: entry.entityType ?? 'user_management',
    details: entry.details ?? '',
    metadata: entry.metadata ?? {},
  });
  if (error) console.warn('audit log failed:', error.message);
}

/** Finds an Auth user by email (admin API has no direct lookup). */
export async function findAuthUserByEmail(admin: SupabaseClient, email: string) {
  for (let page = 1; page <= 10; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const hit = data.users.find((u) => (u.email || '').toLowerCase() === email);
    if (hit) return hit;
    if (data.users.length < 200) return null;
  }
  return null;
}
