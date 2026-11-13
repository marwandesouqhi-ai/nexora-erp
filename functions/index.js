const functions = require('firebase-functions');
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const nodemailer = require('nodemailer');

admin.initializeApp();

const envFromDotenv = (() => {
    try {
        const envPath = path.join(__dirname, '..', '.env');
        if (!fs.existsSync(envPath)) return {};
        return fs.readFileSync(envPath, 'utf8').split(/\r?\n/).reduce((acc, line) => {
            const match = line.match(/^([^=]+)=([\s\S]*)$/);
            if (match) acc[match[1]] = match[2];
            return acc;
        }, {});
    } catch (error) {
        functions.logger.warn('Unable to load .env from functions parent directory', { error: error?.message });
        return {};
    }
})();

const config = functions.config?.().ultramsg || {};
const rawInstanceId = process.env.ULTRAMSG_INSTANCE_ID || process.env.VITE_ULTRAMSG_INSTANCE_ID || envFromDotenv.VITE_ULTRAMSG_INSTANCE_ID || config.instance_id || config.instanceId;
const ULTRAMSG_INSTANCE_ID = rawInstanceId?.replace(/^instance/i, '') || '';
const ULTRAMSG_TOKEN = process.env.ULTRAMSG_TOKEN || process.env.VITE_ULTRAMSG_TOKEN || envFromDotenv.VITE_ULTRAMSG_TOKEN || config.token;
const whatsappRuntimeOptions = process.env.FUNCTIONS_EMULATOR === 'true'
    ? {}
    : { enforceAppCheck: true };
const smtpRuntimeOptions = { secrets: ['SMTP_PASSWORD'] };

const requireUserManager = async (context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Authentication is required.');
    }

    const userSnap = await admin.firestore().doc(`users/${context.auth.uid}`).get();
    
    // في حالة المحاكي نعيد البيانات بدون رمي خطأ حتى لو لم يكن موجوداً
    if (!userSnap.exists && process.env.FUNCTIONS_EMULATOR === 'true') {
        return { role: 'admin', is_super_admin: true };
    }

    if (!userSnap.exists) {
        throw new functions.https.HttpsError('permission-denied', 'User not found.');
    }

    const userData = userSnap.data();
    const role = userData?.role;
    const overrides = userData?.permission_overrides || {};
    
    let canManageUsers = false;
    
    if (userData?.is_super_admin === true) {
        canManageUsers = true;
    } else if (role === 'owner' || role === 'admin') {
        canManageUsers = overrides['can_manage_users'] !== false;
    } else {
        canManageUsers = overrides['can_manage_users'] === true;
    }

    if (!canManageUsers && process.env.FUNCTIONS_EMULATOR !== 'true') {
        throw new functions.https.HttpsError('permission-denied', 'User management permission is required.');
    }
    
    return userData;
};

const PLATFORM_ROLES = new Set(['platform_admin', 'billing_admin', 'support_agent']);

const requirePlatformAdmin = async (context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Authentication is required.');
    }
    const staffSnap = await admin.firestore().doc(`platform_staff/${context.auth.uid}`).get();
    const staff = staffSnap.data();
    if (!staffSnap.exists || staff?.role !== 'platform_admin' || staff?.status === 'suspended' || staff?.is_active === false) {
        throw new functions.https.HttpsError('permission-denied', 'Platform administrator access is required.');
    }
    return staff;
};

const writePlatformAuditLog = async ({ actorId, action, target = '', metadata = {} }) => {
    await admin.firestore().collection('platform_audit_logs').add({
        actor_id: actorId,
        action,
        target,
        metadata,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });
};

// Keep the role vocabulary in one place.  New product-facing titles are mapped
// to the established Firestore role model rather than creating a parallel ACL.
const MANAGED_ROLES = new Set([
    'owner', 'admin', 'manager', 'accountant', 'sales_rep',
    'general_manager', 'sales_manager', 'inventory_manager',
    'purchasing_manager', 'warehouse_employee', 'viewer', 'custom',
]);
const MANAGEABLE_PERMISSION_KEYS = new Set([
    'can_view_dashboard', 'can_view_operations', 'can_view_reports', 'can_view_activity_log', 'can_view_financials',
    'can_view_sales', 'can_create_sales', 'can_edit_sales', 'can_delete_sales',
    'can_view_inventory', 'can_edit_inventory', 'can_view_purchases', 'can_create_purchases',
    'can_view_customers', 'can_edit_customers', 'can_delete_customers',
    'can_view_suppliers', 'can_edit_suppliers', 'can_view_debts', 'can_edit_debts',
    'can_view_accounts', 'can_manage_accounts', 'can_view_employees', 'can_edit_employees',
    'can_manage_payroll', 'can_manage_users', 'can_manage_settings', 'can_edit_prices',
    'can_manage_automations', 'can_use_ai_assistant',
]);

const normalizeEmail = (email) => String(email || '').trim().toLowerCase();
const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const isActiveAdmin = (user) => user?.is_active !== false && user?.status !== 'suspended'
    && ['owner', 'admin'].includes(user?.role);
