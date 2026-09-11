create table if not exists public.video_assemblies (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  plan_version_id uuid not null references public.scene_plan_versions(id) on delete restrict,
  job_id uuid not null references public.jobs(id) on delete restrict,
  state text not null default 'QUEUED'
    check (state in ('QUEUED','PROCESSING','COMPLETED','FAILED','CANCELLED')),
  render_profile text not null
    check (render_profile in ('PAK_MASTER_1080P_V1')),
  readiness_hash text not null check (length(readiness_hash) >= 16),
  source_integrity_hash text not null check (length(source_integrity_hash) >= 16),
  aspect_ratio text not null check (aspect_ratio in ('16:9','9:16')),
  component_count integer not null check (component_count > 0),
  expected_duration_seconds numeric(10,2) not null check (expected_duration_seconds > 0),
  final_media_asset_id uuid references public.media_assets(id) on delete restrict,
  failure_code text,
  failure_message text,
  retryable boolean,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  unique (job_id),
  unique (organization_id, plan_version_id, readiness_hash, render_profile)
);

create index if not exists video_assemblies_org_plan_created_idx
  on public.video_assemblies(organization_id, plan_version_id, created_at desc);

create index if not exists video_assemblies_org_state_created_idx
  on public.video_assemblies(organization_id, state, created_at desc);

create index if not exists video_assemblies_final_media_idx
  on public.video_assemblies(final_media_asset_id)
  where final_media_asset_id is not null;

create table if not exists public.video_assembly_components (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  assembly_id uuid not null references public.video_assemblies(id) on delete cascade,
  ordinal integer not null check (ordinal >= 1),
  scene_id uuid not null references public.scene_plan_scenes(id) on delete restrict,
  shot_id uuid not null references public.scene_plan_shots(id) on delete restrict,
  media_asset_id uuid not null references public.media_assets(id) on delete restrict,
  media_checksum text not null check (media_checksum ~ '^sha256:[0-9a-f]{64}$'),
  duration_seconds numeric(10,2) not null check (duration_seconds > 0),
  storage_bucket text not null,
  storage_path text not null,
  created_at timestamptz not null default now(),
  unique (assembly_id, ordinal),
  unique (assembly_id, shot_id)
);

create index if not exists video_assembly_components_org_assembly_idx
  on public.video_assembly_components(organization_id, assembly_id, ordinal);

create index if not exists video_assembly_components_media_idx
  on public.video_assembly_components(media_asset_id);

create or replace function public.enforce_video_assembly_parentage()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_plan_org uuid;
  v_job_org uuid;
  v_job_type text;
  v_media_org uuid;
  v_assembly public.video_assemblies%rowtype;
  v_scene_plan uuid;
  v_scene_org uuid;
  v_shot_scene uuid;
  v_shot_org uuid;
  v_component_media_org uuid;
  v_component_media_type text;
  v_component_media_status text;
begin
  if tg_table_name = 'video_assemblies' then
    if tg_op = 'UPDATE' and (
      new.organization_id is distinct from old.organization_id
      or new.plan_version_id is distinct from old.plan_version_id
      or new.job_id is distinct from old.job_id
      or new.render_profile is distinct from old.render_profile
      or new.readiness_hash is distinct from old.readiness_hash
      or new.source_integrity_hash is distinct from old.source_integrity_hash
      or new.aspect_ratio is distinct from old.aspect_ratio
      or new.component_count is distinct from old.component_count
      or new.expected_duration_seconds is distinct from old.expected_duration_seconds
      or new.created_by is distinct from old.created_by
      or new.created_at is distinct from old.created_at
    ) then
      raise exception 'video assembly lineage is immutable';
    end if;

    select organization_id into v_plan_org
    from public.scene_plan_versions
    where id = new.plan_version_id;

    if v_plan_org is null or v_plan_org <> new.organization_id then
      raise exception 'video assembly organization mismatch';
    end if;

    select organization_id, job_type into v_job_org, v_job_type
    from public.jobs
    where id = new.job_id;

    if v_job_org is null or v_job_org <> new.organization_id or v_job_type <> 'FINAL_VIDEO_ASSEMBLY' then
      raise exception 'video assembly job lineage mismatch';
    end if;

    if new.final_media_asset_id is not null then
      select organization_id into v_media_org
      from public.media_assets
      where id = new.final_media_asset_id;

      if v_media_org is null or v_media_org <> new.organization_id then
        raise exception 'video assembly final media organization mismatch';
      end if;
    end if;

    if new.state = 'COMPLETED' and new.final_media_asset_id is null then
      raise exception 'completed video assembly requires final media asset';
    end if;

    return new;
  end if;

  if tg_table_name = 'video_assembly_components' then
    if tg_op = 'UPDATE' then
      raise exception 'video assembly component snapshot is immutable';
    end if;

    select * into v_assembly
    from public.video_assemblies
    where id = new.assembly_id;

    if v_assembly.id is null or v_assembly.organization_id <> new.organization_id then
      raise exception 'video assembly component lineage mismatch';
    end if;

    select organization_id, scene_plan_version_id into v_scene_org, v_scene_plan
    from public.scene_plan_scenes
    where id = new.scene_id;

    if v_scene_org is null
       or v_scene_org <> new.organization_id
       or v_scene_plan <> v_assembly.plan_version_id then
      raise exception 'video assembly component lineage mismatch';
    end if;

    select organization_id, scene_id into v_shot_org, v_shot_scene
    from public.scene_plan_shots
    where id = new.shot_id;

    if v_shot_org is null
       or v_shot_org <> new.organization_id
       or v_shot_scene <> new.scene_id then
      raise exception 'video assembly component lineage mismatch';
    end if;

    select organization_id, asset_type, status
      into v_component_media_org, v_component_media_type, v_component_media_status
    from public.media_assets
    where id = new.media_asset_id;

    if v_component_media_org is null
       or v_component_media_org <> new.organization_id
       or v_component_media_type <> 'VIDEO'
       or v_component_media_status <> 'ACTIVE' then
      raise exception 'video assembly component lineage mismatch';
    end if;

    return new;
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_video_assembly_parentage() from public;
revoke all on function public.enforce_video_assembly_parentage() from anon;
revoke all on function public.enforce_video_assembly_parentage() from authenticated;

create trigger video_assemblies_parentage_guard
before insert or update
on public.video_assemblies
for each row execute function public.enforce_video_assembly_parentage();

create trigger video_assembly_components_parentage_guard
before insert or update
on public.video_assembly_components
for each row execute function public.enforce_video_assembly_parentage();

alter table public.video_assemblies enable row level security;
alter table public.video_assembly_components enable row level security;

create policy video_assemblies_select_member
on public.video_assemblies
for select
to authenticated
using (public.is_org_member(organization_id));

create policy video_assembly_components_select_member
on public.video_assembly_components
for select
to authenticated
using (public.is_org_member(organization_id));
