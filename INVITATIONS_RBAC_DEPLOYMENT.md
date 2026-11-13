# Invitations, RBAC, and tenant isolation

NEXORA currently uses Firebase Authentication, Cloud Firestore, and Cloud
Functions—not Supabase. This implementation extends those existing services;
it does not introduce a second identity, role, or membership store.

## Data model and security boundary

- `users/{uid}` remains the canonical organization membership/profile document.
  Role, organization, status, and `permission_overrides` are provisioned only
  by Admin-SDK Cloud Functions.
- `invitations/{id}` contains a SHA-256 token hash, recipient metadata, expiry,
  delivery state, and lifecycle state (`pending`, `accepted`, `expired`,
  `revoked`, or `failed`). Tokens are 32 random bytes, never stored plaintext,
  deleted on acceptance/revocation, and cannot be read through Firestore.
- `audit_logs/{id}` is server-written and immutable to Firestore clients.
- Existing `company_id` scoping remains the tenant boundary. Rules constrain all
  existing business collections with `belongsToCompany`/`willBelongToCompany`;
  the updated user rules also prevent employee directory enumeration.

Role titles used by the UI include the established roles plus mapped business
titles such as General Manager, Sales Manager, Inventory Manager, Purchasing
Manager, Warehouse Employee, Viewer, and Custom. Per-user permission overrides
are allow/deny values over the role defaults. The Cloud Function allow-list
rejects unknown permission keys. The database rules remain the authoritative
boundary for records; the React permission gate is only a UX layer.

## Firebase Cloud Function SMTP configuration (Gmail)

The project uses a self-managed Cloud Function with Nodemailer—not Firebase
Extensions—so it remains independent of the Firebase Extensions retirement.

1. Enable two-step verification for the Gmail account, then create a dedicated
   16-character Google App Password named `Nexora Firebase`. Never use the
   normal Google password and never place the App Password in frontend files.
2. Copy `functions/.env.example` to `functions/.env` and fill the non-secret
   values, including the real public `APP_BASE_URL`.
3. Store the App Password in Firebase Secret Manager. This command prompts for
   the value, so it is not saved in source control or shell history:

   ```powershell
   npx firebase-tools functions:secrets:set SMTP_PASSWORD --project nexora-erp-86d44
   ```

   The credential is bound only to `createInvitation` and `resendInvitation`.
   Do not prefix it with `VITE_`, commit it, or paste it into the application.
4. Deploy Functions after setting configuration:

   ```powershell
   npx firebase-tools deploy --only functions --project nexora-erp-86d44
   ```

The Function writes the Gmail message ID back to the invitation after SMTP
acceptance. Check Cloud Functions logs for any delivery errors. Gmail is
suitable for development or low-volume internal invitations; move to a
verified-domain provider such as Resend before high-volume production mail.

## Deploy

```powershell
npm run build
npx firebase-tools deploy --only firestore:rules,functions,hosting
```

Deploy rules and functions together. Existing users created before this change
continue to read their own profile; role changes and new invitations must use
the deployed server functions.

## Verification performed locally

- `npm run build` passed.
- `node --check functions/index.js` passed.
- Targeted ESLint passed for the changed React and service files.

Firestore rules and callable functions require a configured Firebase project or
the Emulator Suite for end-to-end execution. Before production, run these
high-priority emulator tests: cross-company read/write denial; direct user role
and company update denial; invite expiry, revoke, and replay denial; acceptance
creates exactly one Auth user/profile; suspended-user denial after token refresh;
and a last-admin demotion/suspension denial.
