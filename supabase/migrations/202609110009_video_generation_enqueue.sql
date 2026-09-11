create or replace function public.enqueue_video_shot_generation(
  _organization_id uuid,
  _plan_version_id uuid,
  _shot_id uuid,
  _profile text default 'QUALITY_1080P'
)
returns jsonb
language plpgsql
security invoker
set search_path = public, extensions
as $$
declare
  v_actor_user_id uuid := auth.uid();
  v_plan_status text;
  v_plan_source_hash text;
  v_current_source_hash text;
  v_source_artifact_id uuid;
  v_source_artifact_revision integer;
  v_source_script text;
  v_source_status text;
  v_scene_id uuid;
  v_prompt text;
  v_camera_motion text;
  v_continuity jsonb;
  v_aspect_ratio text;
  v_duration_seconds numeric(8,2);
  v_idempotency_key text;
  v_job_id uuid;
  v_attempt_id uuid;
  v_existing_job_id uuid;
  v_existing_attempt_id uuid;
begin
  if v_actor_user_id is null then
    raise exception 'authentication required';
  end if;

  if not public.has_org_role(_organization_id, array['OWNER','ADMIN','EDITOR']) then
    raise exception 'forbidden';
  end if;

  if _profile <> 'QUALITY_1080P' then
    raise exception 'unsupported video generation profile';
  end if;

  select
    v.status,
    v.source_integrity_hash,
    a.id,
    a.revision,
    a.script_text,
    a.status
  into
    v_plan_status,
    v_plan_source_hash,
    v_source_artifact_id,
    v_source_artifact_revision,
    v_source_script,
    v_source_status
  from public.scene_plan_versions v
  join public.video_projects p
    on p.id = v.video_project_id
   and p.organization_id = v.organization_id
  join public.content_script_artifacts a
    on a.id = p.source_artifact_id
   and a.organization_id = v.organization_id
  where v.id = _plan_version_id
    and v.organization_id = _organization_id;

  if v_plan_status is null then
    raise exception 'scene plan not found';
  end if;

  if v_plan_status <> 'APPROVED' then
    raise exception 'video generation requires an approved scene plan';
  end if;

  if v_source_status <> 'GENERATED' or v_source_script is null then
    raise exception 'scene plan source is no longer current';
  end if;

  v_current_source_hash := 'sha256:' || encode(
    digest(
      convert_to(v_source_artifact_id::text, 'UTF8')
      || decode('00', 'hex')
      || convert_to(v_source_artifact_revision::text, 'UTF8')
      || decode('00', 'hex')
      || convert_to(v_source_script, 'UTF8'),
      'sha256'
    ),
    'hex'
  );

  if v_current_source_hash <> v_plan_source_hash then
    raise exception 'scene plan source is stale';
  end if;

  if exists (
    select 1
    from public.scene_plan_qc_findings q
    where q.organization_id = _organization_id
      and q.scene_plan_version_id = _plan_version_id
      and q.severity = 'BLOCKER'
  ) then
    raise exception 'scene plan has blocker findings';
  end if;

  select
    s.id,
    sh.master_visual_prompt,
    sh.camera_motion,
    sh.continuity_state,
    sh.aspect_ratio,
    sh.duration_seconds
  into
    v_scene_id,
    v_prompt,
    v_camera_motion,
    v_continuity,
    v_aspect_ratio,
    v_duration_seconds
  from public.scene_plan_shots sh
  join public.scene_plan_scenes s
    on s.id = sh.scene_id
   and s.organization_id = sh.organization_id
  where sh.id = _shot_id
    and sh.organization_id = _organization_id
    and s.scene_plan_version_id = _plan_version_id;

  if v_scene_id is null then
    raise exception 'approved shot not found in scene plan';
  end if;

  if v_aspect_ratio not in ('16:9', '9:16') then
    raise exception 'shot aspect ratio is not supported for direct generation';
  end if;

  if v_duration_seconds < 4 or v_duration_seconds > 12 then
    raise exception 'shot duration is outside the supported generation envelope';
  end if;

  v_idempotency_key := 'video-shot:' || _plan_version_id::text || ':' || _shot_id::text || ':' || _profile;

  select j.id into v_existing_job_id
  from public.jobs j
  where j.organization_id = _organization_id
    and j.idempotency_key = v_idempotency_key
  limit 1;

  if v_existing_job_id is not null then
    select a.id into v_existing_attempt_id
    from public.video_generation_attempts a
    where a.organization_id = _organization_id
      and a.job_id = v_existing_job_id
    order by a.attempt_number asc
    limit 1;

    if v_existing_attempt_id is null then
      raise exception 'existing video generation job has no lineage attempt';
    end if;

    return jsonb_build_object(
      'jobId', v_existing_job_id,
      'attemptId', v_existing_attempt_id,
      'reused', true
    );
  end if;

  insert into public.jobs (
    organization_id,
    job_type,
    resource_type,
    resource_id,
    state,
    attempt_count,
    max_attempts,
    retry_policy,
    input_payload,
    idempotency_key
  ) values (
    _organization_id,
    'VIDEO_SHOT_GENERATION',
    'SCENE_PLAN_SHOT',
    _shot_id,
    'QUEUED',
    0,
    4,
    jsonb_build_object(
      'strategy', 'EXPONENTIAL',
      'baseDelaySeconds', 15,
      'maxDelaySeconds', 300
    ),
    jsonb_build_object(
      'schemaVersion', 'video-shot-generation-v1',
      'organizationId', _organization_id,
      'planVersionId', _plan_version_id,
      'sceneId', v_scene_id,
      'shotId', _shot_id,
      'sourceIntegrityHash', v_plan_source_hash,
      'prompt', v_prompt,
      'cameraMotion', v_camera_motion,
      'continuity', coalesce(v_continuity, '{}'::jsonb),
      'aspectRatio', v_aspect_ratio,
      'durationSeconds', v_duration_seconds,
      'generateAudio', false,
      'profile', _profile,
      'provider', 'LTX',
      'providerModel', 'ltx-2-5-pro'
    ),
    v_idempotency_key
  )
  returning id into v_job_id;

  insert into public.video_generation_attempts (
    organization_id,
    job_id,
    plan_version_id,
    scene_id,
    shot_id,
    attempt_number,
    provider,
    provider_model,
    state,
    requested_duration_seconds,
    generate_audio,
    prompt_hash,
    created_by
  ) values (
    _organization_id,
    v_job_id,
    _plan_version_id,
    v_scene_id,
    _shot_id,
    1,
    'LTX',
    'ltx-2-5-pro',
    'QUEUED',
    v_duration_seconds,
    false,
    'sha256:' || encode(digest(convert_to(v_prompt, 'UTF8'), 'sha256'), 'hex'),
    v_actor_user_id
  )
  returning id into v_attempt_id;

  return jsonb_build_object(
    'jobId', v_job_id,
    'attemptId', v_attempt_id,
    'reused', false
  );
end;
$$;

revoke all on function public.enqueue_video_shot_generation(uuid, uuid, uuid, text) from public;
revoke all on function public.enqueue_video_shot_generation(uuid, uuid, uuid, text) from anon;
grant execute on function public.enqueue_video_shot_generation(uuid, uuid, uuid, text) to authenticated;