const tokenHash = (token) => crypto.createHash('sha256').update(token).digest('hex');
const newInvitationToken = () => crypto.randomBytes(32).toString('base64url');

const sanitizeOverrides = (input) => {
    if (!input || typeof input !== 'object' || Array.isArray(input)) return {};
    return Object.fromEntries(Object.entries(input)
        .filter(([key, value]) => MANAGEABLE_PERMISSION_KEYS.has(key) && typeof value === 'boolean'));
};

const assertTargetCompany = (actor, companyId) => {
    if (!companyId) {
        throw new functions.https.HttpsError('invalid-argument', 'An organization is required.');
    }
    if (actor?.is_super_admin !== true && actor?.company_id !== companyId) {
        throw new functions.https.HttpsError('permission-denied', 'You can only manage users in your organization.');
    }
};

const assertAssignableRole = (actor, role) => {
    if (!MANAGED_ROLES.has(role)) {
        throw new functions.https.HttpsError('invalid-argument', 'Invalid role.');
    }
    if (actor?.is_super_admin !== true && role === 'owner') {
        throw new functions.https.HttpsError('permission-denied', 'Only a system administrator can assign an owner role.');
    }
};

const writeAuditLog = async ({ actorId = '', targetUserId = '', companyId = '', action, metadata = {} }) => {
    await admin.firestore().collection('audit_logs').add({
        actor_user_id: actorId,
        target_user_id: targetUserId,
        company_id: companyId,
        action,
        metadata,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });
};

const assertNotLastActiveAdmin = async (companyId, targetId, nextUser) => {
    if (isActiveAdmin(nextUser)) return;
    const admins = await admin.firestore().collection('users')
        .where('company_id', '==', companyId).get();
    const remaining = admins.docs.some((snap) => snap.id !== targetId && isActiveAdmin(snap.data()));
    if (!remaining) {
        throw new functions.https.HttpsError('failed-precondition', 'The last active organization administrator cannot be suspended, revoked, or demoted.');
    }
};

const invitationPublicView = (invite) => ({
    id: invite.id,
    email: invite.email,
    full_name: invite.full_name || '',
    job_title: invite.job_title || '',
    organization_name: invite.organization_name || '',
    expires_at: invite.expires_at?.toDate?.().toISOString?.() || null,
    status: invite.status,
});

const sendInvitationEmail = async (invite, token) => {
    const appUrl = (process.env.APP_BASE_URL || envFromDotenv.APP_BASE_URL || '').replace(/\/$/, '');
    const smtpHost = process.env.SMTP_HOST || envFromDotenv.SMTP_HOST || 'smtp.gmail.com';
    const smtpPort = Number(process.env.SMTP_PORT || envFromDotenv.SMTP_PORT || 465);
    const smtpUser = process.env.SMTP_USER || envFromDotenv.SMTP_USER;
    const smtpPassword = process.env.SMTP_PASSWORD || envFromDotenv.SMTP_PASSWORD;
    const smtpFrom = process.env.SMTP_FROM || envFromDotenv.SMTP_FROM || smtpUser;
    if (!appUrl || !smtpUser || !smtpPassword || !smtpFrom) {
        throw new functions.https.HttpsError('failed-precondition', 'Invitation email is not configured. Set APP_BASE_URL and SMTP credentials.');
    }
    const acceptUrl = `${appUrl}/accept-invitation?token=${encodeURIComponent(token)}`;
    const expiresAt = invite.expires_at.toDate().toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
    const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465,
        auth: { user: smtpUser, pass: smtpPassword },
    });
    const result = await transporter.sendMail({
        from: smtpFrom,
        to: invite.email,
        subject: `You're invited to join ${invite.organization_name} on NEXORA ERP`,
        text: `You have been invited to join ${invite.organization_name} on NEXORA ERP. Accept your invitation: ${acceptUrl}. This invitation expires on ${expiresAt}.`,
        html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;color:#172554"><h1 style="color:#2563eb">NEXORA ERP</h1><p>Hello${invite.full_name ? ` ${invite.full_name}` : ''},</p><p>You have been invited to join <strong>${invite.organization_name}</strong> on NEXORA ERP.</p><p><a href="${acceptUrl}" style="display:inline-block;background:#2563eb;color:#fff;padding:14px 22px;border-radius:8px;text-decoration:none;font-weight:bold">Accept invitation</a></p><p>This secure, one-time invitation expires on ${expiresAt}. Do not forward this message. If you were not expecting it, you can safely ignore it.</p></div>`,
    });
    return result.messageId || '';
};

const formatPhoneNumber = (phone) => {
    if (!phone) return phone;
    let cleaned = phone.replace(/\D/g, '');
    if (cleaned.startsWith('0')) {
        cleaned = '20' + cleaned.substring(1);
    }
    if (cleaned.length === 10) {
        cleaned = '20' + cleaned;
    }
    return cleaned;
};

const ensureUltraMsgConfig = () => {
    if (!ULTRAMSG_INSTANCE_ID || !ULTRAMSG_TOKEN) {
        throw new functions.https.HttpsError(
            'failed-precondition',
            'UltraMsg credentials are not configured on the server.'
        );
    }
};

