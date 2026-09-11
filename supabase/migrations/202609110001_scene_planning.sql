create table if not exists public.video_projects (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  source_content_id uuid not null references public.content_items(id) on delete restrict,
  source_artifact_id uuid not null references public.content_script_artifacts(id) on delete restrict,
  source_artifact_revision integer not null check (source_artifact_revision >= 1),
  source_integrity_hash text not null check (length(source_integrity_hash) >= 16),
  language text not null check (language in ('EN','PL','HI')),
  title text not null,
  purpose text not null default '',
  target_platform text[] not null default '{}',
  aspect_ratio text not null default '16:9' check (aspect_ratio in ('16:9','9:16','1:1','4:5')),
  target_duration_seconds numeric(8,2) not null check (target_duration_seconds > 0),
  quality_profile text not null default 'PREMIUM' check (quality_profile in ('STANDARD','PREMIUM','CINEMATIC')),
  audience jsonb not null default '{}'::jsonb,
  production_constraints jsonb not null default '{}'::jsonb,
  status text not null default 'DRAFT' check (status in ('DRAFT','ACTIVE','ARCHIVED')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists video_projects_org_status_idx
  on public.video_projects (organization_id, status, updated_at desc);
create index if not exists video_projects_source_artifact_idx
  on public.video_projects (organization_id, source_artifact_id);

create table if not exists public.visual_bibles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  video_project_id uuid not null references public.video_projects(id) on delete cascade,
  version_number integer not null default 1 check (version_number >= 1),
  is_active boolean not null default true,
  characters jsonb not null default '[]'::jsonb,
  wardrobe jsonb not null default '[]'::jsonb,
  locations jsonb not null default '[]'::jsonb,
  props jsonb not null default '[]'::jsonb,
  palette jsonb not null default '{}'::jsonb,
  lighting_language text not null default '',
  realism_level text not null default '',
  cinematography_language text not null default '',
  logo_treatment text not null default '',
  typography_treatment text not null default '',
  cultural_constraints jsonb not null default '[]'::jsonb,
  forbidden_traits jsonb not null default '[]'::jsonb,
  global_negative_constraints jsonb not null default '[]'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (video_project_id, version_number)
);

create unique index if not exists visual_bibles_one_active_idx
  on public.visual_bibles (video_project_id)
  where is_active;
create index if not exists visual_bibles_org_project_idx
  on public.visual_bibles (organization_id, video_project_id);

create table if not exists public.scene_plan_versions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  video_project_id uuid not null references public.video_projects(id) on delete cascade,
  version_number integer not null check (version_number >= 1),
  source_integrity_hash text not null check (length(source_integrity_hash) >= 16),
  parent_version_id uuid references public.scene_plan_versions(id) on delete set null,
  status text not null default 'DRAFT'
    check (status in ('DRAFT','PLANNING','QC_REQUIRED','REVIEW_REQUIRED','APPROVED','FAILED','STALE','SUPERSEDED')),
  planner_provider text,
  planner_model text,
  creative_brief_snapshot jsonb not null default '{}'::jsonb,
  visual_bible_snapshot jsonb not null default '{}'::jsonb,
  canonical_narration text not null,
  language text not null check (language in ('EN','PL','HI')),
  aspect_ratio text not null,
  total_duration_seconds numeric(8,2) not null default 0 check (total_duration_seconds >= 0),
  narration_coverage_hash text,
  qc_summary jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (video_project_id, version_number),
  constraint scene_plan_approval_shape check (
    (status = 'APPROVED' and approved_by is not null and approved_at is not null)
    or (status <> 'APPROVED')
  )
);

create index if not exists scene_plan_versions_org_project_idx
  on public.scene_plan_versions (organization_id, video_project_id, version_number desc);
create index if not exists scene_plan_versions_org_status_idx
  on public.scene_plan_versions (organization_id, status, updated_at desc);

