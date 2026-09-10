create table if not exists public.media_assets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  asset_type text not null check (asset_type in ('IMAGE','VIDEO','AUDIO','DOCUMENT')),
  storage_path text not null,
  source text not null check (source in ('UPLOAD','GENERATED','IMPORT')),
  mime_type text not null,
  width integer check (width is null or width > 0),
  height integer check (height is null or height > 0),
  duration_seconds numeric(10,2) check (duration_seconds is null or duration_seconds > 0),
  checksum text,
  generating_job_id uuid references public.jobs(id) on delete set null,
  scene_id uuid,
  status text not null default 'ACTIVE' check (status in ('ACTIVE','ARCHIVED','FAILED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, storage_path)
);

create index if not exists media_assets_org_created_idx
  on public.media_assets(organization_id, created_at desc);
create index if not exists media_assets_scene_idx on public.media_assets(scene_id);
create index if not exists media_assets_job_idx on public.media_assets(generating_job_id);

alter table public.media_assets enable row level security;

create policy media_assets_select_member
on public.media_assets
for select
to authenticated
using (public.is_org_member(organization_id));

create policy media_assets_insert_editor
on public.media_assets
for insert
to authenticated
with check (public.has_org_role(organization_id, array['OWNER','ADMIN','EDITOR']));

create policy media_assets_update_editor
on public.media_assets
for update
to authenticated
using (public.has_org_role(organization_id, array['OWNER','ADMIN','EDITOR']))
with check (public.has_org_role(organization_id, array['OWNER','ADMIN','EDITOR']));

create policy media_assets_delete_admin
on public.media_assets
for delete
to authenticated
using (public.has_org_role(organization_id, array['OWNER','ADMIN']));