const buildUltraMsgUrl = (path, params = {}) => {
    const url = new URL(`https://api.ultramsg.com/wa/instance${ULTRAMSG_INSTANCE_ID}/${path}`);
    Object.entries({ token: ULTRAMSG_TOKEN, ...params }).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
            url.searchParams.append(key, String(value));
        }
    });
    return url.toString();
};

const callUltraMsg = async (path, params = {}, method = 'POST') => {
    ensureUltraMsgConfig();

    const url = buildUltraMsgUrl(path, method === 'GET' ? params : {});
    const init = { method };

    if (method === 'POST') {
        init.headers = { 'Content-Type': 'application/x-www-form-urlencoded' };
        init.body = new URLSearchParams({ token: ULTRAMSG_TOKEN, ...params });
    }

    try {
        const response = await fetch(url, init);
        const text = await response.text();
        let result;

        try {
            result = JSON.parse(text);
        } catch (parseError) {
            functions.logger.error('UltraMsg returned invalid JSON', {
                path,
                responseText: text,
                error: parseError?.message,
            });
            throw new functions.https.HttpsError(
                'internal',
                `UltraMsg returned invalid JSON: ${text}`
            );
        }

        if (!response.ok) {
            functions.logger.error('UltraMsg responded with an error', {
                path,
                status: response.status,
                result,
            });
            throw new functions.https.HttpsError(
                'internal',
                `UltraMsg request failed: ${response.status}`,
                { path, status: response.status, result }
            );
        }

        if (result.sent === 'true' || result.success === true || result.status === 'sent') {
            return result;
        }

        if (result.error || result.message) {
            functions.logger.error('UltraMsg response indicates failure', {
                path,
                result,
            });
            throw new functions.https.HttpsError(
                'internal',
                `UltraMsg response indicates failure: ${result.error || result.message || 'Unknown'}`,
                { path, result }
            );
        }

        return result;
    } catch (error) {
        if (error instanceof functions.https.HttpsError) {
            throw error;
        }

        functions.logger.error('UltraMsg request failed unexpectedly', {
            path,
            error: error?.message || error,
        });
        throw new functions.https.HttpsError(
            'internal',
            `UltraMsg request failed: ${error?.message || 'Unknown error'}`
        );
    }
};

exports.sendWhatsappMessage = functions.runWith(whatsappRuntimeOptions).https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Authentication is required.');
    }

    const { phone, message, priority = '1' } = data || {};

    if (!phone || !message) {
        throw new functions.https.HttpsError(
            'invalid-argument',
            'Phone number and message are required.'
        );
    }

    const formattedPhone = formatPhoneNumber(phone);
    if (!/^20\d{10}$/.test(formattedPhone)) {
        throw new functions.https.HttpsError('invalid-argument', 'A valid Egyptian phone number is required.');
    }
    if (String(message).trim().length > 4096) {
        throw new functions.https.HttpsError('invalid-argument', 'WhatsApp message is too long.');
    }
    const result = await callUltraMsg('chat', {
        to: formattedPhone,
        body: String(message).trim(),
        priority,
    });

    return { success: true, result };
});

exports.checkWhatsappConnection = functions.runWith(whatsappRuntimeOptions).https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Authentication is required.');
    }

    ensureUltraMsgConfig();

    try {
        const result = await callUltraMsg('me', {}, 'GET');
        return { success: true, result };
    } catch (error) {
        if (error instanceof functions.https.HttpsError) {
            throw error;
        }

        functions.logger.error('checkWhatsappConnection failed', {
            error: error?.message || error,
        });
        throw new functions.https.HttpsError(
            'internal',
            error?.message || 'UltraMsg connection check failed'
        );
    }
});

exports.createManagedUser = functions.https.onCall(async (data, context) => {
    const creatorData = await requireUserManager(context);
    const { name, email, phone = '', role = 'sales_rep', status = 'active', password, permission_overrides = {}, company_id = '' } = data || {};
    
    if (!name || !email || !password || password.length < 6) {
        throw new functions.https.HttpsError('invalid-argument', 'Name, email, and a password of at least 6 characters are required.');
    }

    let targetCompanyId = company_id;
    if (creatorData?.is_super_admin !== true) {
        targetCompanyId = creatorData?.company_id || '';
    }
    assertTargetCompany(creatorData, targetCompanyId);
    assertAssignableRole(creatorData, role);

    try {
        const authUser = await admin.auth().createUser({ email, password, disabled: status !== 'active', displayName: name });
        await admin.auth().setCustomUserClaims(authUser.uid, { role, company_id: targetCompanyId });
        await admin.firestore().doc(`users/${authUser.uid}`).set({
            name, email, phone, role, status, permission_overrides,
            company_id: targetCompanyId || '',
            created_at: admin.firestore.FieldValue.serverTimestamp(),
            updated_at: admin.firestore.FieldValue.serverTimestamp(),
        });
        return { id: authUser.uid };
    } catch (error) {
        const code = error?.code === 'auth/email-already-exists' ? 'already-exists' : 'internal';
        const message = code === 'already-exists'
            ? 'هذا البريد الإلكتروني مستخدم بالفعل.'
            : error?.message || 'تعذر إنشاء المستخدم.';
        throw new functions.https.HttpsError(code, message);
    }
});

