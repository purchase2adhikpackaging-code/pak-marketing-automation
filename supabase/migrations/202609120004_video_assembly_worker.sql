do $$
begin
  if not exists (
    select 1
    from vault.secrets
    where name = 'pak/video-assembly/worker'
  ) then
    perform vault.create_secret(
      encode(extensions.gen_random_bytes(32), 'hex'),
      'pak/video-assembly/worker',
      'Internal credential for the Phase 8 final video assembly render worker.',
      null
    );
  end if;
end;
$$;

create or replace function public.read_video_assembly_worker_secret()
returns text
language sql
security definer
stable
set search_path = public, vault
as $$
  select decrypted_secret
  from vault.decrypted_secrets
  where name = 'pak/video-assembly/worker'
  limit 1;
$$;

revoke all on function public.read_video_assembly_worker_secret() from public;
revoke all on function public.read_video_assembly_worker_secret() from anon;
revoke all on function public.read_video_assembly_worker_secret() from authenticated;
grant execute on function public.read_video_assembly_worker_secret() to service_role;

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

  update public.jobs
  set state = 'PROCESSING',
      attempt_count = attempt_count + 1,
      lease_owner = _worker_id,
      lease_expires_at = now() + make_interval(secs => _lease_seconds),
      started_at = coalesce(started_at, now()),
      completed_at = null,
      updated_at = now()
  where id = v_job.id
    and organization_id = v_job.organization_id;

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

