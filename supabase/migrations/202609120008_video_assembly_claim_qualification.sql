create or replace function public.claim_video_assembly_work(
  _worker_id text,
  _lease_seconds integer default 900
)
returns table (
  organization_id uuid,
  job_id uuid,
  assembly_id uuid,
  plan_version_id uuid,
  render_profile text,
  aspect_ratio text,
  readiness_hash text,
  source_integrity_hash text,
  expected_duration_seconds numeric,
  component_count integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job public.jobs%rowtype;
  v_assembly public.video_assemblies%rowtype;
  v_now timestamptz := now();
begin
  if _worker_id is null or btrim(_worker_id) = '' or length(_worker_id) > 128 then
    raise exception 'worker id is required';
  end if;

  if _lease_seconds < 60 or _lease_seconds > 3600 then
    raise exception 'assembly lease must be between 60 and 3600 seconds';
  end if;

  with exhausted as (
    update public.jobs j
    set state = 'FAILED',
        failure_metadata = jsonb_build_object(
          'code', 'WORKER_LEASE_EXHAUSTED',
          'message', 'Final assembly worker lease expired after the maximum attempt count.',
          'retryable', false
        ),
        completed_at = v_now,
        lease_owner = null,
        lease_expires_at = null,
        updated_at = v_now
    from public.video_assemblies a
    where a.job_id = j.id
      and a.organization_id = j.organization_id
      and j.job_type = 'FINAL_VIDEO_ASSEMBLY'
      and j.state = 'PROCESSING'
      and a.state = 'PROCESSING'
      and j.lease_expires_at is not null
      and j.lease_expires_at <= v_now
      and j.attempt_count >= j.max_attempts
    returning j.id, j.organization_id
  )
  update public.video_assemblies a
  set state = 'FAILED',
      failure_code = 'WORKER_LEASE_EXHAUSTED',
      failure_message = 'Final assembly worker lease expired after the maximum attempt count.',
      retryable = false,
      completed_at = v_now,
      updated_at = v_now
  from exhausted e
  where a.job_id = e.id
    and a.organization_id = e.organization_id;

  select j.* into v_job
  from public.jobs j
  join public.video_assemblies a
    on a.job_id = j.id
   and a.organization_id = j.organization_id
  where j.job_type = 'FINAL_VIDEO_ASSEMBLY'
    and j.resource_type = 'SCENE_PLAN_VERSION'
    and j.state in ('QUEUED', 'RETRYING', 'PROCESSING')
    and j.attempt_count < j.max_attempts
    and (j.lease_expires_at is null or j.lease_expires_at <= now())
    and (
      (j.state in ('QUEUED', 'RETRYING') and a.state = 'QUEUED')
      or (j.state = 'PROCESSING' and a.state = 'PROCESSING' and j.lease_expires_at <= now())
    )
    and (
      j.state = 'QUEUED'
      or j.state = 'PROCESSING'
      or (
        j.state = 'RETRYING'
        and j.updated_at <= now() - case
          when j.attempt_count <= 1 then interval '15 seconds'
          else interval '60 seconds'
        end
      )
    )
  order by j.created_at asc
  for update of j skip locked
  limit 1;

  if v_job.id is null then
    return;
  end if;

  update public.jobs as j
  set state = 'PROCESSING',
      attempt_count = j.attempt_count + 1,
      lease_owner = _worker_id,
      lease_expires_at = now() + make_interval(secs => _lease_seconds),
      started_at = coalesce(j.started_at, now()),
      completed_at = null,
      updated_at = now()
  where j.id = v_job.id
    and j.organization_id = v_job.organization_id;

  update public.video_assemblies a
  set state = 'PROCESSING',
      failure_code = null,
      failure_message = null,
      retryable = null,
      started_at = coalesce(a.started_at, now()),
      completed_at = null,
      updated_at = now()
  where a.job_id = v_job.id
    and a.organization_id = v_job.organization_id
  returning a.* into v_assembly;

  if v_assembly.id is null then
    raise exception 'assembly lineage is unavailable';
  end if;

  return query
  select
    v_assembly.organization_id,
    v_job.id,
    v_assembly.id,
    v_assembly.plan_version_id,
    v_assembly.render_profile,
    v_assembly.aspect_ratio,
    v_assembly.readiness_hash,
    v_assembly.source_integrity_hash,
    v_assembly.expected_duration_seconds,
    v_assembly.component_count;
end;
$$;

revoke all on function public.claim_video_assembly_work(text, integer) from public;
revoke all on function public.claim_video_assembly_work(text, integer) from anon;
revoke all on function public.claim_video_assembly_work(text, integer) from authenticated;
grant execute on function public.claim_video_assembly_work(text, integer) to service_role;
