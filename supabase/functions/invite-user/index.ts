// invite-user: invites a person to join the caller's company and sends the e-mail through
// Supabase Auth (the project's SMTP). Self-contained (no ../_shared imports) so it can be
// deployed from the dashboard editor.
//
//   { action: 'invite', email, full_name?, job_title?, role?, permission_overrides? }
//   { action: 'resend', userId }   // for a person who has not set a password yet
//
// The invited person gets Supabase's invite e-mail, opens <ERP>/set-password, chooses a
// password and can sign in. The profile (company, role, permissions) is created immediately
// by the existing accept_company_invitation RPC, so nothing is usable before they set a password.
import { createClient } from 'npm:@supabase/supabase-js@2.119.0';

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
};
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });
const sha256 = async (value: string) =>
  Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))))
    .map((b) => b.toString(16).padStart(2, '0')).join('');

const ROLES = ['admin', 'general_manager', 'manager', 'accountant', 'sales_manager', 'sales_rep',
  'inventory_manager', 'purchasing_manager', 'warehouse_employee', 'viewer', 'custom'];
const EMAIL_RE = /^\S+@\S+\.\S+$/;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return reply({});
  if (req.method !== 'POST') return reply({ error: 'Method not allowed' }, 405);

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    // ── who is calling ───────────────────────────────────────────────────────
    const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
    if (!token) return reply({ error: 'Authentication required' }, 401);
    const { data: { user }, error: authError } = await admin.auth.getUser(token);
    if (authError || !user) return reply({ error: 'Invalid session' }, 401);

    const { data: caller } = await admin.from('profiles')
      .select('company_id,role,status,is_active,permission_overrides').eq('id', user.id).maybeSingle();
    if (!caller || caller.status !== 'active' || caller.is_active === false) {
      return reply({ error: 'Company administrator required' }, 403);
    }
    const { data: company } = await admin.from('companies').select('id,name,status').eq('id', caller.company_id).maybeSingle();
    if (!company || company.status !== 'active') return reply({ error: 'Company inactive' }, 403);

    const overrides = (caller.permission_overrides || {}) as Record<string, boolean>;
    const isOwnerOrAdmin = ['owner', 'admin'].includes(caller.role);
    const canManage = isOwnerOrAdmin ? overrides['can_manage_users'] !== false : overrides['can_manage_users'] === true;
    if (!canManage) return reply({ error: 'Company administrator required' }, 403);

    const erpOrigin = new URL(Deno.env.get('ERP_APP_URL') || 'https://nexora-erp-tau.vercel.app').origin;
    const redirectTo = erpOrigin + '/set-password';
    const mailFailure = (code?: string) =>
      ['email_exists', 'user_already_exists'].includes(code || '')
        ? 'هذا البريد مستخدم بالفعل.'
        : 'تعذر إرسال دعوة البريد. تحقق من إعداد SMTP في Supabase وحدود الإرسال ثم حاول مرة أخرى.';

    const body = await req.json();

    // ── resend: person invited earlier who never set a password ─────────────
    if (body.action === 'resend') {
      const id = String(body.userId || '');
      const { data: target } = await admin.from('profiles').select('id,email,role,company_id').eq('id', id).maybeSingle();
      if (!target || target.company_id !== caller.company_id || target.id === user.id || target.role === 'owner') {
        return reply({ error: 'Cannot modify this account' }, 403);
      }
      const { data: account } = await admin.auth.admin.getUserById(id);
      if (account?.user?.last_sign_in_at) return reply({ error: 'هذا المستخدم فعّل حسابه بالفعل.' }, 400);
      const { error } = await admin.auth.resetPasswordForEmail(target.email, { redirectTo });
      if (error) return reply({ error: mailFailure(error.code) }, 502);
      return reply({ success: true, delivery: 'email' });
    }

    // ── invite ───────────────────────────────────────────────────────────────
    if (body.action !== 'invite') return reply({ error: 'Unknown action' }, 400);

    const email = String(body.email || '').trim().toLowerCase();
    const role = String(body.role || 'sales_rep');
    if (!EMAIL_RE.test(email) || !ROLES.includes(role)) return reply({ error: 'Invalid email or role' }, 400);
    if (role === 'admin' && caller.role !== 'owner') return reply({ error: 'Only the owner can appoint administrators' }, 403);

    const requested = body.permission_overrides || {};
    if (typeof requested !== 'object' || Array.isArray(requested)) return reply({ error: 'Invalid permission overrides' }, 400);
    const permissions: Record<string, boolean> = {};
    for (const [key, value] of Object.entries(requested)) {
      if (!/^can_[a-z_]{2,60}$/.test(key) || typeof value !== 'boolean') return reply({ error: 'Invalid permission' }, 400);
      // Only owners/admins may grant freely; anyone else can only pass on what they hold.
      if (value && !isOwnerOrAdmin && overrides[key] !== true) return reply({ error: 'Cannot delegate a permission you do not hold' }, 403);
      permissions[key] = value;
    }
    const fullName = String(body.full_name || '').slice(0, 200);
    const jobTitle = String(body.job_title || '').slice(0, 200);

    // Supabase sends the invite e-mail here.
    const { data: account, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
      redirectTo,
      data: { name: fullName, company_name: company.name },
    });
    if (inviteError || !account?.user) return reply({ error: mailFailure(inviteError?.code) }, 502);
    const accountId = account.user.id;

    // Create the membership with the existing RPC: it needs a matching invitation row.
    const secret = crypto.randomUUID() + crypto.randomUUID();
    const hash = await sha256(secret);
    const { data: invitation, error: insertError } = await admin.from('invitations').insert({
      company_id: caller.company_id,
      created_by: user.id,
      email,
      full_name: fullName,
      job_title: jobTitle,
      role,
      permission_overrides: permissions,
      token_hash: hash,
      expires_at: new Date(Date.now() + 3600000).toISOString(),
    }).select('id').single();
    let failed = insertError;
    if (!failed && invitation) {
      const { error: rpcError } = await admin.rpc('accept_company_invitation', {
        invite_id: invitation.id, invite_hash: hash, account_id: accountId,
      });
      failed = rpcError;
    }
    if (failed) {
      // Never leave an orphan account that already received an e-mail but has no membership.
      const { data: existing } = await admin.from('profiles').select('id').eq('id', accountId).maybeSingle();
      if (!existing) await admin.auth.admin.deleteUser(accountId).catch(() => null);
      if (invitation) await admin.from('invitations').delete().eq('id', invitation.id);
      throw failed;
    }
    return reply({ success: true, delivery: 'email', id: invitation!.id });
  } catch (error) {
    console.error('invite-user failed', error instanceof Error ? error.message : 'unknown');
    return reply({ error: 'تعذر إتمام عملية الدعوة' }, 400);
  }
});
