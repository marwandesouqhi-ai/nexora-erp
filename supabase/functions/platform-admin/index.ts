// platform-admin: replaces provisionCompany / provisionPlatformStaff / updatePlatformStaff /
// suspendPlatformStaff (Firebase callables). Platform administrators only.
// Body: { action: 'provision_company' | 'provision_staff' | 'update_staff' | 'suspend_staff', ... }
import {
  HttpError, adminClient, findAuthUserByEmail, isValidEmail, json, normalizeEmail, randomToken,
  readBody, requireCaller, requirePlatformAdmin, serve,
} from '../_shared/lib.ts';

const PLATFORM_ROLES = new Set(['platform_admin', 'billing_admin', 'support_agent']);

/** 01012345678 -> 201012345678 (same rules as the UI and the old callable). */
function normalizeWaNumber(phone: unknown): string {
  if (!phone) return '';
  let digits = String(phone)
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/\D/g, '');
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.startsWith('0')) digits = `20${digits.slice(1)}`;
  if (digits.length === 10 && digits.startsWith('1')) digits = `20${digits}`;
  return digits;
}

Deno.serve(serve(async (req) => {
  const caller = await requireCaller(req);
  const admin = adminClient();
  await requirePlatformAdmin(admin, caller);
  const body = await readBody(req);
  const action = String(body.action || '');

  const audit = async (a: string, target: string, metadata: Record<string, unknown> = {}) => {
    const { error } = await admin.from('platform_audit_logs').insert({ actor_id: caller.id, action: a, target, metadata });
    if (error) console.warn('platform audit failed:', error.message);
  };
  const recoveryLink = async (email: string) => {
    const { data, error } = await admin.auth.admin.generateLink({ type: 'recovery', email });
    if (error) throw new HttpError(500, error.message, 'internal');
    return data.properties.action_link;
  };

  if (action === 'provision_staff') {
    const email = normalizeEmail(body.email);
    const name = String(body.name || '').trim();
    const role = String(body.role || '');
    if (!isValidEmail(email) || !name || !PLATFORM_ROLES.has(role)) {
      throw new HttpError(400, 'A name, valid email, and platform role are required.', 'invalid-argument');
    }
    let account = await findAuthUserByEmail(admin, email);
    if (!account) {
      const { data, error } = await admin.auth.admin.createUser({
        email, password: randomToken(), email_confirm: false, user_metadata: { name },
      });
      if (error || !data.user) throw new HttpError(500, error?.message || 'Unable to create the account.', 'internal');
      account = data.user;
    }
    const { data: erpProfile } = await admin.from('profiles').select('id').eq('id', account.id).maybeSingle();
    if (erpProfile) {
      throw new HttpError(412, 'ERP users cannot be provisioned as platform CRM staff. Use a separate account.', 'failed-precondition');
    }
    const { error: staffError } = await admin.from('platform_staff').upsert({
      id: account.id, email, name, role, status: 'active', is_active: true,
    }, { onConflict: 'id' });
    if (staffError) throw new HttpError(500, staffError.message, 'internal');
    await audit('platform_staff_provisioned', account.id, { role });
    return json({ passwordResetLink: await recoveryLink(email) });
  }

  if (action === 'update_staff') {
    const userId = String(body.userId || '');
    const role = String(body.role || '');
    if (!userId || !PLATFORM_ROLES.has(role) || userId === caller.id) throw new HttpError(400, 'Invalid staff update.', 'invalid-argument');
    const { data, error } = await admin.from('platform_staff').update({ role }).eq('id', userId).select('id');
    if (error) throw new HttpError(500, error.message, 'internal');
    if (!data?.length) throw new HttpError(404, 'Platform staff member not found.', 'not-found');
    await audit('platform_staff_role_updated', userId, { role });
    return json({ success: true });
  }

  if (action === 'suspend_staff') {
    const userId = String(body.userId || '');
    if (!userId || userId === caller.id) throw new HttpError(400, 'You cannot suspend your own account.', 'invalid-argument');
    const { data, error } = await admin.from('platform_staff').update({ status: 'suspended', is_active: false }).eq('id', userId).select('id');
    if (error) throw new HttpError(500, error.message, 'internal');
    if (!data?.length) throw new HttpError(404, 'Platform staff member not found.', 'not-found');
    const { error: banError } = await admin.auth.admin.updateUserById(userId, { ban_duration: '876000h' });
    if (banError) throw new HttpError(500, banError.message, 'internal');
    await audit('platform_staff_suspended', userId);
    return json({ success: true });
  }

  if (action === 'provision_company') {
    const companyName = String(body.companyName || '').trim();
    const companyEmail = normalizeEmail(body.companyEmail);
    const ownerName = String(body.ownerName || '').trim();
    const ownerEmail = normalizeEmail(body.ownerEmail);
    const plan = ['basic', 'pro', 'enterprise'].includes(String(body.plan || '').toLowerCase()) ? String(body.plan).toLowerCase() : 'basic';
    const adminWhatsapp = normalizeWaNumber(body.adminWhatsapp);
    if (adminWhatsapp && !/^\d{10,15}$/.test(adminWhatsapp)) throw new HttpError(400, 'Admin WhatsApp number is invalid.', 'invalid-argument');
    if (!companyName || !isValidEmail(companyEmail) || !ownerName || !isValidEmail(ownerEmail)) {
      throw new HttpError(400, 'Company name, company email, owner name, and owner email are required.', 'invalid-argument');
    }
    if (await findAuthUserByEmail(admin, ownerEmail)) throw new HttpError(409, 'The company owner email already has an account.', 'already-exists');

    const { data: owner, error: ownerError } = await admin.auth.admin.createUser({
      email: ownerEmail, password: randomToken(), email_confirm: false, user_metadata: { name: ownerName },
    });
    if (ownerError || !owner.user) throw new HttpError(500, ownerError?.message || 'Unable to create the owner account.', 'internal');

    // One DB call creates the company and the owner profile atomically.
    const { data: companyId, error: rpcError } = await admin.rpc('provision_company_records', {
      owner_id: owner.user.id, company_name: companyName, company_email: companyEmail,
      owner_name: ownerName, owner_email: ownerEmail, plan_name: plan,
    });
    if (rpcError || !companyId) {
      await admin.auth.admin.deleteUser(owner.user.id).catch(() => null);
      throw new HttpError(500, rpcError?.message || 'Unable to provision the company.', 'internal');
    }
    if (adminWhatsapp) {
      await admin.from('companies').update({ metadata: { admin_whatsapp: adminWhatsapp } }).eq('id', companyId);
    }
    await audit('company_provisioned', String(companyId), { owner_uid: owner.user.id, plan });
    return json({ companyId, ownerUid: owner.user.id, passwordResetLink: await recoveryLink(ownerEmail) });
  }

  throw new HttpError(400, 'Unknown action.', 'invalid-argument');
}));
