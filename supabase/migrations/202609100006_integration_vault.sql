create table if not exists public.integration_connections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  provider text not null,
  display_name text,
  status text not null default 'NOT_CONFIGURED',
  config jsonb not null default '{}'::jsonb,
  secret_version integer not null default 0,
  masked_hint text,
  last_verified_at timestamptz,
  last_error_code text,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint integration_connections_provider_check
    check (provider in ('OPENAI','META','LTX')),
  constraint integration_connections_status_check
    check (status in ('NOT_CONFIGURED','CONFIGURED','INVALID','DISABLED')),
  constraint integration_connections_secret_version_check
    check (secret_version >= 0),
  constraint integration_connections_org_provider_key
    unique (organization_id, provider)
);

create table if not exists public.integration_secrets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  connection_id uuid not null references public.integration_connections(id) on delete cascade,
  secret_name text not null,
  ciphertext text not null,
  encryption_version integer not null,
  key_version integer,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  rotated_at timestamptz,
  constraint integration_secrets_name_check
    check (secret_name ~ '^[A-Z][A-Z0-9_]{1,63}$'),
  constraint integration_secrets_encryption_version_check
    check (encryption_version >= 1),
  constraint integration_secrets_connection_name_key
    unique (connection_id, secret_name)
);

create table if not exists public.integration_audit_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  connection_id uuid references public.integration_connections(id) on delete set null,
  actor_user_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint integration_audit_events_type_check
    check (event_type in (
      'CREATED','UPDATED','SECRET_REPLACED','SECRET_REMOVED',
      'TEST_SUCCEEDED','TEST_FAILED','DISABLED','ENABLED'
    ))
);

create index if not exists integration_connections_org_updated_idx
  on public.integration_connections (organization_id, updated_at desc);
create index if not exists integration_secrets_org_connection_idx
  on public.integration_secrets (organization_id, connection_id);
create index if not exists integration_audit_events_org_created_idx
  on public.integration_audit_events (organization_id, created_at desc);
create index if not exists integration_audit_events_connection_idx
  on public.integration_audit_events (connection_id, created_at desc);

create or replace function public.enforce_integration_connection_integrity()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if auth.uid() is not null then
    if new.organization_id is distinct from old.organization_id then
      raise exception 'integration connection organization is immutable';
    end if;
    if new.created_by is distinct from old.created_by
       or new.created_at is distinct from old.created_at then
      raise exception 'integration connection creation audit fields are immutable';
    end if;
    new.updated_by := auth.uid();
    new.updated_at := now();
  end if;
  return new;
end;
$$;

revoke all on function public.enforce_integration_connection_integrity() from public;
revoke all on function public.enforce_integration_connection_integrity() from anon;
revoke all on function public.enforce_integration_connection_integrity() from authenticated;

drop trigger if exists integration_connection_integrity_guard on public.integration_connections;
create trigger integration_connection_integrity_guard
before update on public.integration_connections
for each row execute function public.enforce_integration_connection_integrity();

create or replace function public.enforce_integration_secret_org_integrity()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  connection_org uuid;
begin
  select organization_id into connection_org
  from public.integration_connections
  where id = new.connection_id;

  if connection_org is null or connection_org <> new.organization_id then
    raise exception 'integration secret organization must match its connection';
  end if;
  return new;
end;
$$;

revoke all on function public.enforce_integration_secret_org_integrity() from public;
revoke all on function public.enforce_integration_secret_org_integrity() from anon;
revoke all on function public.enforce_integration_secret_org_integrity() from authenticated;

drop trigger if exists integration_secret_org_guard on public.integration_secrets;
create trigger integration_secret_org_guard
before insert or update on public.integration_secrets
for each row execute function public.enforce_integration_secret_org_integrity();

create or replace function public.enforce_integration_audit_org_integrity()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  connection_org uuid;
begin
  if new.connection_id is not null then
    select organization_id into connection_org
    from public.integration_connections
    where id = new.connection_id;

    if connection_org is null or connection_org <> new.organization_id then
      raise exception 'integration audit organization must match its connection';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.enforce_integration_audit_org_integrity() from public;
revoke all on function public.enforce_integration_audit_org_integrity() from anon;
revoke all on function public.enforce_integration_audit_org_integrity() from authenticated;

drop trigger if exists integration_audit_org_guard on public.integration_audit_events;
create trigger integration_audit_org_guard
before insert on public.integration_audit_events
for each row execute function public.enforce_integration_audit_org_integrity();

alter table public.integration_connections enable row level security;
alter table public.integration_secrets enable row level security;
alter table public.integration_audit_events enable row level security;

drop policy if exists integration_connections_select_member on public.integration_connections;
create policy integration_connections_select_member
on public.integration_connections
for select
to authenticated
using (public.is_org_member(organization_id));

drop policy if exists integration_connections_insert_admin on public.integration_connections;
create policy integration_connections_insert_admin
on public.integration_connections
for insert
to authenticated
with check (
  public.has_org_role(organization_id, array['OWNER','ADMIN'])
  and created_by = auth.uid()
  and updated_by = auth.uid()
);

drop policy if exists integration_connections_update_admin on public.integration_connections;
create policy integration_connections_update_admin
on public.integration_connections
for update
to authenticated
using (public.has_org_role(organization_id, array['OWNER','ADMIN']))
with check (
  public.has_org_role(organization_id, array['OWNER','ADMIN'])
  and updated_by = auth.uid()
);

drop policy if exists integration_connections_delete_admin on public.integration_connections;
create policy integration_connections_delete_admin
on public.integration_connections
for delete
to authenticated
using (public.has_org_role(organization_id, array['OWNER','ADMIN']));

-- Raw encrypted secret rows are backend-only. No ordinary authenticated RLS policy
-- is created, and direct table privileges are explicitly removed from browser roles.
revoke all on table public.integration_secrets from anon;
revoke all on table public.integration_secrets from authenticated;

drop policy if exists integration_audit_events_select_admin on public.integration_audit_events;
create policy integration_audit_events_select_admin
on public.integration_audit_events
for select
to authenticated
using (public.has_org_role(organization_id, array['OWNER','ADMIN']));

-- Audit writes are backend-only and immutable to browser roles.
revoke insert, update, delete on table public.integration_audit_events from anon;
revoke insert, update, delete on table public.integration_audit_events from authenticated;
