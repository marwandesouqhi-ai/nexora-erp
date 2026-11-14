// invitations: replaces createInvitation / resendInvitation / revokeInvitation /
// listManagedInvitations / verifyInvitation / acceptInvitation (Firebase callables).
// Body: { action: 'create' | 'resend' | 'revoke' | 'list' | 'verify' | 'accept', ... }
// 'verify' and 'accept' are PUBLIC (the invitee has no account yet): deploy with --no-verify-jwt
// (see supabase/config.toml). Tokens are only ever stored as SHA-256 hashes.
import {
  HttpError, adminClient, assertAssignableRole, assertTargetCompany, findAuthUserByEmail, isValidEmail, json,
  normalizeEmail, randomToken, readBody, requireCaller, requireUserManager, sanitizeOverrides, serve, sha256Hex, writeAuditLog,
} from '../_shared/lib.ts';

const publicView = (invite: Record<string, any>, organizationName: string) => ({
  id: invite.id,
  email: invite.email,
  full_name: invite.full_name || '',
  job_title: invite.job_title || '',
  organization_name: organizationName,
  expires_at: invite.expires_at,
  status: invite.status,
});

/**
 * Sends the invitation e-mail through Resend (HTTPS API; Edge Functions cannot rely on SMTP).
 * Secrets: RESEND_API_KEY, MAIL_FROM, APP_BASE_URL. Returns false when mail is not configured.
 */
async function sendInvitationEmail(invite: Record<string, any>, organizationName: string, token: string): Promise<boolean> {
  const appUrl = (Deno.env.get('APP_BASE_URL') || '').replace(/\/$/, '');
  const apiKey = Deno.env.get('RESEND_API_KEY');
  const from = Deno.env.get('MAIL_FROM');
  if (!appUrl || !apiKey || !from) return false;
  const acceptUrl = `${appUrl}/accept-invitation?token=${encodeURIComponent(token)}`;
  const expires = new Date(invite.expires_at).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from,
      to: invite.email,
      subject: `You're invited to join ${organizationName} on NEXORA ERP`,
      text: `You have been invited to join ${organizationName} on NEXORA ERP. Accept your invitation: ${acceptUrl}. This invitation expires on ${expires}.`,
      html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;color:#172554"><h1 style="color:#2563eb">NEXORA ERP</h1><p>Hello${invite.full_name ? ` ${invite.full_name}` : ''},</p><p>You have been invited to join <strong>${organizationName}</strong> on NEXORA ERP.</p><p><a href="${acceptUrl}" style="display:inline-block;background:#2563eb;color:#fff;padding:14px 22px;border-radius:8px;text-decoration:none;font-weight:bold">Accept invitation</a></p><p>This secure, one-time invitation expires on ${expires}. Do not forward this message. If you were not expecting it, you can safely ignore it.</p></div>`,
    }),
  });
  if (!res.ok) throw new HttpError(502, `Invitation email failed: ${res.status}`, 'internal');
  return true;
}

const acceptUrlFor = (token: string) => `${(Deno.env.get('APP_BASE_URL') || '').replace(/\/$/, '')}/accept-invitation?token=${encodeURIComponent(token)}`;

