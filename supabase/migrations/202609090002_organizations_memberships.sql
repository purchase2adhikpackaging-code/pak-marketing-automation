create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.organization_memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('OWNER','ADMIN','EDITOR','REVIEWER','ANALYST')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

create index if not exists organization_memberships_user_id_idx
  on public.organization_memberships(user_id);

create index if not exists organization_memberships_org_id_idx
  on public.organization_memberships(organization_id);

create or replace function public.is_org_member(target_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_memberships m
    where m.organization_id = target_org_id
      and m.user_id = auth.uid()
  );
$$;

create or replace function public.has_org_role(target_org_id uuid, allowed_roles text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_memberships m
    where m.organization_id = target_org_id
      and m.user_id = auth.uid()
      and m.role = any(allowed_roles)
  );
$$;

revoke all on function public.is_org_member(uuid) from public;
revoke all on function public.is_org_member(uuid) from anon;
revoke all on function public.has_org_role(uuid, text[]) from public;
revoke all on function public.has_org_role(uuid, text[]) from anon;
grant execute on function public.is_org_member(uuid) to authenticated;
grant execute on function public.has_org_role(uuid, text[]) to authenticated;

alter table public.organizations enable row level security;
alter table public.organization_memberships enable row level security;

create policy organizations_select_member
on public.organizations
for select
to authenticated
using (public.is_org_member(id));

create policy organizations_update_admin
on public.organizations
for update
to authenticated
using (public.has_org_role(id, array['OWNER','ADMIN']))
with check (public.has_org_role(id, array['OWNER','ADMIN']));

create policy memberships_select_same_org
on public.organization_memberships
for select
to authenticated
using (
  user_id = auth.uid()
  or public.has_org_role(organization_id, array['OWNER','ADMIN'])
);

create policy memberships_insert_admin
on public.organization_memberships
for insert
to authenticated
with check (public.has_org_role(organization_id, array['OWNER','ADMIN']));

create policy memberships_update_admin
on public.organization_memberships
for update
to authenticated
using (public.has_org_role(organization_id, array['OWNER','ADMIN']))
with check (public.has_org_role(organization_id, array['OWNER','ADMIN']));

create policy memberships_delete_admin
on public.organization_memberships
for delete
to authenticated
using (public.has_org_role(organization_id, array['OWNER','ADMIN']));