create or replace function public.complete_video_assembly_work(
  _worker_id text,
  _organization_id uuid,
  _job_id uuid,
  _assembly_id uuid,
  _storage_path text,
  _checksum text,
  _duration_seconds numeric,
  _width integer,
  _height integer,
  _size_bytes bigint
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job public.jobs%rowtype;
  v_assembly public.video_assemblies%rowtype;
  v_expected_path text;
  v_media_id uuid;
  v_now timestamptz := now();
  v_duration_tolerance numeric;
begin
  if _worker_id is null or btrim(_worker_id) = '' then
    raise exception 'worker id is required';
  end if;

  if _storage_path is null or btrim(_storage_path) = ''
     or _checksum is null or _checksum !~ '^sha256:[0-9a-f]{64}$'
     or _duration_seconds is null or _duration_seconds <= 0
     or _width is null or _width <= 0
     or _height is null or _height <= 0
     or _size_bytes is null or _size_bytes <= 0 then
    raise exception 'invalid final assembly output metadata';
  end if;

  select * into v_assembly
  from public.video_assemblies
  where id = _assembly_id
    and organization_id = _organization_id
    and job_id = _job_id
  for update;

  if v_assembly.id is null then
    raise exception 'video assembly not found';
  end if;

  if v_assembly.state = 'COMPLETED' and v_assembly.final_media_asset_id is not null then
    return v_assembly.final_media_asset_id;
  end if;

  select * into v_job
  from public.jobs
  where id = _job_id
    and organization_id = _organization_id
    and job_type = 'FINAL_VIDEO_ASSEMBLY'
    and resource_type = 'SCENE_PLAN_VERSION'
    and resource_id = v_assembly.plan_version_id
  for update;

  if v_job.id is null then
    raise exception 'final assembly job lineage mismatch';
  end if;

  if v_job.state <> 'PROCESSING'
     or v_job.lease_owner is distinct from _worker_id
     or v_job.lease_expires_at is null
     or v_job.lease_expires_at <= now()
     or v_assembly.state <> 'PROCESSING' then
    raise exception 'final assembly lease is not active';
  end if;

  v_expected_path := _organization_id::text
    || '/final-video/'
    || v_assembly.plan_version_id::text
    || '-'
    || substr(replace(v_assembly.readiness_hash, 'sha256:', ''), 1, 16)
    || '.mp4';

  if _storage_path <> v_expected_path then
    raise exception 'final assembly output path mismatch';
  end if;

  if (v_assembly.aspect_ratio = '16:9' and (_width <> 1920 or _height <> 1080))
     or (v_assembly.aspect_ratio = '9:16' and (_width <> 1080 or _height <> 1920)) then
    raise exception 'final assembly output dimensions mismatch';
  end if;

  v_duration_tolerance := greatest(2.0, v_assembly.expected_duration_seconds * 0.05);
  if abs(_duration_seconds - v_assembly.expected_duration_seconds) > v_duration_tolerance then
    raise exception 'final assembly output duration mismatch';
  end if;

  insert into public.media_assets (
    organization_id,
    asset_type,
    storage_bucket,
    storage_path,
    source,
    mime_type,
    width,
    height,
    duration_seconds,
    checksum,
    generating_job_id,
    status,
    display_name,
    size_bytes,
    metadata,
    created_by,
    created_at,
    updated_at
  ) values (
    _organization_id,
    'VIDEO',
    'generated-media',
    _storage_path,
    'GENERATED',
    'video/mp4',
    _width,
    _height,
    _duration_seconds,
    _checksum,
    _job_id,
    'ACTIVE',
    'Final video ' || v_assembly.plan_version_id::text,
    _size_bytes,
    jsonb_build_object(
      'kind', 'FINAL_VIDEO',
      'assemblyId', v_assembly.id,
      'planVersionId', v_assembly.plan_version_id,
      'readinessHash', v_assembly.readiness_hash,
      'renderProfile', v_assembly.render_profile,
      'aspectRatio', v_assembly.aspect_ratio
    ),
    v_assembly.created_by,
    v_now,
    v_now
  )
  on conflict (organization_id, storage_bucket, storage_path) do update
  set
    mime_type = excluded.mime_type,
    width = excluded.width,
    height = excluded.height,
    duration_seconds = excluded.duration_seconds,
    checksum = excluded.checksum,
    generating_job_id = excluded.generating_job_id,
    status = 'ACTIVE',
    display_name = excluded.display_name,
    size_bytes = excluded.size_bytes,
    metadata = excluded.metadata,
    updated_at = v_now
  returning id into v_media_id;

  update public.video_assemblies
  set state = 'COMPLETED',
      final_media_asset_id = v_media_id,
      failure_code = null,
      failure_message = null,
      retryable = null,
      completed_at = v_now,
      updated_at = v_now
  where id = _assembly_id
    and organization_id = _organization_id
    and job_id = _job_id;

  update public.jobs
  set state = 'COMPLETED',
      result_payload = jsonb_build_object(
        'assemblyId', _assembly_id,
        'mediaAssetId', v_media_id,
        'storageBucket', 'generated-media',
        'storagePath', _storage_path,
        'checksum', _checksum
      ),
      failure_metadata = null,
      completed_at = v_now,
      lease_owner = null,
      lease_expires_at = null,
      updated_at = v_now
  where id = _job_id
    and organization_id = _organization_id;

  return v_media_id;
end;
$$;

revoke all on function public.complete_video_assembly_work(text, uuid, uuid, uuid, text, text, numeric, integer, integer, bigint) from public;
revoke all on function public.complete_video_assembly_work(text, uuid, uuid, uuid, text, text, numeric, integer, integer, bigint) from anon;
revoke all on function public.complete_video_assembly_work(text, uuid, uuid, uuid, text, text, numeric, integer, integer, bigint) from authenticated;
grant execute on function public.complete_video_assembly_work(text, uuid, uuid, uuid, text, text, numeric, integer, integer, bigint) to service_role;

create or replace function public.fail_video_assembly_work(
  _worker_id text,
  _organization_id uuid,
  _job_id uuid,
  _assembly_id uuid,
  _error_code text,
  _error_message text,
  _retryable boolean
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job public.jobs%rowtype;
  v_assembly public.video_assemblies%rowtype;
  v_should_retry boolean;
  v_now timestamptz := now();
  v_next_state text;
begin
  if _worker_id is null or btrim(_worker_id) = ''
     or _error_code is null or btrim(_error_code) = ''
     or length(_error_code) > 96
     or _error_message is null or length(_error_message) > 1000
     or _retryable is null then
    raise exception 'invalid final assembly failure report';
  end if;

  select * into v_assembly
  from public.video_assemblies
  where id = _assembly_id
    and organization_id = _organization_id
    and job_id = _job_id
  for update;

  if v_assembly.id is null then
    raise exception 'video assembly not found';
  end if;

  if v_assembly.state = 'COMPLETED' then
    return 'COMPLETED';
  end if;

  select * into v_job
  from public.jobs
  where id = _job_id
    and organization_id = _organization_id
    and job_type = 'FINAL_VIDEO_ASSEMBLY'
  for update;

  if v_job.id is null
     or v_job.state <> 'PROCESSING'
     or v_job.lease_owner is distinct from _worker_id then
    raise exception 'final assembly lease is not active';
  end if;

  v_should_retry := _retryable and v_job.attempt_count < v_job.max_attempts;
  v_next_state := case when v_should_retry then 'RETRYING' else 'FAILED' end;

  update public.jobs
  set state = v_next_state,
      failure_metadata = jsonb_build_object(
        'code', _error_code,
        'message', _error_message,
        'retryable', v_should_retry
      ),
      completed_at = case when v_should_retry then null else v_now end,
      lease_owner = null,
      lease_expires_at = null,
      updated_at = v_now
  where id = _job_id
    and organization_id = _organization_id;

  update public.video_assemblies
  set state = case when v_should_retry then 'QUEUED' else 'FAILED' end,
      failure_code = _error_code,
      failure_message = _error_message,
      retryable = v_should_retry,
      completed_at = case when v_should_retry then null else v_now end,
      updated_at = v_now
  where id = _assembly_id
    and organization_id = _organization_id
    and job_id = _job_id;

  return v_next_state;
end;
$$;

revoke all on function public.fail_video_assembly_work(text, uuid, uuid, uuid, text, text, boolean) from public;
revoke all on function public.fail_video_assembly_work(text, uuid, uuid, uuid, text, text, boolean) from anon;
revoke all on function public.fail_video_assembly_work(text, uuid, uuid, uuid, text, text, boolean) from authenticated;
grant execute on function public.fail_video_assembly_work(text, uuid, uuid, uuid, text, text, boolean) to service_role;
