create or replace function public.update_scene_plan_scene_draft(
  _organization_id uuid,
  _plan_version_id uuid,
  _scene_id uuid,
  _title text,
  _duration_seconds numeric,
  _creative_direction text
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  plan_status text;
begin
  if auth.uid() is null
    or not public.has_org_role(_organization_id, array['OWNER','ADMIN','EDITOR']) then
    raise exception 'not authorized to edit scene planning content';
  end if;

  select status into plan_status
  from public.scene_plan_versions
  where id = _plan_version_id
    and organization_id = _organization_id;

  if plan_status is null then
    raise exception 'scene plan version does not exist';
  end if;

  if plan_status not in ('DRAFT','QC_REQUIRED','REVIEW_REQUIRED') then
    raise exception 'scene plan version is not editable';
  end if;

  if nullif(btrim(_title), '') is null
    or _duration_seconds <= 0
    or nullif(btrim(_creative_direction), '') is null then
    raise exception 'scene edit fields are invalid';
  end if;

  update public.scene_plan_scenes
  set title = _title,
      duration_seconds = _duration_seconds,
      creative_direction = _creative_direction,
      updated_at = now()
  where id = _scene_id
    and organization_id = _organization_id
    and scene_plan_version_id = _plan_version_id;

  if not found then
    raise exception 'scene does not belong to the requested scene plan version';
  end if;

  delete from public.scene_plan_qc_findings
  where organization_id = _organization_id
    and scene_plan_version_id = _plan_version_id;

  update public.scene_plan_versions
  set status = 'QC_REQUIRED',
      qc_summary = '{}'::jsonb,
      narration_coverage_hash = null,
      updated_at = now()
  where id = _plan_version_id
    and organization_id = _organization_id;
end;
$$;

revoke all on function public.update_scene_plan_scene_draft(uuid,uuid,uuid,text,numeric,text) from public;
revoke all on function public.update_scene_plan_scene_draft(uuid,uuid,uuid,text,numeric,text) from anon;
grant execute on function public.update_scene_plan_scene_draft(uuid,uuid,uuid,text,numeric,text) to authenticated;

create or replace function public.update_scene_plan_shot_draft(
  _organization_id uuid,
  _plan_version_id uuid,
  _shot_id uuid,
  _duration_seconds numeric,
  _creative_direction text,
  _master_visual_prompt text,
  _camera_motion text
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  plan_status text;
  target_scene_id uuid;
begin
  if auth.uid() is null
    or not public.has_org_role(_organization_id, array['OWNER','ADMIN','EDITOR']) then
    raise exception 'not authorized to edit scene planning content';
  end if;

  select status into plan_status
  from public.scene_plan_versions
  where id = _plan_version_id
    and organization_id = _organization_id;

  if plan_status is null then
    raise exception 'scene plan version does not exist';
  end if;

  if plan_status not in ('DRAFT','QC_REQUIRED','REVIEW_REQUIRED') then
    raise exception 'scene plan version is not editable';
  end if;

  if _duration_seconds <= 0
    or nullif(btrim(_creative_direction), '') is null
    or nullif(btrim(_master_visual_prompt), '') is null then
    raise exception 'shot edit fields are invalid';
  end if;

  select s.id into target_scene_id
  from public.scene_plan_scenes s
  join public.scene_plan_shots sh on sh.scene_id = s.id
  where sh.id = _shot_id
    and sh.organization_id = _organization_id
    and s.organization_id = _organization_id
    and s.scene_plan_version_id = _plan_version_id;

  if target_scene_id is null then
    raise exception 'shot does not belong to the requested scene plan version';
  end if;

  update public.scene_plan_shots
  set duration_seconds = _duration_seconds,
      creative_direction = _creative_direction,
      master_visual_prompt = _master_visual_prompt,
      camera_motion = coalesce(_camera_motion, ''),
      human_modified = true,
      updated_at = now()
  where id = _shot_id
    and organization_id = _organization_id
    and scene_id = target_scene_id;

  delete from public.scene_plan_qc_findings
  where organization_id = _organization_id
    and scene_plan_version_id = _plan_version_id;

  update public.scene_plan_versions
  set status = 'QC_REQUIRED',
      qc_summary = '{}'::jsonb,
      narration_coverage_hash = null,
      updated_at = now()
  where id = _plan_version_id
    and organization_id = _organization_id;
end;
$$;

revoke all on function public.update_scene_plan_shot_draft(uuid,uuid,uuid,numeric,text,text,text) from public;
revoke all on function public.update_scene_plan_shot_draft(uuid,uuid,uuid,numeric,text,text,text) from anon;
grant execute on function public.update_scene_plan_shot_draft(uuid,uuid,uuid,numeric,text,text,text) to authenticated;

create or replace function public.reorder_scene_plan_scenes(
  _organization_id uuid,
  _plan_version_id uuid,
  _ordered_scene_ids uuid[]
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  plan_status text;
  existing_count integer;
  requested_count integer;
  matched_count integer;
begin
  if auth.uid() is null
    or not public.has_org_role(_organization_id, array['OWNER','ADMIN','EDITOR']) then
    raise exception 'not authorized to reorder scene planning content';
  end if;

  select status into plan_status
  from public.scene_plan_versions
  where id = _plan_version_id
    and organization_id = _organization_id;

  if plan_status is null then
    raise exception 'scene plan version does not exist';
  end if;

  if plan_status not in ('DRAFT','QC_REQUIRED','REVIEW_REQUIRED') then
    raise exception 'scene plan version is not editable';
  end if;

  select count(*) into existing_count
  from public.scene_plan_scenes
  where organization_id = _organization_id
    and scene_plan_version_id = _plan_version_id;

  requested_count := coalesce(cardinality(_ordered_scene_ids), 0);

  select count(distinct requested.id) into matched_count
  from unnest(_ordered_scene_ids) as requested(id)
  join public.scene_plan_scenes s on s.id = requested.id
  where s.organization_id = _organization_id
    and s.scene_plan_version_id = _plan_version_id;

  if existing_count = 0
    or requested_count <> existing_count
    or matched_count <> existing_count then
    raise exception 'scene reorder must include every scene exactly once';
  end if;

  update public.scene_plan_scenes
  set ordinal = ordinal + 1000000,
      updated_at = now()
  where organization_id = _organization_id
    and scene_plan_version_id = _plan_version_id;

  with requested as (
    select id, position::integer as ordinal
    from unnest(_ordered_scene_ids) with ordinality as ordered(id, position)
  )
  update public.scene_plan_scenes s
  set ordinal = requested.ordinal,
      updated_at = now()
  from requested
  where s.id = requested.id
    and s.organization_id = _organization_id
    and s.scene_plan_version_id = _plan_version_id;

  delete from public.scene_plan_qc_findings
  where organization_id = _organization_id
    and scene_plan_version_id = _plan_version_id;

  update public.scene_plan_versions
  set status = 'QC_REQUIRED',
      qc_summary = '{}'::jsonb,
      narration_coverage_hash = null,
      updated_at = now()
  where id = _plan_version_id
    and organization_id = _organization_id;
end;
$$;

revoke all on function public.reorder_scene_plan_scenes(uuid,uuid,uuid[]) from public;
revoke all on function public.reorder_scene_plan_scenes(uuid,uuid,uuid[]) from anon;
grant execute on function public.reorder_scene_plan_scenes(uuid,uuid,uuid[]) to authenticated;

create or replace function public.reorder_scene_plan_shots(
  _organization_id uuid,
  _plan_version_id uuid,
  _scene_id uuid,
  _ordered_shot_ids uuid[]
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  plan_status text;
  scene_exists boolean;
  existing_count integer;
  requested_count integer;
  matched_count integer;
begin
  if auth.uid() is null
    or not public.has_org_role(_organization_id, array['OWNER','ADMIN','EDITOR']) then
    raise exception 'not authorized to reorder scene planning content';
  end if;

  select status into plan_status
  from public.scene_plan_versions
  where id = _plan_version_id
    and organization_id = _organization_id;

  if plan_status is null then
    raise exception 'scene plan version does not exist';
  end if;

  if plan_status not in ('DRAFT','QC_REQUIRED','REVIEW_REQUIRED') then
    raise exception 'scene plan version is not editable';
  end if;

  select exists (
    select 1
    from public.scene_plan_scenes
    where id = _scene_id
      and organization_id = _organization_id
      and scene_plan_version_id = _plan_version_id
  ) into scene_exists;

  if not scene_exists then
    raise exception 'scene does not belong to the requested scene plan version';
  end if;

  select count(*) into existing_count
  from public.scene_plan_shots
  where organization_id = _organization_id
    and scene_id = _scene_id;

  requested_count := coalesce(cardinality(_ordered_shot_ids), 0);

  select count(distinct requested.id) into matched_count
  from unnest(_ordered_shot_ids) as requested(id)
  join public.scene_plan_shots sh on sh.id = requested.id
  where sh.organization_id = _organization_id
    and sh.scene_id = _scene_id;

  if existing_count = 0
    or requested_count <> existing_count
    or matched_count <> existing_count then
    raise exception 'shot reorder must include every shot exactly once';
  end if;

  update public.scene_plan_shots
  set ordinal = ordinal + 1000000,
      updated_at = now()
  where organization_id = _organization_id
    and scene_id = _scene_id;

  with requested as (
    select id, position::integer as ordinal
    from unnest(_ordered_shot_ids) with ordinality as ordered(id, position)
  )
  update public.scene_plan_shots sh
  set ordinal = requested.ordinal,
      updated_at = now()
  from requested
  where sh.id = requested.id
    and sh.organization_id = _organization_id
    and sh.scene_id = _scene_id;

  delete from public.scene_plan_qc_findings
  where organization_id = _organization_id
    and scene_plan_version_id = _plan_version_id;

  update public.scene_plan_versions
  set status = 'QC_REQUIRED',
      qc_summary = '{}'::jsonb,
      narration_coverage_hash = null,
      updated_at = now()
  where id = _plan_version_id
    and organization_id = _organization_id;
end;
$$;

revoke all on function public.reorder_scene_plan_shots(uuid,uuid,uuid,uuid[]) from public;
revoke all on function public.reorder_scene_plan_shots(uuid,uuid,uuid,uuid[]) from anon;
grant execute on function public.reorder_scene_plan_shots(uuid,uuid,uuid,uuid[]) to authenticated;
