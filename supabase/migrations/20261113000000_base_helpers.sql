-- Phase 0: shared helpers used by every table migration in Phase 1.

create extension if not exists pgcrypto with schema extensions;

-- Keeps updated_at current on every UPDATE (replaces Firestore serverTimestamp()
-- on writes). Attach per table with:
--   create trigger set_updated_at before update on public.<table>
--     for each row execute function public.set_updated_at();
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- New record ids stay text, so ids carried over from Firestore keep working
-- (see SUPABASE_MIGRATION_PLAN.md, section 1).
create or replace function public.new_id()
returns text
language sql
volatile
set search_path = ''
as $$
  select extensions.gen_random_uuid()::text;
$$;