create table if not exists public.scene_plan_scenes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  scene_plan_version_id uuid not null references public.scene_plan_versions(id) on delete cascade,
  ordinal integer not null check (ordinal >= 1),
  title text not null,
  narrative_role text not null check (narrative_role in ('HOOK','SETUP','EXPLANATION','PROOF','TRANSITION','CTA','OTHER')),
  narration_text text not null default '',
  narration_start_char integer,
  narration_end_char integer,
  narrative_objective text not null default '',
  emotional_objective text not null default '',
  duration_seconds numeric(8,2) not null check (duration_seconds > 0),
  continuity_context jsonb not null default '{}'::jsonb,
  creative_direction text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (scene_plan_version_id, ordinal),
  constraint scene_narration_span_shape check (
    (narration_start_char is null and narration_end_char is null)
    or (
      narration_start_char is not null
      and narration_end_char is not null
      and narration_start_char >= 0
      and narration_end_char >= narration_start_char
    )
  )
);

create index if not exists scene_plan_scenes_org_version_idx
  on public.scene_plan_scenes (organization_id, scene_plan_version_id, ordinal);

create table if not exists public.scene_plan_shots (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  scene_id uuid not null references public.scene_plan_scenes(id) on delete cascade,
  ordinal integer not null check (ordinal >= 1),
  duration_seconds numeric(8,2) not null check (duration_seconds > 0),
  narration_text text not null default '',
  narration_start_char integer,
  narration_end_char integer,
  creative_direction text not null,
  master_visual_prompt text not null,
  negative_constraints jsonb not null default '[]'::jsonb,
  subject_refs jsonb not null default '[]'::jsonb,
  location_refs jsonb not null default '[]'::jsonb,
  composition text not null default '',
  shot_size text not null default '',
  camera_angle text not null default '',
  lens_intent text not null default '',
  camera_motion text not null default '',
  subject_motion text not null default '',
  environment_motion text not null default '',
  depth_of_field_intent text not null default '',
  lighting text not null default '',
  mood text not null default '',
  transition_in text not null default '',
  transition_out text not null default '',
  ambience_intent text not null default '',
  sfx_intent text not null default '',
  music_intent text not null default '',
  aspect_ratio text not null,
  continuity_state jsonb not null default '{}'::jsonb,
  generation_requirements jsonb not null default '{}'::jsonb,
  human_modified boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (scene_id, ordinal),
  constraint shot_narration_span_shape check (
    (narration_start_char is null and narration_end_char is null and btrim(narration_text) = '')
    or (
      narration_start_char is not null
      and narration_end_char is not null
      and narration_start_char >= 0
      and narration_end_char >= narration_start_char
    )
  )
);

create index if not exists scene_plan_shots_org_scene_idx
  on public.scene_plan_shots (organization_id, scene_id, ordinal);

create table if not exists public.scene_plan_qc_findings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  scene_plan_version_id uuid not null references public.scene_plan_versions(id) on delete cascade,
  scene_id uuid references public.scene_plan_scenes(id) on delete cascade,
  shot_id uuid references public.scene_plan_shots(id) on delete cascade,
  severity text not null check (severity in ('BLOCKER','WARNING','INFO')),
  code text not null,
  message text not null,
  acknowledged_by uuid references auth.users(id) on delete set null,
  acknowledged_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists scene_plan_qc_org_version_idx
  on public.scene_plan_qc_findings (organization_id, scene_plan_version_id, severity);

create or replace function public.enforce_scene_planning_parent_org()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  parent_org_id uuid;
begin
  if tg_table_name = 'video_projects' then
    select organization_id into parent_org_id
      from public.content_script_artifacts
      where id = new.source_artifact_id;
  elsif tg_table_name = 'visual_bibles' then
    select organization_id into parent_org_id
      from public.video_projects
      where id = new.video_project_id;
  elsif tg_table_name = 'scene_plan_versions' then
    select organization_id into parent_org_id
      from public.video_projects
      where id = new.video_project_id;
  elsif tg_table_name = 'scene_plan_scenes' then
    select organization_id into parent_org_id
      from public.scene_plan_versions
      where id = new.scene_plan_version_id;
  elsif tg_table_name = 'scene_plan_shots' then
    select organization_id into parent_org_id
      from public.scene_plan_scenes
      where id = new.scene_id;
  elsif tg_table_name = 'scene_plan_qc_findings' then
    select organization_id into parent_org_id
      from public.scene_plan_versions
      where id = new.scene_plan_version_id;
  end if;

  if parent_org_id is null then
    raise exception 'Scene Planning parent record does not exist';
  end if;

  if parent_org_id <> new.organization_id then
    raise exception 'Scene Planning organization must match parent organization';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_scene_planning_parent_org() from public;
