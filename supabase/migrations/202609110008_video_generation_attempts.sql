create table if not exists public.video_generation_attempts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  plan_version_id uuid not null references public.scene_plan_versions(id) on delete restrict,
  scene_id uuid not null references public.scene_plan_scenes(id) on delete restrict,
  shot_id uuid not null references public.scene_plan_shots(id) on delete restrict,
  media_asset_id uuid references public.media_assets(id) on delete set null,
  attempt_number integer not null default 1 check (attempt_number >= 1 and attempt_number <= 4),
  provider text not null check (provider ~ '^[A-Z0-9_-]{2,32}$'),
  provider_model text not null,
  provider_job_id text,
  state text not null default 'QUEUED'
    check (state in (
      'QUEUED',
      'SUBMITTING',
      'SUBMITTED',
      'PROCESSING',
      'IMPORT_PENDING',
      'COMPLETED',
      'FAILED',
      'CANCELLED',
      'SUBMISSION_UNKNOWN'
    )),
  requested_duration_seconds numeric(8,2) not null check (requested_duration_seconds > 0),
  effective_duration_seconds numeric(8,2) check (effective_duration_seconds is null or effective_duration_seconds > 0),
  resolution text,
  fps integer check (fps is null or fps > 0),
  generate_audio boolean not null default false,
  prompt_hash text not null check (length(prompt_hash) >= 16),
  error_code text,
  error_message text,
  retryable boolean,
  submitted_at timestamptz,
  last_polled_at timestamptz,
  terminal_at timestamptz,
  imported_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (job_id, attempt_number)
);

create unique index if not exists video_generation_attempts_provider_job_uq
  on public.video_generation_attempts(provider, provider_job_id)
  where provider_job_id is not null;

create index if not exists video_generation_attempts_job_id_idx
  on public.video_generation_attempts(job_id);
create index if not exists video_generation_attempts_plan_version_id_idx
  on public.video_generation_attempts(plan_version_id);
create index if not exists video_generation_attempts_scene_id_idx
  on public.video_generation_attempts(scene_id);
create index if not exists video_generation_attempts_shot_id_idx
  on public.video_generation_attempts(shot_id);
create index if not exists video_generation_attempts_media_asset_id_idx
  on public.video_generation_attempts(media_asset_id)
  where media_asset_id is not null;
create index if not exists video_generation_attempts_created_by_idx
  on public.video_generation_attempts(created_by)
  where created_by is not null;
create index if not exists video_generation_attempts_org_state_idx
  on public.video_generation_attempts(organization_id, state, updated_at desc);

create or replace function public.enforce_video_generation_attempt_parentage()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_plan_org uuid;
  v_plan_status text;
  v_media_org uuid;
begin
  if tg_op = 'UPDATE' and (
    new.organization_id is distinct from old.organization_id
    or new.job_id is distinct from old.job_id
    or new.plan_version_id is distinct from old.plan_version_id
    or new.scene_id is distinct from old.scene_id
    or new.shot_id is distinct from old.shot_id
  ) then
    raise exception 'video generation attempt lineage is immutable';
  end if;

  select v.organization_id, v.status
    into v_plan_org, v_plan_status
    from public.scene_plan_versions v
    where v.id = new.plan_version_id;

  if v_plan_org is null or v_plan_org <> new.organization_id then
    raise exception 'video generation plan organization mismatch';
  end if;

  if tg_op = 'INSERT' and v_plan_status <> 'APPROVED' then
    raise exception 'video generation requires an approved scene plan';
  end if;

  if not exists (
    select 1
    from public.scene_plan_scenes s
    where s.id = new.scene_id
      and s.organization_id = new.organization_id
      and s.scene_plan_version_id = new.plan_version_id
  ) then
    raise exception 'video generation scene lineage mismatch';
  end if;

  if not exists (
    select 1
    from public.scene_plan_shots sh
    where sh.id = new.shot_id
      and sh.organization_id = new.organization_id
      and sh.scene_id = new.scene_id
  ) then
    raise exception 'video generation shot lineage mismatch';
  end if;

  if not exists (
    select 1
    from public.jobs j
    where j.id = new.job_id
      and j.organization_id = new.organization_id
  ) then
    raise exception 'video generation job organization mismatch';
  end if;

  if new.media_asset_id is not null then
    select m.organization_id into v_media_org
      from public.media_assets m
      where m.id = new.media_asset_id;
    if v_media_org is null or v_media_org <> new.organization_id then
      raise exception 'video generation media organization mismatch';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_video_generation_attempt_parentage() from public;
revoke all on function public.enforce_video_generation_attempt_parentage() from anon;
revoke all on function public.enforce_video_generation_attempt_parentage() from authenticated;

create trigger video_generation_attempts_parentage_guard
before insert or update of organization_id, job_id, plan_version_id, scene_id, shot_id, media_asset_id
on public.video_generation_attempts
for each row execute function public.enforce_video_generation_attempt_parentage();

alter table public.video_generation_attempts enable row level security;

create policy video_generation_attempts_select_member
on public.video_generation_attempts
for select
to authenticated
using (public.is_org_member(organization_id));

create policy video_generation_attempts_insert_editor
on public.video_generation_attempts
for insert
to authenticated
with check (
  public.has_org_role(organization_id, array['OWNER','ADMIN','EDITOR'])
  and (created_by is null or created_by = (select auth.uid()))
  and exists (
    select 1
    from public.jobs j
    where j.id = video_generation_attempts.job_id
      and j.organization_id = video_generation_attempts.organization_id
  )
  and exists (
    select 1
    from public.scene_plan_versions v
    join public.scene_plan_scenes s on s.scene_plan_version_id = v.id
    join public.scene_plan_shots sh on sh.scene_id = s.id
    where v.id = video_generation_attempts.plan_version_id
      and s.id = video_generation_attempts.scene_id
      and sh.id = video_generation_attempts.shot_id
      and v.organization_id = video_generation_attempts.organization_id
      and s.organization_id = video_generation_attempts.organization_id
      and sh.organization_id = video_generation_attempts.organization_id
      and v.status = 'APPROVED'
  )
);

-- No authenticated UPDATE/DELETE policies are created. Provider execution state is
-- reconciled only by the trusted Edge execution boundary. Members can read lineage.
