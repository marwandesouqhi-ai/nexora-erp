-- Support tickets (shared by Nexora ERP customers and the CRM support team)
-- Replaces Firestore support_tickets + support_tickets/{id}/messages.
-- Additive migration: creates new tables, policies, trigger and storage bucket only.

create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  legacy_firebase_id text unique,
  company_id uuid not null references public.companies(id) on delete cascade,
  company_name text not null default '',
  ticket_number text not null unique default ('TKT-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6))),
  subject text not null,
  category text not null default 'other' check (category in ('technical','billing','account','feature','other')),
  priority text not null default 'normal' check (priority in ('low','normal','high','urgent')),
  status text not null default 'open' check (status in ('open','in_progress','waiting_customer','resolved','closed')),
  created_by jsonb not null default '{}'::jsonb,            -- { uid, name, email }
  created_by_uid uuid default auth.uid(),
  assigned_to text,                                          -- staff email
  last_message_at timestamptz not null default now(),
  last_message_preview text not null default '',
  last_message_by text check (last_message_by in ('customer','staff')),
  unread_for_staff boolean not null default true,
  unread_for_customer boolean not null default false,
  message_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.support_messages (
  id uuid primary key default gen_random_uuid(),
  legacy_firebase_id text unique,
  ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  body text not null default '',
  author jsonb not null default '{}'::jsonb,                 -- { uid, name, email }
  author_side text not null check (author_side in ('customer','staff')),
  internal boolean not null default false,                   -- staff-only note
  attachments jsonb not null default '[]'::jsonb,            -- [{ name, path, content_type, size }]
  created_at timestamptz not null default now()
);

create index if not exists support_tickets_company_idx on public.support_tickets (company_id, last_message_at desc);
create index if not exists support_tickets_status_idx on public.support_tickets (status, last_message_at desc);
create index if not exists support_messages_ticket_idx on public.support_messages (ticket_id, created_at);

-- Same helper as the phase-0 migration; kept here so this file also runs on its own.
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

drop trigger if exists set_updated_at on public.support_tickets;
create trigger set_updated_at before update on public.support_tickets
  for each row execute function public.set_updated_at();

-- Who may open/follow tickets inside a company (same roles as the Firestore rules).
create or replace function private.is_support_admin()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select private.current_company_id() is not null
     and private.current_erp_role()::text in ('owner','admin','general_manager');
$$;

-- Keeps the ticket summary in sync when a message is added, so clients only insert messages.
create or replace function private.on_support_message_insert()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  t public.support_tickets;
  names text;
  preview text;
begin
  select * into t from public.support_tickets where id = new.ticket_id for update;
  if not found then return new; end if;

  if new.internal then
    update public.support_tickets set updated_at = now() where id = t.id;
    return new;
  end if;

  select string_agg(a->>'name', ', ') into names from jsonb_array_elements(new.attachments) a;
  preview := case
    when btrim(new.body) <> '' then left(regexp_replace(btrim(new.body), '\s+', ' ', 'g'), 140)
    when names is not null then left('attachment: ' || names, 140)
    else ''
  end;

  update public.support_tickets set
    message_count = message_count + 1,
    last_message_at = now(),
    last_message_preview = preview,
    last_message_by = new.author_side,
    unread_for_staff = (new.author_side = 'customer'),
    unread_for_customer = (new.author_side = 'staff'),
    status = case
      when new.author_side = 'customer' and status in ('waiting_customer','resolved') then 'open'
      when new.author_side = 'staff' and status not in ('closed','resolved') then 'waiting_customer'
      else status
    end,
    assigned_to = case
      when new.author_side = 'staff' and assigned_to is null then nullif(new.author->>'email', '')
      else assigned_to
    end,
    updated_at = now()
  where id = t.id;
  return new;
end;
$$;

drop trigger if exists support_message_after_insert on public.support_messages;
create trigger support_message_after_insert after insert on public.support_messages
  for each row execute function private.on_support_message_insert();

-- Customers may not change staff-controlled fields or move a ticket between companies.
create or replace function private.guard_support_ticket_update()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if private.is_active_platform_staff() then return new; end if;
  -- Updates issued by private.on_support_message_insert() run at trigger depth 2.
  if pg_trigger_depth() > 1 then return new; end if;
  if new.company_id <> old.company_id
     or new.ticket_number <> old.ticket_number
     or new.priority <> old.priority
     or new.assigned_to is distinct from old.assigned_to
     or new.subject <> old.subject
     or new.category <> old.category
     or new.message_count <> old.message_count
     or new.created_by is distinct from old.created_by then
    raise exception 'Only support staff can change these ticket fields';
  end if;
  if new.status is distinct from old.status and new.status not in ('open','closed') then
    raise exception 'Customers can only open or close a ticket';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_support_ticket_update on public.support_tickets;
create trigger guard_support_ticket_update before update on public.support_tickets
  for each row execute function private.guard_support_ticket_update();

alter table public.support_tickets enable row level security;
alter table public.support_messages enable row level security;

-- Tickets
drop policy if exists tickets_customer_read on public.support_tickets;
create policy tickets_customer_read on public.support_tickets for select to authenticated
  using (company_id = private.current_company_id() and private.is_support_admin());

drop policy if exists tickets_customer_insert on public.support_tickets;
create policy tickets_customer_insert on public.support_tickets for insert to authenticated
  with check (company_id = private.current_company_id() and private.is_support_admin()
              and status = 'open' and assigned_to is null and message_count = 0);

drop policy if exists tickets_customer_update on public.support_tickets;
create policy tickets_customer_update on public.support_tickets for update to authenticated
  using (company_id = private.current_company_id() and private.is_support_admin())
  with check (company_id = private.current_company_id() and private.is_support_admin());

drop policy if exists tickets_staff_all on public.support_tickets;
create policy tickets_staff_all on public.support_tickets for all to authenticated
  using (private.is_active_platform_staff()) with check (private.is_active_platform_staff());

-- Messages
drop policy if exists messages_customer_read on public.support_messages;
create policy messages_customer_read on public.support_messages for select to authenticated
  using (company_id = private.current_company_id() and private.is_support_admin() and internal = false);

drop policy if exists messages_customer_insert on public.support_messages;
create policy messages_customer_insert on public.support_messages for insert to authenticated
  with check (company_id = private.current_company_id() and private.is_support_admin()
              and author_side = 'customer' and internal = false
              and exists (select 1 from public.support_tickets t
                          where t.id = ticket_id and t.company_id = support_messages.company_id));

drop policy if exists messages_staff_all on public.support_messages;
create policy messages_staff_all on public.support_messages for all to authenticated
  using (private.is_active_platform_staff()) with check (private.is_active_platform_staff());

-- Realtime
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'support_tickets') then
    alter publication supabase_realtime add table public.support_tickets;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'support_messages') then
    alter publication supabase_realtime add table public.support_messages;
  end if;
end $$;

-- Attachments bucket (private; files are served through signed URLs).
-- Paths:  {company_id}/{ticket_id}/{file}  customer + public staff replies
--         internal/{ticket_id}/{file}       staff-only internal notes
insert into storage.buckets (id, name, public, file_size_limit)
values ('support-attachments', 'support-attachments', false, 10485760)
on conflict (id) do nothing;

drop policy if exists support_files_customer_read on storage.objects;
create policy support_files_customer_read on storage.objects for select to authenticated
  using (bucket_id = 'support-attachments'
         and (storage.foldername(name))[1] = private.current_company_id()::text
         and private.is_support_admin());

drop policy if exists support_files_customer_insert on storage.objects;
create policy support_files_customer_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'support-attachments'
              and (storage.foldername(name))[1] = private.current_company_id()::text
              and private.is_support_admin());

drop policy if exists support_files_staff_all on storage.objects;
create policy support_files_staff_all on storage.objects for all to authenticated
  using (bucket_id = 'support-attachments' and private.is_active_platform_staff())
  with check (bucket_id = 'support-attachments' and private.is_active_platform_staff());