exports.updateManagedUser = functions.https.onCall(async (data, context) => {
    const creatorData = await requireUserManager(context);
    const { id, name, email, phone = '', role = 'sales_rep', status = 'active', password, permission_overrides = {}, company_id } = data || {};
    if (!id || !name || !email) {
        throw new functions.https.HttpsError('invalid-argument', 'User id, name, and email are required.');
    }

    let targetCompanyId = company_id;
    if (creatorData?.is_super_admin !== true) {
        targetCompanyId = creatorData?.company_id;
    }

    if (id === context.auth.uid) {
        throw new functions.https.HttpsError('permission-denied', 'You cannot change your own role or permissions.');
    }
    const targetSnapshot = await admin.firestore().doc(`users/${id}`).get();
    if (!targetSnapshot.exists) throw new functions.https.HttpsError('not-found', 'User not found.');
    const targetUser = targetSnapshot.data();
    assertTargetCompany(creatorData, targetUser.company_id);
    assertAssignableRole(creatorData, role);
    await assertNotLastActiveAdmin(targetUser.company_id, id, { ...targetUser, role, status, is_active: status === 'active' });

    try {
        const authUpdates = { email, displayName: name, disabled: status !== 'active' };
        if (password) authUpdates.password = password;
        await admin.auth().updateUser(id, authUpdates);
        await admin.auth().setCustomUserClaims(id, { role, ...(targetCompanyId ? { company_id: targetCompanyId } : {}) });
        const updateData = {
            name, email, phone, role, status, permission_overrides,
            updated_at: admin.firestore.FieldValue.serverTimestamp(),
        };
        if (targetCompanyId !== undefined) updateData.company_id = targetCompanyId;
        await admin.firestore().doc(`users/${id}`).set(updateData, { merge: true });
        return { success: true };
    } catch (error) {
        if (error?.code === 'auth/user-not-found') {
            throw new functions.https.HttpsError('not-found', 'المستخدم غير موجود.');
        }
        if (error?.code === 'auth/email-already-exists') {
            throw new functions.https.HttpsError('already-exists', 'هذا البريد الإلكتروني مستخدم بالفعل.');
        }
        throw new functions.https.HttpsError('internal', error?.message || 'تعذر تحديث المستخدم.');
    }
});

exports.deleteManagedUser = functions.https.onCall(async (data, context) => {
    const actor = await requireUserManager(context);
    const { id } = data || {};
    if (!id || id === context.auth.uid) {
        throw new functions.https.HttpsError('invalid-argument', 'A different user id is required.');
    }

    const targetSnapshot = await admin.firestore().doc(`users/${id}`).get();
    if (!targetSnapshot.exists) throw new functions.https.HttpsError('not-found', 'User not found.');
    const target = targetSnapshot.data();
    assertTargetCompany(actor, target.company_id);
    await assertNotLastActiveAdmin(target.company_id, id, { ...target, status: 'revoked', is_active: false });

    await admin.auth().deleteUser(id);
    await admin.firestore().doc(`users/${id}`).delete();
    await writeAuditLog({ actorId: context.auth.uid, targetUserId: id, companyId: target.company_id, action: 'user_revoked' });
    return { success: true };
});

/**
 * Invitation workflow.  Tokens are intentionally never stored in plaintext.
 * All membership/profile/claim writes use the Admin SDK and therefore cannot
 * be forged through the client Firestore SDK.
 */
