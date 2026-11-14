// manage-users: replaces createManagedUser / updateManagedUser / updateManagedUserSecure /
// deleteManagedUser / recordAuthenticationEvent (Firebase callables).
// Body: { action: 'create' | 'update' | 'update_secure' | 'delete' | 'record_event', ...fields }
import {
  HttpError, adminClient, assertAssignableRole, assertNotLastActiveAdmin, assertTargetCompany,
  json, readBody, requireCaller, requireUserManager, sanitizeOverrides, serve, writeAuditLog,
} from '../_shared/lib.ts';

const BAN_FOREVER = '876000h';

Deno.serve(serve(async (req) => {
  const caller = await requireCaller(req);
  const body = await readBody(req);
  const action = String(body.action || '');
  const admin = adminClient();

  // Login/logout audit trail (any signed-in, active user).
  if (action === 'record_event') {
    const { data: profile } = await admin.from('profiles').select('company_id,status,is_active').eq('id', caller.id).maybeSingle();
    if (!profile) throw new HttpError(403, 'User profile not found.', 'permission-denied');
    if (profile.status === 'suspended' || profile.is_active === false) throw new HttpError(403, 'This account is suspended.', 'permission-denied');
    const event = body.action_name === 'logout' ? 'logout' : 'login';
    await writeAuditLog(admin, { actorId: caller.id, companyId: profile.company_id, action: event, entityType: 'authentication' });
    return json({ success: true });
  }

  const actor = await requireUserManager(admin, caller);

  if (action === 'create') {
    const { name, email, phone = '', role = 'sales_rep', status = 'active', password, permission_overrides = {} } = body as Record<string, any>;
    if (!name || !email || !password || String(password).length < 6) {
      throw new HttpError(400, 'Name, email, and a password of at least 6 characters are required.', 'invalid-argument');
    }
    const companyId = actor.isSuper ? String(body.company_id || '') : actor.company_id;
    assertTargetCompany(actor, companyId);
    assertAssignableRole(actor, role);

    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email: String(email).trim().toLowerCase(),
      password,
      email_confirm: true,
      user_metadata: { name },
      ...(status !== 'active' ? { ban_duration: BAN_FOREVER } : {}),
    });
    if (createError || !created.user) {
      const exists = /already|registered|exists/i.test(createError?.message || '');
      throw new HttpError(exists ? 409 : 500, exists ? 'هذا البريد الإلكتروني مستخدم بالفعل.' : createError?.message || 'تعذر إنشاء المستخدم.', exists ? 'already-exists' : 'internal');
    }
    const { error: profileError } = await admin.from('profiles').insert({
      id: created.user.id,
      company_id: companyId,
      name,
      email: String(email).trim().toLowerCase(),
      phone,
      role,
      status,
      is_active: status === 'active',
      permission_overrides: sanitizeOverrides(permission_overrides),
    });
    if (profileError) {
      await admin.auth.admin.deleteUser(created.user.id).catch(() => null); // no orphan Auth user
      throw new HttpError(500, profileError.message, 'internal');
    }
    await writeAuditLog(admin, { actorId: caller.id, companyId, action: 'user_created', metadata: { target_user_id: created.user.id, role } });
    return json({ id: created.user.id });
  }

  if (action === 'update' || action === 'update_secure') {
    const id = String(body.id || '');
    if (!id) throw new HttpError(400, 'User id is required.', 'invalid-argument');
    if (id === caller.id) throw new HttpError(403, 'You cannot change your own role or permissions.', 'permission-denied');
    const { data: target } = await admin.from('profiles').select('*').eq('id', id).maybeSingle();
    if (!target) throw new HttpError(404, 'User not found.', 'not-found');
    assertTargetCompany(actor, target.company_id);

    const role = String(body.role || target.role);
    assertAssignableRole(actor, role);
    const status = String(body.status || target.status || 'active');
    const isActive = status === 'active';
    await assertNotLastActiveAdmin(admin, target.company_id, id, { role, status, is_active: isActive });

    const name = String(body.name ?? target.name ?? '').trim();
    const authUpdates: Record<string, unknown> = {
      user_metadata: { name },
      ban_duration: isActive ? 'none' : BAN_FOREVER,
    };
    if (action === 'update') {
      if (!body.email || !name) throw new HttpError(400, 'User id, name, and email are required.', 'invalid-argument');
      authUpdates.email = String(body.email).trim().toLowerCase();
      if (body.password) authUpdates.password = String(body.password);
    }
    const { error: authError } = await admin.auth.admin.updateUserById(id, authUpdates);
    if (authError) {
      const exists = /already|registered|exists/i.test(authError.message);
      throw new HttpError(exists ? 409 : 500, exists ? 'هذا البريد الإلكتروني مستخدم بالفعل.' : authError.message, exists ? 'already-exists' : 'internal');
    }

    const patch: Record<string, unknown> = {
      name,
      role,
      status,
      is_active: isActive,
      permission_overrides: sanitizeOverrides(body.permission_overrides ?? target.permission_overrides),
    };
    if (action === 'update') {
      patch.email = String(body.email).trim().toLowerCase();
      patch.phone = String(body.phone ?? target.phone ?? '');
    }
    const { error: updateError } = await admin.from('profiles').update(patch).eq('id', id);
    if (updateError) throw new HttpError(500, updateError.message, 'internal');
    await writeAuditLog(admin, {
      actorId: caller.id, companyId: target.company_id,
      action: isActive ? 'user_access_updated' : 'user_suspended', metadata: { target_user_id: id, role },
    });
    return json({ success: true });
  }

  if (action === 'delete') {
    const id = String(body.id || '');
    if (!id || id === caller.id) throw new HttpError(400, 'A different user id is required.', 'invalid-argument');
    const { data: target } = await admin.from('profiles').select('company_id,role').eq('id', id).maybeSingle();
    if (!target) throw new HttpError(404, 'User not found.', 'not-found');
    assertTargetCompany(actor, target.company_id);
    await assertNotLastActiveAdmin(admin, target.company_id, id, { role: target.role, status: 'revoked', is_active: false });

    await admin.from('profiles').delete().eq('id', id);
    const { error } = await admin.auth.admin.deleteUser(id);
    if (error) throw new HttpError(500, error.message, 'internal');
    await writeAuditLog(admin, { actorId: caller.id, companyId: target.company_id, action: 'user_revoked', metadata: { target_user_id: id } });
    return json({ success: true });
  }

  throw new HttpError(400, 'Unknown action.', 'invalid-argument');
}));
