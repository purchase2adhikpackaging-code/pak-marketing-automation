insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
) values (
  'generated-media',
  'generated-media',
  false,
  268435456,
  array['video/mp4','video/webm','video/quicktime']
)
on conflict (id) do update
set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.complete_generated_video_import(
  _organization_id uuid,
  _job_id uuid,
  _attempt_id uuid,
  _storage_path text,
  _mime_type text,
  _duration_seconds numeric,
  _checksum text
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_attempt public.video_generation_attempts%rowtype;
  v_job public.jobs%rowtype;
  v_media_id uuid;
  v_now timestamptz := now();
begin
  if _organization_id is null
     or _job_id is null
     or _attempt_id is null
     or _storage_path is null
     or btrim(_storage_path) = ''
     or _mime_type is null
     or _mime_type not like 'video/%'
     or _duration_seconds is null
     or _duration_seconds <= 0
     or _checksum is null
     or _checksum !~ '^sha256:[0-9a-f]{64}$' then
    raise exception 'invalid generated video import input';
  end if;

  if _storage_path not like (_organization_id::text || '/generated-video/%') then
    raise exception 'generated video storage path must remain organization scoped';
  end if;

  select * into v_attempt
  from public.video_generation_attempts
  where id = _attempt_id
    and organization_id = _organization_id
    and job_id = _job_id
  for update;

  if v_attempt.id is null then
    raise exception 'video generation attempt not found';
  end if;

  select * into v_job
  from public.jobs
  where id = _job_id
    and organization_id = _organization_id
    and job_type = 'VIDEO_SHOT_GENERATION'
    and resource_type = 'SCENE_PLAN_SHOT'
    and resource_id = v_attempt.shot_id
  for update;

  if v_job.id is null then
    raise exception 'video generation job lineage mismatch';
  end if;

  if v_attempt.state = 'COMPLETED' and v_attempt.media_asset_id is not null then
    return v_attempt.media_asset_id;
  end if;

  if v_attempt.state <> 'IMPORT_PENDING' then
    raise exception 'video generation attempt is not ready for media import';
  end if;

  insert into public.media_assets (
    organization_id,
    asset_type,
    storage_path,
    source,
    mime_type,
    duration_seconds,
    checksum,
    generating_job_id,
    scene_id,
    status,
    created_at,
    updated_at
  ) values (
    _organization_id,
    'VIDEO',
    _storage_path,
    'GENERATED',
    _mime_type,
    _duration_seconds,
    _checksum,
    _job_id,
    v_attempt.scene_id,
    'ACTIVE',
    v_now,
    v_now
  )
  on conflict (organization_id, storage_path) do update
  set
    mime_type = excluded.mime_type,
    duration_seconds = excluded.duration_seconds,
    checksum = excluded.checksum,
    generating_job_id = excluded.generating_job_id,
    scene_id = excluded.scene_id,
    status = 'ACTIVE',
    updated_at = v_now
  returning id into v_media_id;

  update public.video_generation_attempts
  set
    media_asset_id = v_media_id,
    state = 'COMPLETED',
    imported_at = v_now,
    terminal_at = coalesce(terminal_at, v_now),
    error_code = null,
    error_message = null,
    retryable = null,
    updated_at = v_now
  where id = _attempt_id
    and organization_id = _organization_id
    and job_id = _job_id;

  update public.jobs
  set
    state = 'COMPLETED',
    progress = 100,
    result_payload = jsonb_build_object(
      'mediaAssetId', v_media_id,
      'storagePath', _storage_path
    ),
    failure_metadata = null,
    completed_at = coalesce(completed_at, v_now),
    updated_at = v_now
  where id = _job_id
    and organization_id = _organization_id;

  return v_media_id;
end;
$$;

revoke all on function public.complete_generated_video_import(uuid, uuid, uuid, text, text, numeric, text) from public;
revoke all on function public.complete_generated_video_import(uuid, uuid, uuid, text, text, numeric, text) from anon;
revoke all on function public.complete_generated_video_import(uuid, uuid, uuid, text, text, numeric, text) from authenticated;
grant execute on function public.complete_generated_video_import(uuid, uuid, uuid, text, text, numeric, text) to service_role;