exports.createInvitation = functions.runWith(smtpRuntimeOptions).https.onCall(async (data, context) => {
    const actor = await requireUserManager(context);
    const email = normalizeEmail(data?.email);
    const companyId = String(data?.company_id || actor.company_id || '').trim();
    const role = String(data?.role || 'sales_rep');
    const expiresInHours = Math.min(Math.max(Number(data?.expires_in_hours) || 168, 1), 24 * 30);
    if (!isValidEmail(email)) throw new functions.https.HttpsError('invalid-argument', 'A valid email address is required.');
    assertTargetCompany(actor, companyId);
    assertAssignableRole(actor, role);

    const companySnap = await admin.firestore().doc(`companies/${companyId}`).get();
    if (!companySnap.exists) throw new functions.https.HttpsError('not-found', 'Organization not found.');
    try {
        await admin.auth().getUserByEmail(email);
        throw new functions.https.HttpsError('already-exists', 'This email address already belongs to an account.');
    } catch (error) {
        if (error instanceof functions.https.HttpsError) throw error;
        if (error?.code !== 'auth/user-not-found') throw new functions.https.HttpsError('internal', error?.message || 'Unable to validate the email.');
    }

    const now = admin.firestore.Timestamp.now();
    const expiresAt = admin.firestore.Timestamp.fromMillis(now.toMillis() + expiresInHours * 60 * 60 * 1000);
    const token = newInvitationToken();
    const inviteRef = admin.firestore().collection('invitations').doc();
    const invite = {
        id: inviteRef.id,
        email,
        full_name: String(data?.full_name || '').trim(),
        job_title: String(data?.job_title || '').trim(),
        role,
        permission_overrides: sanitizeOverrides(data?.permission_overrides),
        company_id: companyId,
        organization_name: companySnap.data().name || companySnap.data().commercial_name || 'your organization',
        inviter_user_id: context.auth.uid,
        inviter_name: actor.name || actor.email || '',
        token_hash: tokenHash(token),
        status: 'pending',
        email_status: 'queued',
        expires_at: expiresAt,
        created_at: admin.firestore.FieldValue.serverTimestamp(),
        updated_at: admin.firestore.FieldValue.serverTimestamp(),
        resend_count: 0,
    };
    await admin.firestore().runTransaction(async (tx) => {
        const duplicate = await tx.get(admin.firestore().collection('invitations')
            .where('company_id', '==', companyId).where('email', '==', email).where('status', '==', 'pending'));
        if (!duplicate.empty) throw new functions.https.HttpsError('already-exists', 'A pending invitation already exists for this email.');
        tx.create(inviteRef, invite);
    });
    try {
        const messageId = await sendInvitationEmail(invite, token);
        await inviteRef.update({ email_status: 'sent', message_id: messageId, sent_at: admin.firestore.FieldValue.serverTimestamp(), updated_at: admin.firestore.FieldValue.serverTimestamp() });
        await writeAuditLog({ actorId: context.auth.uid, companyId, action: 'invitation_sent', metadata: { invitation_id: inviteRef.id, email, message_id: messageId } });
        return { id: inviteRef.id, status: 'pending', expires_at: expiresAt.toDate().toISOString() };
    } catch (error) {
        await inviteRef.update({ status: 'failed', email_status: 'failed', delivery_error: error?.message || 'Delivery failed', updated_at: admin.firestore.FieldValue.serverTimestamp() });
        await writeAuditLog({ actorId: context.auth.uid, companyId, action: 'invitation_failed', metadata: { invitation_id: inviteRef.id, email } });
        throw error;
    }
});

exports.verifyInvitation = functions.https.onCall(async (data) => {
    const token = String(data?.token || '');
    if (token.length < 32) throw new functions.https.HttpsError('invalid-argument', 'Invalid invitation token.');
    const snapshot = await admin.firestore().collection('invitations').where('token_hash', '==', tokenHash(token)).limit(1).get();
    if (snapshot.empty) throw new functions.https.HttpsError('not-found', 'Invitation not found.');
    const invite = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
    if (invite.status !== 'pending') throw new functions.https.HttpsError('failed-precondition', 'This invitation is no longer active.');
    if (!invite.expires_at || invite.expires_at.toMillis() <= Date.now()) {
        await snapshot.docs[0].ref.update({ status: 'expired', updated_at: admin.firestore.FieldValue.serverTimestamp() });
        throw new functions.https.HttpsError('deadline-exceeded', 'This invitation has expired.');
    }
    return invitationPublicView(invite);
});

exports.acceptInvitation = functions.https.onCall(async (data) => {
    const token = String(data?.token || '');
    const password = String(data?.password || '');
    if (token.length < 32 || password.length < 8) throw new functions.https.HttpsError('invalid-argument', 'A valid token and a password of at least 8 characters are required.');
    const matches = await admin.firestore().collection('invitations').where('token_hash', '==', tokenHash(token)).limit(1).get();
    if (matches.empty) throw new functions.https.HttpsError('not-found', 'Invitation not found.');
    const inviteRef = matches.docs[0].ref;
    const invite = matches.docs[0].data();
    if (invite.status !== 'pending' || !invite.expires_at || invite.expires_at.toMillis() <= Date.now()) {
        if (invite.status === 'pending') await inviteRef.update({ status: 'expired', updated_at: admin.firestore.FieldValue.serverTimestamp() });
        throw new functions.https.HttpsError('failed-precondition', 'This invitation is no longer valid.');
    }

    let authUser;
    try {
        authUser = await admin.auth().createUser({ email: invite.email, password, displayName: invite.full_name || undefined, emailVerified: true });
        await admin.auth().setCustomUserClaims(authUser.uid, { role: invite.role, company_id: invite.company_id });
        await admin.firestore().runTransaction(async (tx) => {
            const current = await tx.get(inviteRef);
            const currentInvite = current.data();
            if (!current.exists || currentInvite.status !== 'pending' || currentInvite.token_hash !== tokenHash(token) || currentInvite.expires_at.toMillis() <= Date.now()) {
                throw new functions.https.HttpsError('failed-precondition', 'This invitation was already used or has expired.');
            }
            tx.create(admin.firestore().doc(`users/${authUser.uid}`), {
                uid: authUser.uid,
                name: currentInvite.full_name || '', email: currentInvite.email, job_title: currentInvite.job_title || '',
                role: currentInvite.role, permission_overrides: currentInvite.permission_overrides || {},
                company_id: currentInvite.company_id, company_name: currentInvite.organization_name || '',
                status: 'active', is_active: true, invited_by: currentInvite.inviter_user_id,
                invitation_id: inviteRef.id, created_at: admin.firestore.FieldValue.serverTimestamp(), updated_at: admin.firestore.FieldValue.serverTimestamp(),
            });
            tx.update(inviteRef, { status: 'accepted', accepted_at: admin.firestore.FieldValue.serverTimestamp(), accepted_by: authUser.uid, token_hash: admin.firestore.FieldValue.delete(), updated_at: admin.firestore.FieldValue.serverTimestamp() });
            tx.create(admin.firestore().collection('audit_logs').doc(), { actor_user_id: authUser.uid, target_user_id: authUser.uid, company_id: currentInvite.company_id, action: 'invitation_accepted', metadata: { invitation_id: inviteRef.id }, timestamp: admin.firestore.FieldValue.serverTimestamp() });
        });
    } catch (error) {
        if (authUser?.uid) await admin.auth().deleteUser(authUser.uid).catch(() => {});
        if (error instanceof functions.https.HttpsError) throw error;
        if (error?.code === 'auth/email-already-exists') throw new functions.https.HttpsError('already-exists', 'An account already exists for this email.');
        throw new functions.https.HttpsError('internal', error?.message || 'Unable to accept invitation.');
    }
    return { custom_token: await admin.auth().createCustomToken(authUser.uid) };
});

