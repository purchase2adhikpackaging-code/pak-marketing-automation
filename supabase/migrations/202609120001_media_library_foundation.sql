alter table public.media_assets
  add column if not exists storage_bucket text,
  add column if not exists display_name text,
  add column if not exists size_bytes bigint,
  add column if not exists metadata jsonb not null default '{}'::jsonb,
  add column if not exists created_by uuid references auth.users(id) on delete set null,
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by uuid references auth.users(id) on delete set null;

update public.media_assets
set storage_bucket = 'generated-media'
where storage_bucket is null;

alter table public.media_assets
  alter column storage_bucket set default 'generated-media',
  alter column storage_bucket set not null;

alter table public.media_assets
  drop constraint if exists media_assets_organization_id_storage_path_key;

alter table public.media_assets
  add constraint media_assets_storage_bucket_shape
    check (storage_bucket ~ '^[A-Za-z0-9._-]+$'),
  add constraint media_assets_size_bytes_positive
    check (size_bytes is null or size_bytes > 0),
  add constraint media_assets_org_bucket_path_uq
    unique (organization_id, storage_bucket, storage_path);

create index if not exists media_assets_org_status_created_idx
  on public.media_assets(organization_id, status, created_at desc, id desc);

create index if not exists media_assets_org_type_created_idx
  on public.media_assets(organization_id, asset_type, created_at desc, id desc);

create index if not exists media_assets_org_source_created_idx
  on public.media_assets(organization_id, source, created_at desc, id desc);

create index if not exists media_assets_created_by_idx
  on public.media_assets(created_by)
  where created_by is not null;

create index if not exists media_assets_archived_by_idx
  on public.media_assets(archived_by)
  where archived_by is not null;

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
    storage_bucket,
    storage_path,
    source,
    mime_type,
    duration_seconds,
    checksum,
    generating_job_id,
    status,
    created_at,
    updated_at
  ) values (
    _organization_id,
    'VIDEO',
    'generated-media',
    _storage_path,
    'GENERATED',
    _mime_type,
    _duration_seconds,
    _checksum,
    _job_id,
    'ACTIVE',
    v_now,
    v_now
  )
  on conflict (organization_id, storage_bucket, storage_path) do update
  set
    mime_type = excluded.mime_type,
    duration_seconds = excluded.duration_seconds,
    checksum = excluded.checksum,
    generating_job_id = excluded.generating_job_id,
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
    result_payload = jsonb_build_object(
      'mediaAssetId', v_media_id,
      'storageBucket', 'generated-media',
      'storagePath', _storage_path,
      'planVersionId', v_attempt.plan_version_id,
      'scenePlanSceneId', v_attempt.scene_id,
      'scenePlanShotId', v_attempt.shot_id
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
