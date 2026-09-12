create table if not exists public.organization_profiles (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  official_name text not null check (char_length(btrim(official_name)) between 2 and 200),
  short_name text check (short_name is null or char_length(btrim(short_name)) <= 80),
  about text check (about is null or char_length(about) <= 12000),
  address text check (address is null or char_length(address) <= 2000),
  primary_email text check (primary_email is null or char_length(primary_email) <= 320),
  primary_phone text check (primary_phone is null or char_length(primary_phone) <= 80),
  website text check (website is null or char_length(website) <= 2000),
  social_links jsonb not null default '{}'::jsonb check (jsonb_typeof(social_links) = 'object'),
  default_language text not null default 'en' check (char_length(btrim(default_language)) between 2 and 20),
  timezone text not null default 'Europe/Warsaw' check (char_length(btrim(timezone)) between 3 and 100),
  legal_identifiers jsonb not null default '{}'::jsonb check (jsonb_typeof(legal_identifiers) = 'object'),
  revision integer not null default 1 check (revision >= 1),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.organization_brand_kits (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  primary_color text check (primary_color is null or primary_color ~ '^#[0-9A-Fa-f]{6}$'),
  secondary_color text check (secondary_color is null or secondary_color ~ '^#[0-9A-Fa-f]{6}$'),
  accent_color text check (accent_color is null or accent_color ~ '^#[0-9A-Fa-f]{6}$'),
  typography_rules text check (typography_rules is null or char_length(typography_rules) <= 4000),
  brand_voice text check (brand_voice is null or char_length(brand_voice) <= 4000),
  logo_usage_rules text check (logo_usage_rules is null or char_length(logo_usage_rules) <= 4000),
  visual_constraints text check (visual_constraints is null or char_length(visual_constraints) <= 6000),
  revision integer not null default 1 check (revision >= 1),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.brand_kit_media_assets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organization_brand_kits(organization_id) on delete cascade,
  role text not null check (role in (
    'PRIMARY_LOGO','LIGHT_LOGO','DARK_LOGO','BRAND_MARK','FAVICON','APPROVED_IMAGERY'
  )),
  media_asset_id uuid not null references public.media_assets(id) on delete restrict,
  sort_order integer not null default 0 check (sort_order >= 0),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (organization_id, role, media_asset_id)
);

create unique index if not exists brand_kit_singleton_asset_role_idx
  on public.brand_kit_media_assets (organization_id, role)
  where role <> 'APPROVED_IMAGERY';

create index if not exists brand_kit_media_asset_idx
  on public.brand_kit_media_assets (media_asset_id);

alter table public.knowledge_records
  add column if not exists is_core boolean not null default false;

create index if not exists knowledge_records_org_core_status_idx
  on public.knowledge_records (organization_id, is_core, status, updated_at desc);

create or replace function public.enforce_organization_profile_revision()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.organization_id is distinct from old.organization_id then
    raise exception 'organization profile organization is immutable';
  end if;
  if new.revision <> old.revision + 1 then
    raise exception 'organization profile revision must increment exactly once';
  end if;
  if new.created_by is distinct from old.created_by
     or new.created_at is distinct from old.created_at then
    raise exception 'organization profile creation audit fields are immutable';
  end if;
  if auth.uid() is not null then
    new.updated_by := auth.uid();
    new.updated_at := now();
  end if;
  return new;
end;
$$;

revoke all on function public.enforce_organization_profile_revision() from public;
revoke all on function public.enforce_organization_profile_revision() from anon;
revoke all on function public.enforce_organization_profile_revision() from authenticated;

drop trigger if exists organization_profile_revision_guard on public.organization_profiles;
create trigger organization_profile_revision_guard
before update on public.organization_profiles
for each row execute function public.enforce_organization_profile_revision();

create or replace function public.enforce_organization_brand_kit_revision()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.organization_id is distinct from old.organization_id then
    raise exception 'organization brand kit organization is immutable';
  end if;
  if new.revision <> old.revision + 1 then
    raise exception 'organization brand kit revision must increment exactly once';
  end if;
  if new.created_by is distinct from old.created_by
     or new.created_at is distinct from old.created_at then
    raise exception 'organization brand kit creation audit fields are immutable';
  end if;
  if auth.uid() is not null then
    new.updated_by := auth.uid();
    new.updated_at := now();
  end if;
  return new;
end;
$$;

revoke all on function public.enforce_organization_brand_kit_revision() from public;
revoke all on function public.enforce_organization_brand_kit_revision() from anon;
revoke all on function public.enforce_organization_brand_kit_revision() from authenticated;

drop trigger if exists organization_brand_kit_revision_guard on public.organization_brand_kits;
create trigger organization_brand_kit_revision_guard
before update on public.organization_brand_kits
for each row execute function public.enforce_organization_brand_kit_revision();

create or replace function public.enforce_brand_asset_integrity()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  m public.media_assets%rowtype;
begin
  select * into m from public.media_assets where id = new.media_asset_id;
  if m.id is null then
    raise exception 'brand media asset does not exist';
  end if;
  if m.organization_id <> new.organization_id then
    raise exception 'brand media asset organization mismatch';
  end if;
  if m.status <> 'ACTIVE' then
    raise exception 'brand media asset must be active';
  end if;
  if m.asset_type <> 'IMAGE' then
    raise exception 'brand media asset must be an image';
  end if;
  if m.mime_type not like 'image/%' then
    raise exception 'brand media asset MIME type must be an image';
  end if;
  return new;
end;
$$;

revoke all on function public.enforce_brand_asset_integrity() from public;
revoke all on function public.enforce_brand_asset_integrity() from anon;
revoke all on function public.enforce_brand_asset_integrity() from authenticated;

drop trigger if exists brand_asset_integrity_guard on public.brand_kit_media_assets;
create trigger brand_asset_integrity_guard
before insert or update of organization_id, media_asset_id
on public.brand_kit_media_assets
for each row execute function public.enforce_brand_asset_integrity();

create or replace function public.protect_active_brand_assets()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.status = 'ACTIVE'
     and new.status <> 'ACTIVE'
     and exists (
       select 1 from public.brand_kit_media_assets b
       where b.media_asset_id = old.id
         and b.organization_id = old.organization_id
     ) then
    raise exception 'media asset is assigned to the organization Brand Kit';
  end if;
  return new;
end;
$$;

revoke all on function public.protect_active_brand_assets() from public;
revoke all on function public.protect_active_brand_assets() from anon;
revoke all on function public.protect_active_brand_assets() from authenticated;

drop trigger if exists media_brand_asset_status_guard on public.media_assets;
create trigger media_brand_asset_status_guard
before update of status on public.media_assets
for each row execute function public.protect_active_brand_assets();

create or replace function public.enforce_knowledge_core_admin()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if auth.uid() is not null
     and new.is_core is distinct from old.is_core
     and not public.has_org_role(old.organization_id, array['OWNER','ADMIN']) then
    raise exception 'only organization owners or admins may change Core Knowledge';
  end if;
  return new;
end;
$$;

revoke all on function public.enforce_knowledge_core_admin() from public;
revoke all on function public.enforce_knowledge_core_admin() from anon;
revoke all on function public.enforce_knowledge_core_admin() from authenticated;

drop trigger if exists knowledge_core_admin_guard on public.knowledge_records;
create trigger knowledge_core_admin_guard
before update of is_core on public.knowledge_records
for each row execute function public.enforce_knowledge_core_admin();

alter table public.organization_profiles enable row level security;
alter table public.organization_brand_kits enable row level security;
alter table public.brand_kit_media_assets enable row level security;

revoke all privileges on table public.organization_profiles from anon;
revoke all privileges on table public.organization_brand_kits from anon;
revoke all privileges on table public.brand_kit_media_assets from anon;

grant select, insert, update on table public.organization_profiles to authenticated;
grant select, insert, update on table public.organization_brand_kits to authenticated;
grant select, insert, update, delete on table public.brand_kit_media_assets to authenticated;

drop policy if exists organization_profiles_select_member on public.organization_profiles;
create policy organization_profiles_select_member
on public.organization_profiles for select to authenticated
using (public.is_org_member(organization_id));

drop policy if exists organization_profiles_insert_admin on public.organization_profiles;
create policy organization_profiles_insert_admin
on public.organization_profiles for insert to authenticated
with check (
  public.has_org_role(organization_id, array['OWNER','ADMIN'])
  and revision = 1
  and created_by = auth.uid()
  and updated_by = auth.uid()
);

drop policy if exists organization_profiles_update_admin on public.organization_profiles;
create policy organization_profiles_update_admin
on public.organization_profiles for update to authenticated
using (public.has_org_role(organization_id, array['OWNER','ADMIN']))
with check (public.has_org_role(organization_id, array['OWNER','ADMIN']));

drop policy if exists organization_brand_kits_select_member on public.organization_brand_kits;
create policy organization_brand_kits_select_member
on public.organization_brand_kits for select to authenticated
using (public.is_org_member(organization_id));

drop policy if exists organization_brand_kits_insert_admin on public.organization_brand_kits;
create policy organization_brand_kits_insert_admin
on public.organization_brand_kits for insert to authenticated
with check (
  public.has_org_role(organization_id, array['OWNER','ADMIN'])
  and revision = 1
  and created_by = auth.uid()
  and updated_by = auth.uid()
);

drop policy if exists organization_brand_kits_update_admin on public.organization_brand_kits;
create policy organization_brand_kits_update_admin
on public.organization_brand_kits for update to authenticated
using (public.has_org_role(organization_id, array['OWNER','ADMIN']))
with check (public.has_org_role(organization_id, array['OWNER','ADMIN']));

drop policy if exists brand_kit_media_assets_select_member on public.brand_kit_media_assets;
create policy brand_kit_media_assets_select_member
on public.brand_kit_media_assets for select to authenticated
using (public.is_org_member(organization_id));

drop policy if exists brand_kit_media_assets_insert_admin on public.brand_kit_media_assets;
create policy brand_kit_media_assets_insert_admin
on public.brand_kit_media_assets for insert to authenticated
with check (
  public.has_org_role(organization_id, array['OWNER','ADMIN'])
  and created_by = auth.uid()
);

drop policy if exists brand_kit_media_assets_update_admin on public.brand_kit_media_assets;
create policy brand_kit_media_assets_update_admin
on public.brand_kit_media_assets for update to authenticated
using (public.has_org_role(organization_id, array['OWNER','ADMIN']))
with check (public.has_org_role(organization_id, array['OWNER','ADMIN']));

drop policy if exists brand_kit_media_assets_delete_admin on public.brand_kit_media_assets;
create policy brand_kit_media_assets_delete_admin
on public.brand_kit_media_assets for delete to authenticated
using (public.has_org_role(organization_id, array['OWNER','ADMIN']));
