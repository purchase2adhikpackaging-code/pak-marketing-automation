create or replace function public.schedule_video_generation_retry(
  _organization_id uuid,
  _job_id uuid,
  _failed_attempt_id uuid
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_failed public.video_generation_attempts;
  v_job public.jobs;
  v_new_attempt_id uuid;
begin
  select * into v_failed
  from public.video_generation_attempts
  where id = _failed_attempt_id
    and organization_id = _organization_id
    and job_id = _job_id
    and state = 'FAILED'
    and retryable is true
  for update;

  if v_failed.id is null then
    raise exception 'retryable failed video generation attempt not found';
  end if;

  if v_failed.attempt_number >= 4 then
    raise exception 'video generation retry limit reached';
  end if;

  select * into v_job
  from public.jobs
  where id = _job_id
    and organization_id = _organization_id
    and job_type = 'VIDEO_SHOT_GENERATION'
  for update;

  if v_job.id is null then
    raise exception 'video generation job not found';
  end if;

  if exists (
    select 1
    from public.video_generation_attempts existing
    where existing.organization_id = _organization_id
      and existing.job_id = _job_id
      and existing.attempt_number = v_failed.attempt_number + 1
  ) then
    select existing.id into v_new_attempt_id
    from public.video_generation_attempts existing
    where existing.organization_id = _organization_id
      and existing.job_id = _job_id
      and existing.attempt_number = v_failed.attempt_number + 1
    limit 1;
    return v_new_attempt_id;
  end if;

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
    v_failed.organization_id,
    v_failed.job_id,
    v_failed.plan_version_id,
    v_failed.scene_id,
    v_failed.shot_id,
    v_failed.attempt_number + 1,
    v_failed.provider,
    v_failed.provider_model,
    'QUEUED',
    v_failed.requested_duration_seconds,
    v_failed.generate_audio,
    v_failed.prompt_hash,
    v_failed.created_by
  )
  returning id into v_new_attempt_id;

  update public.jobs
  set state = 'RETRYING',
      failure_metadata = null,
      completed_at = null,
      lease_owner = null,
      lease_expires_at = null,
      updated_at = now()
  where id = _job_id
    and organization_id = _organization_id;

  return v_new_attempt_id;
end;
$$;

revoke all on function public.schedule_video_generation_retry(uuid, uuid, uuid) from public;
revoke all on function public.schedule_video_generation_retry(uuid, uuid, uuid) from anon;
revoke all on function public.schedule_video_generation_retry(uuid, uuid, uuid) from authenticated;
grant execute on function public.schedule_video_generation_retry(uuid, uuid, uuid) to service_role;