revoke all on function public.enforce_scene_planning_parent_org() from anon;
revoke all on function public.enforce_scene_planning_parent_org() from authenticated;

create trigger video_projects_parent_org_guard
before insert or update of organization_id, source_artifact_id on public.video_projects
for each row execute function public.enforce_scene_planning_parent_org();

create trigger visual_bibles_parent_org_guard
before insert or update of organization_id, video_project_id on public.visual_bibles
for each row execute function public.enforce_scene_planning_parent_org();

create trigger scene_plan_versions_parent_org_guard
before insert or update of organization_id, video_project_id on public.scene_plan_versions
for each row execute function public.enforce_scene_planning_parent_org();

create trigger scene_plan_scenes_parent_org_guard
before insert or update of organization_id, scene_plan_version_id on public.scene_plan_scenes
for each row execute function public.enforce_scene_planning_parent_org();

create trigger scene_plan_shots_parent_org_guard
before insert or update of organization_id, scene_id on public.scene_plan_shots
for each row execute function public.enforce_scene_planning_parent_org();

create trigger scene_plan_qc_parent_org_guard
before insert or update of organization_id, scene_plan_version_id on public.scene_plan_qc_findings
for each row execute function public.enforce_scene_planning_parent_org();

create or replace function public.enforce_scene_plan_approved_immutability()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.status = 'APPROVED' then
    raise exception 'approved scene plan versions are immutable';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

revoke all on function public.enforce_scene_plan_approved_immutability() from public;
revoke all on function public.enforce_scene_plan_approved_immutability() from anon;
revoke all on function public.enforce_scene_plan_approved_immutability() from authenticated;

create trigger scene_plan_versions_approved_immutability_guard
before update or delete on public.scene_plan_versions
for each row execute function public.enforce_scene_plan_approved_immutability();

create or replace function public.enforce_scene_plan_child_immutability()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  plan_status text;
begin
  if tg_table_name = 'scene_plan_scenes' then
    select status into plan_status from public.scene_plan_versions where id = coalesce(new.scene_plan_version_id, old.scene_plan_version_id);
  elsif tg_table_name = 'scene_plan_shots' then
    select v.status into plan_status
      from public.scene_plan_versions v
      join public.scene_plan_scenes s on s.scene_plan_version_id = v.id
      where s.id = coalesce(new.scene_id, old.scene_id);
  elsif tg_table_name = 'scene_plan_qc_findings' then
    select status into plan_status from public.scene_plan_versions where id = coalesce(new.scene_plan_version_id, old.scene_plan_version_id);
  end if;

  if plan_status = 'APPROVED' then
    raise exception 'approved scene plan child records are immutable';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

revoke all on function public.enforce_scene_plan_child_immutability() from public;
revoke all on function public.enforce_scene_plan_child_immutability() from anon;
revoke all on function public.enforce_scene_plan_child_immutability() from authenticated;

create trigger scene_plan_scenes_approved_immutability_guard
before insert or update or delete on public.scene_plan_scenes
for each row execute function public.enforce_scene_plan_child_immutability();

create trigger scene_plan_shots_approved_immutability_guard
before insert or update or delete on public.scene_plan_shots
for each row execute function public.enforce_scene_plan_child_immutability();

create trigger scene_plan_qc_approved_immutability_guard
before insert or update or delete on public.scene_plan_qc_findings
for each row execute function public.enforce_scene_plan_child_immutability();

alter table public.video_projects enable row level security;
alter table public.visual_bibles enable row level security;
alter table public.scene_plan_versions enable row level security;
alter table public.scene_plan_scenes enable row level security;
alter table public.scene_plan_shots enable row level security;
alter table public.scene_plan_qc_findings enable row level security;

