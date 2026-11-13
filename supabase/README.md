# Supabase

The new backend for Nexora ERP. The full plan is in [`../SUPABASE_MIGRATION_PLAN.md`](../SUPABASE_MIGRATION_PLAN.md).

```
supabase/
  config.toml        local stack config (ports, auth settings)
  migrations/        schema, RLS and RPC functions, applied in filename order
  functions/         Edge Functions (replace functions/index.js); secrets in functions/.env
  tests/database/    pgTAP tests (tenant isolation, roles, RPCs)
  seed.sql           local demo data
```

## Local stack

Requires Docker Desktop. The CLI is a dev dependency, so use the npm scripts:

| Command | What it does |
|---|---|
| `npm run sb:start` | Start Postgres, Auth, Storage, Realtime and Studio (http://localhost:54323) |
| `npm run sb:status` | Print local URLs and keys (the anon key goes in `VITE_SUPABASE_ANON_KEY`) |
| `npm run sb:reset` | Rebuild the local DB from `migrations/` + `seed.sql` |
| `npm run sb:test` | Run pgTAP tests in `tests/database/` |
| `npm run sb:new -- <name>` | Create a new migration file |
| `npm run sb:stop` | Stop the stack |

## Switching the app

In `.env`: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and `VITE_BACKEND=supabase`.
The default is `firebase`; nothing changes until the flag is set. The client is in
`src/api/supabase.js` and the flag in `src/api/backend.js`.

## Rules

- The `service_role` key never goes in a `VITE_` variable or in the frontend.
- Every tenant table has RLS enabled, and every policy has a pgTAP test.
- Never edit a migration that has run on the cloud project; add a new one instead.