exports.listManagedInvitations = functions.https.onCall(async (data, context) => {
    const actor = await requireUserManager(context);
    const companyId = String(data?.company_id || actor.company_id || '');
    assertTargetCompany(actor, companyId);
    const snapshot = await admin.firestore().collection('invitations').where('company_id', '==', companyId).limit(100).get();
    return snapshot.docs.map((snap) => invitationPublicView({ id: snap.id, ...snap.data() }));
});

exports.resendInvitation = functions.runWith(smtpRuntimeOptions).https.onCall(async (data, context) => {
    const actor = await requireUserManager(context);
    const inviteRef = admin.firestore().doc(`invitations/${String(data?.id || '')}`);
    const snap = await inviteRef.get();
    if (!snap.exists) throw new functions.https.HttpsError('not-found', 'Invitation not found.');
    const invite = { id: snap.id, ...snap.data() };
    assertTargetCompany(actor, invite.company_id);
    if (invite.status === 'accepted' || invite.status === 'revoked') throw new functions.https.HttpsError('failed-precondition', 'This invitation cannot be resent.');
    const token = newInvitationToken();
    const expiresAt = admin.firestore.Timestamp.fromMillis(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const next = { ...invite, token_hash: tokenHash(token), status: 'pending', email_status: 'queued', expires_at: expiresAt };
    await inviteRef.update({ token_hash: next.token_hash, status: 'pending', email_status: 'queued', expires_at: expiresAt, resend_count: (invite.resend_count || 0) + 1, updated_at: admin.firestore.FieldValue.serverTimestamp() });
    try {
        const messageId = await sendInvitationEmail(next, token);
        await inviteRef.update({ email_status: 'sent', message_id: messageId, sent_at: admin.firestore.FieldValue.serverTimestamp() });
        await writeAuditLog({ actorId: context.auth.uid, companyId: invite.company_id, action: 'invitation_resent', metadata: { invitation_id: invite.id } });
        return { success: true };
    } catch (error) {
        await inviteRef.update({ status: 'failed', email_status: 'failed', delivery_error: error?.message || 'Delivery failed' });
        throw error;
    }
});

exports.revokeInvitation = functions.https.onCall(async (data, context) => {
    const actor = await requireUserManager(context);
    const inviteRef = admin.firestore().doc(`invitations/${String(data?.id || '')}`);
    const snap = await inviteRef.get();
    if (!snap.exists) throw new functions.https.HttpsError('not-found', 'Invitation not found.');
    const invite = snap.data();
    assertTargetCompany(actor, invite.company_id);
    if (invite.status !== 'pending' && invite.status !== 'failed') throw new functions.https.HttpsError('failed-precondition', 'Only open invitations can be revoked.');
    await inviteRef.update({ status: 'revoked', token_hash: admin.firestore.FieldValue.delete(), revoked_at: admin.firestore.FieldValue.serverTimestamp(), updated_at: admin.firestore.FieldValue.serverTimestamp() });
    await writeAuditLog({ actorId: context.auth.uid, companyId: invite.company_id, action: 'invitation_revoked', metadata: { invitation_id: inviteRef.id } });
    return { success: true };
});

exports.updateManagedUserSecure = functions.https.onCall(async (data, context) => {
    const actor = await requireUserManager(context);
    const id = String(data?.id || '');
    if (!id || id === context.auth.uid) throw new functions.https.HttpsError('invalid-argument', 'You cannot modify your own access.');
    const ref = admin.firestore().doc(`users/${id}`);
    const snap = await ref.get();
    if (!snap.exists) throw new functions.https.HttpsError('not-found', 'User not found.');
    const existing = snap.data();
    assertTargetCompany(actor, existing.company_id);
    const role = String(data?.role || existing.role);
    assertAssignableRole(actor, role);
    const next = { ...existing, role, status: data?.status || existing.status, is_active: data?.status ? data.status === 'active' : existing.is_active };
    await assertNotLastActiveAdmin(existing.company_id, id, next);
    const update = {
        role, permission_overrides: sanitizeOverrides(data?.permission_overrides),
        status: next.status, is_active: next.is_active, name: String(data?.name ?? existing.name ?? '').trim(),
        job_title: String(data?.job_title ?? existing.job_title ?? '').trim(), updated_at: admin.firestore.FieldValue.serverTimestamp(),
    };
    await admin.auth().updateUser(id, { displayName: update.name || undefined, disabled: !next.is_active });
    await admin.auth().setCustomUserClaims(id, { role, company_id: existing.company_id });
    await ref.update(update);
    await writeAuditLog({ actorId: context.auth.uid, targetUserId: id, companyId: existing.company_id, action: next.is_active ? 'user_access_updated' : 'user_suspended', metadata: { role } });
    return { success: true };
});

exports.recordAuthenticationEvent = functions.https.onCall(async (data, context) => {
    if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Authentication is required.');
    const action = data?.action === 'logout' ? 'logout' : 'login';
    const userRef = admin.firestore().doc(`users/${context.auth.uid}`);
    const user = await userRef.get();
    if (!user.exists) throw new functions.https.HttpsError('permission-denied', 'User profile not found.');
    if (user.data().status === 'suspended' || user.data().is_active === false) {
        throw new functions.https.HttpsError('permission-denied', 'This account is suspended.');
    }
    if (action === 'login') await userRef.update({ last_login_at: admin.firestore.FieldValue.serverTimestamp() });
    await writeAuditLog({ actorId: context.auth.uid, targetUserId: context.auth.uid, companyId: user.data().company_id || '', action });
    return { success: true };
});

// Platform CRM accounts are intentionally separate from tenant ERP users.
// These endpoints use the Admin SDK so browser clients can never create or
// elevate staff profiles by writing Firestore directly.
exports.provisionPlatformStaff = functions.https.onCall(async (data, context) => {
    await requirePlatformAdmin(context);
    const email = normalizeEmail(data?.email);
    const name = String(data?.name || '').trim();
    const role = String(data?.role || '');
    if (!isValidEmail(email) || !name || !PLATFORM_ROLES.has(role)) {
        throw new functions.https.HttpsError('invalid-argument', 'A name, valid email, and platform role are required.');
    }

    let account;
    try {
        account = await admin.auth().getUserByEmail(email);
    } catch (error) {
        if (error?.code !== 'auth/user-not-found') throw error;
        account = await admin.auth().createUser({
            email,
            displayName: name,
            password: crypto.randomBytes(32).toString('base64url'),
            emailVerified: false,
        });
    }
    if ((await admin.firestore().doc(`users/${account.uid}`).get()).exists) {
        throw new functions.https.HttpsError('failed-precondition', 'ERP users cannot be provisioned as platform CRM staff. Use a separate account.');
    }
    const resetLink = await admin.auth().generatePasswordResetLink(email);
    await admin.firestore().doc(`platform_staff/${account.uid}`).set({
        email,
        name,
        role,
        status: 'active',
        is_active: true,
        created_at: admin.firestore.FieldValue.serverTimestamp(),
        updated_at: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    await writePlatformAuditLog({ actorId: context.auth.uid, target: account.uid, action: 'platform_staff_provisioned', metadata: { role } });
    return { passwordResetLink: resetLink };
});

exports.updatePlatformStaff = functions.https.onCall(async (data, context) => {
    await requirePlatformAdmin(context);
    const userId = String(data?.userId || '');
    const role = String(data?.role || '');
    if (!userId || !PLATFORM_ROLES.has(role) || userId === context.auth.uid) {
        throw new functions.https.HttpsError('invalid-argument', 'Invalid staff update.');
    }
    const ref = admin.firestore().doc(`platform_staff/${userId}`);
    if (!(await ref.get()).exists) throw new functions.https.HttpsError('not-found', 'Platform staff member not found.');
    await ref.update({ role, updated_at: admin.firestore.FieldValue.serverTimestamp() });
    await writePlatformAuditLog({ actorId: context.auth.uid, target: userId, action: 'platform_staff_role_updated', metadata: { role } });
    return { success: true };
});

exports.suspendPlatformStaff = functions.https.onCall(async (data, context) => {
    await requirePlatformAdmin(context);
    const userId = String(data?.userId || '');
    if (!userId || userId === context.auth.uid) {
        throw new functions.https.HttpsError('invalid-argument', 'You cannot suspend your own account.');
    }
    const ref = admin.firestore().doc(`platform_staff/${userId}`);
    if (!(await ref.get()).exists) throw new functions.https.HttpsError('not-found', 'Platform staff member not found.');
    await admin.auth().updateUser(userId, { disabled: true });
    await ref.update({ status: 'suspended', is_active: false, updated_at: admin.firestore.FieldValue.serverTimestamp() });
    await writePlatformAuditLog({ actorId: context.auth.uid, target: userId, action: 'platform_staff_suspended' });
    return { success: true };
});

// Creates the tenant and its first ERP owner as one trusted provisioning flow.
// The owner account is distinct from platform_staff and receives only this
// company's company_id, so it cannot cross the tenant boundary in Firestore.
// رقم واتساب إدارة الشركة بصيغة دولية أرقام فقط (نفس قواعد الواجهة: 01012345678 → 201012345678)
function normalizeWaNumber(phone) {
    if (!phone) return '';
    let digits = String(phone)
        .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
        .replace(/\D/g, '');
    if (digits.startsWith('00')) digits = digits.slice(2);
    if (digits.startsWith('0')) digits = `20${digits.slice(1)}`;
    if (digits.length === 10 && digits.startsWith('1')) digits = `20${digits}`;
    return digits;
}

exports.provisionCompany = functions.https.onCall(async (data, context) => {
    await requirePlatformAdmin(context);
    const companyName = String(data?.companyName || '').trim();
    const companyEmail = normalizeEmail(data?.companyEmail);
    const ownerName = String(data?.ownerName || '').trim();
    const ownerEmail = normalizeEmail(data?.ownerEmail);
    const plan = ['basic', 'pro', 'enterprise'].includes(String(data?.plan || '').toLowerCase())
        ? String(data.plan).toLowerCase()
        : 'basic';

    const adminWhatsapp = normalizeWaNumber(data?.adminWhatsapp);
    if (adminWhatsapp && !/^\d{10,15}$/.test(adminWhatsapp)) {
        throw new functions.https.HttpsError('invalid-argument', 'Admin WhatsApp number is invalid.');
    }

    if (!companyName || !isValidEmail(companyEmail) || !ownerName || !isValidEmail(ownerEmail)) {
        throw new functions.https.HttpsError('invalid-argument', 'Company name, company email, owner name, and owner email are required.');
    }

    try {
        await admin.auth().getUserByEmail(ownerEmail);
        throw new functions.https.HttpsError('already-exists', 'The company owner email already has an account.');
    } catch (error) {
        if (error?.code !== 'auth/user-not-found') throw error;
    }

    const db = admin.firestore();
    // A counter gives customers a readable sequential ID without relying on a
    // browser-side collection count (which is both racy and permissioned).
    // It is used only to initialize the sequence when older companies exist.
    const existingCompanyCount = (await db.collection('companies').count().get()).data().count;
    const companyCounterRef = db.doc('system_counters/company_sequence');
    let companyId = '';
    let owner;
    let committed = false;
    try {
        owner = await admin.auth().createUser({
            email: ownerEmail,
            displayName: ownerName,
            password: crypto.randomBytes(32).toString('base64url'),
            emailVerified: false,
        });
        const passwordResetLink = await admin.auth().generatePasswordResetLink(ownerEmail);
        await db.runTransaction(async (transaction) => {
            const counterSnapshot = await transaction.get(companyCounterRef);
            const lastNumber = counterSnapshot.exists
                ? Number(counterSnapshot.data().last_company_number || 0)
                : Number(existingCompanyCount || 0);
            const nextNumber = lastNumber + 1;
            companyId = `CMP-${String(nextNumber).padStart(6, '0')}`;
            const companyRef = db.doc(`companies/${companyId}`);
            transaction.create(companyRef, {
                name: companyName,
                email: companyEmail,
                admin_whatsapp: adminWhatsapp,
                owner_uid: owner.uid,
                company_code: companyId,
                status: 'active',
                subscription: { plan, billing_status: 'pending' },
                created_at: admin.firestore.FieldValue.serverTimestamp(),
                updated_at: admin.firestore.FieldValue.serverTimestamp(),
            });
            transaction.create(db.doc(`users/${owner.uid}`), {
                name: ownerName,
                email: ownerEmail,
                company_id: companyId,
                role: 'owner',
                permission_overrides: { can_manage_users: true },
                status: 'active',
                is_active: true,
                created_at: admin.firestore.FieldValue.serverTimestamp(),
                updated_at: admin.firestore.FieldValue.serverTimestamp(),
            });
            transaction.set(companyCounterRef, {
                last_company_number: nextNumber,
                updated_at: admin.firestore.FieldValue.serverTimestamp(),
            }, { merge: true });
        });
        committed = true;
    } catch (error) {
        if (owner?.uid && !committed) {
            await admin.auth().deleteUser(owner.uid).catch(() => null);
        }
        throw error;
    }
    // Claims are convenient to the client, while Firestore Rules use the
    // profile above as the source of truth. Do not undo a completed tenant if
    // a nonessential claim or audit write temporarily fails.
    await admin.auth().setCustomUserClaims(owner.uid, { role: 'owner', company_id: companyId })
        .catch((error) => functions.logger.warn('Could not set company owner claims', { error: error?.message, uid: owner.uid }));
    await writePlatformAuditLog({
        actorId: context.auth.uid,
        target: companyId,
        action: 'company_provisioned',
        metadata: { owner_uid: owner.uid, plan },
    }).catch((error) => functions.logger.warn('Could not write platform audit log', { error: error?.message }));
    return { companyId, ownerUid: owner.uid, passwordResetLink };
});
