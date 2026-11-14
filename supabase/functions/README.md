# Edge Functions

The project `nexora-erp` (ref `lejtflygvbakfbiwwhea`) already has these functions **deployed**.
Their source is not in this repo yet. Download it before changing anything:

```bash
npx supabase functions download company-invitations
npx supabase functions download platform-admin
npx supabase functions download erp-integrations
npx supabase functions download owner-bootstrap
```

| Function | Actions | Used by |
|---|---|---|
| `company-invitations` | `create`, `resend`, `revoke`, `list`, `verify`, `accept`, `update_user` | ERP: `src/api/functions.js` |
| `erp-integrations` | `assistant` (Gemini), `whatsapp_send`, `whatsapp_status` | ERP: `src/api/functions.js`, `geminiService.js` |
| `platform-admin` | `provision_company`, `provision_company_owner`, `resend_owner_invitation`, `provision_staff`, `update_staff`, `suspend_staff`, `log_action` | CRM: `crm-admin/src/lib/functions.ts` |
| `owner-bootstrap` | first-owner bootstrap | (not called by the apps) |

Notes
- `platform-admin` and `company-invitations` import `../_shared/companyModules.ts`, so download them together.
- Do **not** deploy a function with one of these names unless you mean to replace the live one.
- Server secrets (`GEMINI_API_KEY`, `GEMINI_MODEL`, `ULTRAMSG_INSTANCE_ID`, `ULTRAMSG_TOKEN`, `ERP_APP_URL`, `CRM_APP_URL`) live in the dashboard under Edge Functions > Secrets.
- The apps call them through `callFunction()`; on Firebase it still runs the old callables.