Deno.serve(serve(async (req) => {
  const body = await readBody(req);
  const action = String(body.action || '');
  const admin = adminClient();

  // ── Public actions ────────────────────────────────────────────────────────
  if (action === 'verify' || action === 'accept') {
    const token = String(body.token || '');
    if (token.length < 32) throw new HttpError(400, 'Invalid invitation token.', 'invalid-argument');
    const hash = await sha256Hex(token);
    const { data: invite } = await admin.from('invitations').select('*').eq('token_hash', hash).maybeSingle();
    if (!invite) throw new HttpError(404, 'Invitation not found.', 'not-found');
    if (invite.status !== 'pending') throw new HttpError(412, 'This invitation is no longer active.', 'failed-precondition');
    if (new Date(invite.expires_at).getTime() <= Date.now()) {
      await admin.from('invitations').update({ status: 'expired' }).eq('id', invite.id);
      throw new HttpError(410, 'This invitation has expired.', 'deadline-exceeded');
    }
    const { data: company } = await admin.from('companies').select('name').eq('id', invite.company_id).maybeSingle();
    const organizationName = company?.name || 'your organization';

    if (action === 'verify') return json(publicView(invite, organizationName));

    const password = String(body.password || '');
    if (password.length < 8) throw new HttpError(400, 'A password of at least 8 characters is required.', 'invalid-argument');
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email: invite.email,
      password,
      email_confirm: true,
      user_metadata: { name: invite.full_name || '' },
    });
    if (createError || !created.user) {
      const exists = /already|registered|exists/i.test(createError?.message || '');
      throw new HttpError(exists ? 409 : 500, exists ? 'An account already exists for this email.' : createError?.message || 'Unable to accept invitation.', exists ? 'already-exists' : 'internal');
    }
    // The RPC re-validates status/hash/expiry under a row lock, creates the profile and marks it accepted.
    const { error: rpcError } = await admin.rpc('accept_company_invitation', {
      invite_id: invite.id, invite_hash: hash, account_id: created.user.id,
    });
    if (rpcError) {
      await admin.auth.admin.deleteUser(created.user.id).catch(() => null); // no orphan Auth user
      throw new HttpError(412, 'This invitation was already used or has expired.', 'failed-precondition');
    }
    await writeAuditLog(admin, { actorId: created.user.id, companyId: invite.company_id, action: 'invitation_accepted', metadata: { invitation_id: invite.id } });
    // The client signs in with signInWithPassword(email, password) afterwards.
    return json({ success: true, email: invite.email });
  }

  // ── Manager actions ───────────────────────────────────────────────────────
  const caller = await requireCaller(req);
  const actor = await requireUserManager(admin, caller);

  if (action === 'create') {
    const email = normalizeEmail(body.email);
    const companyId = String(body.company_id || actor.company_id || '').trim();
    const role = String(body.role || 'sales_rep');
    const hours = Math.min(Math.max(Number(body.expires_in_hours) || 168, 1), 24 * 30);
    if (!isValidEmail(email)) throw new HttpError(400, 'A valid email address is required.', 'invalid-argument');
    assertTargetCompany(actor, companyId);
    assertAssignableRole(actor, role);

    const { data: company } = await admin.from('companies').select('name').eq('id', companyId).maybeSingle();
    if (!company) throw new HttpError(404, 'Organization not found.', 'not-found');
    if (await findAuthUserByEmail(admin, email)) throw new HttpError(409, 'This email address already belongs to an account.', 'already-exists');
    const { data: duplicate } = await admin.from('invitations').select('id')
      .eq('company_id', companyId).eq('email', email).eq('status', 'pending').maybeSingle();
    if (duplicate) throw new HttpError(409, 'A pending invitation already exists for this email.', 'already-exists');

    const token = randomToken();
    const { data: invite, error } = await admin.from('invitations').insert({
      company_id: companyId,
      email,
      full_name: String(body.full_name || '').trim(),
      job_title: String(body.job_title || '').trim(),
      role,
      permission_overrides: sanitizeOverrides(body.permission_overrides),
      token_hash: await sha256Hex(token),
      status: 'pending',
      expires_at: new Date(Date.now() + hours * 3600 * 1000).toISOString(),
      created_by: caller.id,
    }).select('*').single();
    if (error) throw new HttpError(500, error.message, 'internal');

    const sent = await sendInvitationEmail(invite, company.name, token);
    if (sent) await admin.from('invitations').update({ sent_at: new Date().toISOString() }).eq('id', invite.id);
    await writeAuditLog(admin, { actorId: caller.id, companyId, action: 'invitation_sent', metadata: { invitation_id: invite.id, email, email_sent: sent } });
    // With no mail provider configured the manager receives the link to share manually.
    return json({ id: invite.id, status: 'pending', expires_at: invite.expires_at, email_sent: sent, ...(sent ? {} : { accept_url: acceptUrlFor(token) }) });
  }

  if (action === 'list') {
    const companyId = String(body.company_id || actor.company_id || '');
    assertTargetCompany(actor, companyId);
    const { data: company } = await admin.from('companies').select('name').eq('id', companyId).maybeSingle();
    const { data } = await admin.from('invitations').select('*').eq('company_id', companyId).order('created_at', { ascending: false }).limit(100);
    return json((data || []).map((i) => publicView(i, company?.name || '')));
  }

  const id = String(body.id || '');
  const { data: invite } = await admin.from('invitations').select('*').eq('id', id).maybeSingle();
  if (!invite) throw new HttpError(404, 'Invitation not found.', 'not-found');
  assertTargetCompany(actor, invite.company_id);

  if (action === 'resend') {
    if (invite.status === 'accepted' || invite.status === 'revoked') throw new HttpError(412, 'This invitation cannot be resent.', 'failed-precondition');
    const token = randomToken();
    const expiresAt = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();
    const { data: updated, error } = await admin.from('invitations')
      .update({ token_hash: await sha256Hex(token), status: 'pending', expires_at: expiresAt })
      .eq('id', id).select('*').single();
    if (error) throw new HttpError(500, error.message, 'internal');
    const { data: company } = await admin.from('companies').select('name').eq('id', invite.company_id).maybeSingle();
    const sent = await sendInvitationEmail(updated, company?.name || 'your organization', token);
    if (sent) await admin.from('invitations').update({ sent_at: new Date().toISOString() }).eq('id', id);
    await writeAuditLog(admin, { actorId: caller.id, companyId: invite.company_id, action: 'invitation_resent', metadata: { invitation_id: id } });
    return json({ success: true, email_sent: sent, ...(sent ? {} : { accept_url: acceptUrlFor(token) }) });
  }

  if (action === 'revoke') {
    if (invite.status !== 'pending' && invite.status !== 'failed') throw new HttpError(412, 'Only open invitations can be revoked.', 'failed-precondition');
    const { error } = await admin.from('invitations').update({ status: 'revoked', token_hash: null }).eq('id', id);
    if (error) throw new HttpError(500, error.message, 'internal');
    await writeAuditLog(admin, { actorId: caller.id, companyId: invite.company_id, action: 'invitation_revoked', metadata: { invitation_id: id } });
    return json({ success: true });
  }

  throw new HttpError(400, 'Unknown action.', 'invalid-argument');
}));