create policy video_projects_select_member on public.video_projects
for select to authenticated using (public.is_org_member(organization_id));
create policy video_projects_insert_editor on public.video_projects
for insert to authenticated with check (
  public.has_org_role(organization_id, array['OWNER','ADMIN','EDITOR'])
  and (created_by is null or created_by = auth.uid())
);
create policy video_projects_update_editor on public.video_projects
for update to authenticated
using (public.has_org_role(organization_id, array['OWNER','ADMIN','EDITOR']))
with check (public.has_org_role(organization_id, array['OWNER','ADMIN','EDITOR']));
create policy video_projects_delete_admin on public.video_projects
for delete to authenticated using (public.has_org_role(organization_id, array['OWNER','ADMIN']));

create policy visual_bibles_select_member on public.visual_bibles
for select to authenticated using (public.is_org_member(organization_id));
create policy visual_bibles_insert_editor on public.visual_bibles
for insert to authenticated with check (public.has_org_role(organization_id, array['OWNER','ADMIN','EDITOR']));
create policy visual_bibles_update_editor on public.visual_bibles
for update to authenticated
using (public.has_org_role(organization_id, array['OWNER','ADMIN','EDITOR']))
with check (public.has_org_role(organization_id, array['OWNER','ADMIN','EDITOR']));
create policy visual_bibles_delete_admin on public.visual_bibles
for delete to authenticated using (public.has_org_role(organization_id, array['OWNER','ADMIN']));

create policy scene_plan_versions_select_member on public.scene_plan_versions
for select to authenticated using (public.is_org_member(organization_id));
create policy scene_plan_versions_insert_editor on public.scene_plan_versions
for insert to authenticated with check (
  public.has_org_role(organization_id, array['OWNER','ADMIN','EDITOR'])
  and (created_by is null or created_by = auth.uid())
);
create policy scene_plan_versions_update_editor on public.scene_plan_versions
for update to authenticated
using (public.has_org_role(organization_id, array['OWNER','ADMIN','EDITOR']))
with check (public.has_org_role(organization_id, array['OWNER','ADMIN','EDITOR']));
create policy scene_plan_versions_delete_admin on public.scene_plan_versions
for delete to authenticated using (public.has_org_role(organization_id, array['OWNER','ADMIN']));

create policy scene_plan_scenes_select_member on public.scene_plan_scenes
for select to authenticated using (public.is_org_member(organization_id));
create policy scene_plan_scenes_insert_editor on public.scene_plan_scenes
for insert to authenticated with check (public.has_org_role(organization_id, array['OWNER','ADMIN','EDITOR']));
create policy scene_plan_scenes_update_editor on public.scene_plan_scenes
for update to authenticated
using (public.has_org_role(organization_id, array['OWNER','ADMIN','EDITOR']))
with check (public.has_org_role(organization_id, array['OWNER','ADMIN','EDITOR']));
create policy scene_plan_scenes_delete_admin on public.scene_plan_scenes
for delete to authenticated using (public.has_org_role(organization_id, array['OWNER','ADMIN']));

create policy scene_plan_shots_select_member on public.scene_plan_shots
for select to authenticated using (public.is_org_member(organization_id));
create policy scene_plan_shots_insert_editor on public.scene_plan_shots
for insert to authenticated with check (public.has_org_role(organization_id, array['OWNER','ADMIN','EDITOR']));
create policy scene_plan_shots_update_editor on public.scene_plan_shots
for update to authenticated
using (public.has_org_role(organization_id, array['OWNER','ADMIN','EDITOR']))
with check (public.has_org_role(organization_id, array['OWNER','ADMIN','EDITOR']));
create policy scene_plan_shots_delete_admin on public.scene_plan_shots
for delete to authenticated using (public.has_org_role(organization_id, array['OWNER','ADMIN']));

create policy scene_plan_qc_select_member on public.scene_plan_qc_findings
for select to authenticated using (public.is_org_member(organization_id));
create policy scene_plan_qc_insert_editor on public.scene_plan_qc_findings
for insert to authenticated with check (public.has_org_role(organization_id, array['OWNER','ADMIN','EDITOR']));
create policy scene_plan_qc_update_editor on public.scene_plan_qc_findings
for update to authenticated
using (public.has_org_role(organization_id, array['OWNER','ADMIN','EDITOR']))
with check (public.has_org_role(organization_id, array['OWNER','ADMIN','EDITOR']));
create policy scene_plan_qc_delete_admin on public.scene_plan_qc_findings
for delete to authenticated using (public.has_org_role(organization_id, array['OWNER','ADMIN']));
