drop policy if exists jobs_insert_editor on public.jobs;
drop policy if exists jobs_update_editor on public.jobs;

create policy jobs_insert_editor
on public.jobs
for insert
to authenticated
with check (
  public.has_org_role(organization_id, array['OWNER','ADMIN','EDITOR'])
  and job_type not in ('VIDEO_SHOT_GENERATION', 'FINAL_VIDEO_ASSEMBLY')
);

create policy jobs_update_editor
on public.jobs
for update
to authenticated
using (
  public.has_org_role(organization_id, array['OWNER','ADMIN','EDITOR'])
  and job_type not in ('VIDEO_SHOT_GENERATION', 'FINAL_VIDEO_ASSEMBLY')
)
with check (
  public.has_org_role(organization_id, array['OWNER','ADMIN','EDITOR'])
  and job_type not in ('VIDEO_SHOT_GENERATION', 'FINAL_VIDEO_ASSEMBLY')
);

create or replace function public.enqueue_final_video_assembly(
  _organization_id uuid,
  _plan_version_id uuid,
  _profile text default 'PAK_MASTER_1080P_V1'
)
returns jsonb
language plpgsql
security definer
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
  v_aspect_ratio text;
  v_hash_input bytea := decode('', 'hex');
  v_readiness_hash text;
  v_components jsonb := '[]'::jsonb;
  v_component record;
  v_component_count integer := 0;
  v_expected_duration numeric(10,2) := 0;
  v_duration_millis bigint;
  v_idempotency_key text;
  v_existing_assembly_id uuid;
  v_existing_job_id uuid;
  v_existing_media_asset_id uuid;
  v_existing_state text;
  v_job_id uuid;
  v_assembly_id uuid;
begin
  if v_actor_user_id is null then
    raise exception 'authentication required';
  end if;

  if not public.has_org_role(_organization_id, array['OWNER','ADMIN','EDITOR']) then
    raise exception 'forbidden';
  end if;

  if _profile <> 'PAK_MASTER_1080P_V1' then
    raise exception 'unsupported final render profile';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(_organization_id::text || ':' || _plan_version_id::text, 0)
  );

  select
    v.status,
    v.source_integrity_hash,
    v.aspect_ratio,
    a.id,
    a.revision,
    a.script_text,
    a.status
  into
    v_plan_status,
    v_plan_source_hash,
    v_aspect_ratio,
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
    and v.organization_id = _organization_id
  for update of v;

  if v_plan_status is null then
    raise exception 'scene plan not found';
  end if;

  if v_plan_status <> 'APPROVED' then
    raise exception 'final assembly requires an approved scene plan';
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

  if v_aspect_ratio not in ('16:9', '9:16') then
    raise exception 'scene plan aspect ratio is unsupported for final assembly';
  end if;

  v_hash_input := v_hash_input
    || convert_to('final-assembly-v1', 'UTF8') || decode('00', 'hex')
    || convert_to(_organization_id::text, 'UTF8') || decode('00', 'hex')
    || convert_to(_plan_version_id::text, 'UTF8') || decode('00', 'hex')
    || convert_to(v_plan_source_hash, 'UTF8') || decode('00', 'hex')
    || convert_to(v_aspect_ratio, 'UTF8') || decode('00', 'hex')
    || convert_to(_profile, 'UTF8') || decode('00', 'hex');

  for v_component in
    select
      s.id as scene_id,
      s.ordinal as scene_ordinal,
      sh.id as shot_id,
      sh.ordinal as shot_ordinal,
      latest.media_asset_id,
      m.storage_bucket,
      m.storage_path,
      m.checksum,
      m.duration_seconds as media_duration_seconds
    from public.scene_plan_scenes s
    join public.scene_plan_shots sh
      on sh.scene_id = s.id
     and sh.organization_id = s.organization_id
    left join lateral (
      select a.media_asset_id
      from public.video_generation_attempts a
      where a.organization_id = _organization_id
        and a.plan_version_id = _plan_version_id
        and a.scene_id = s.id
        and a.shot_id = sh.id
        and a.state = 'COMPLETED'
        and a.media_asset_id is not null
      order by a.attempt_number desc
      limit 1
    ) latest on true
    left join public.media_assets m
      on m.id = latest.media_asset_id
     and m.organization_id = _organization_id
     and m.asset_type = 'VIDEO'
     and m.status = 'ACTIVE'
    where s.organization_id = _organization_id
      and s.scene_plan_version_id = _plan_version_id
    order by s.ordinal, sh.ordinal
  loop
    v_component_count := v_component_count + 1;

    if v_component.media_asset_id is null
       or v_component.storage_bucket is null
       or v_component.storage_path is null
       or v_component.checksum is null
       or v_component.checksum !~ '^sha256:[0-9a-f]{64}$'
       or v_component.media_duration_seconds is null
       or v_component.media_duration_seconds <= 0 then
      raise exception 'required shot media is missing or inactive';
    end if;

    v_duration_millis := round(v_component.media_duration_seconds * 1000)::bigint;

    v_hash_input := v_hash_input
      || convert_to(v_component.scene_id::text, 'UTF8') || decode('00', 'hex')
      || convert_to(v_component.shot_id::text, 'UTF8') || decode('00', 'hex')
      || convert_to(v_component.media_asset_id::text, 'UTF8') || decode('00', 'hex')
      || convert_to(v_component.checksum, 'UTF8') || decode('00', 'hex')
      || convert_to(v_duration_millis::text, 'UTF8') || decode('00', 'hex');

    v_expected_duration := v_expected_duration + v_component.media_duration_seconds;

    v_components := v_components || jsonb_build_array(
      jsonb_build_object(
        'ordinal', v_component_count,
        'sceneId', v_component.scene_id,
        'shotId', v_component.shot_id,
        'mediaAssetId', v_component.media_asset_id,
        'mediaChecksum', v_component.checksum,
        'durationSeconds', v_component.media_duration_seconds,
        'storageBucket', v_component.storage_bucket,
        'storagePath', v_component.storage_path
      )
    );
  end loop;

  if v_component_count = 0 then
    raise exception 'scene plan has no shots';
  end if;

  v_readiness_hash := 'sha256:' || encode(digest(v_hash_input, 'sha256'), 'hex');
  v_idempotency_key := 'final-video:' || _plan_version_id::text || ':' || v_readiness_hash || ':' || _profile;

  select a.id, a.job_id, a.final_media_asset_id, a.state
    into v_existing_assembly_id, v_existing_job_id, v_existing_media_asset_id, v_existing_state
  from public.video_assemblies a
  where a.organization_id = _organization_id
    and a.plan_version_id = _plan_version_id
    and a.readiness_hash = v_readiness_hash
    and a.render_profile = _profile
  limit 1;

  if v_existing_assembly_id is not null then
    return jsonb_strip_nulls(jsonb_build_object(
      'assemblyId', v_existing_assembly_id,
      'jobId', v_existing_job_id,
      'reused', true,
      'mediaAssetId', v_existing_media_asset_id,
      'state', v_existing_state
    ));
  end if;

  if exists (
    select 1
    from public.video_assemblies a
    where a.organization_id = _organization_id
      and a.plan_version_id = _plan_version_id
      and a.state in ('QUEUED', 'PROCESSING')
  ) then
    raise exception 'final assembly already running';
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
    'FINAL_VIDEO_ASSEMBLY',
    'SCENE_PLAN_VERSION',
    _plan_version_id,
    'QUEUED',
    0,
    3,
    jsonb_build_object(
      'strategy', 'BOUNDED',
      'delaysSeconds', jsonb_build_array(15, 60)
    ),
    jsonb_build_object(
      'schemaVersion', 'final-video-assembly-v1',
      'organizationId', _organization_id,
      'planVersionId', _plan_version_id,
      'sourceIntegrityHash', v_plan_source_hash,
      'readinessHash', v_readiness_hash,
      'renderProfile', _profile,
      'aspectRatio', v_aspect_ratio,
      'componentCount', v_component_count,
      'expectedDurationSeconds', v_expected_duration
    ),
    v_idempotency_key
  )
  returning id into v_job_id;

  insert into public.video_assemblies (
    organization_id,
    plan_version_id,
    job_id,
    state,
    render_profile,
    readiness_hash,
    source_integrity_hash,
    aspect_ratio,
    component_count,
    expected_duration_seconds,
    created_by
  ) values (
    _organization_id,
    _plan_version_id,
    v_job_id,
    'QUEUED',
    _profile,
    v_readiness_hash,
    v_plan_source_hash,
    v_aspect_ratio,
    v_component_count,
    v_expected_duration,
    v_actor_user_id
  )
  returning id into v_assembly_id;

  insert into public.video_assembly_components (
    organization_id,
    assembly_id,
    ordinal,
    scene_id,
    shot_id,
    media_asset_id,
    media_checksum,
    duration_seconds,
    storage_bucket,
    storage_path
  )
  select
    _organization_id,
    v_assembly_id,
    (component ->> 'ordinal')::integer,
    (component ->> 'sceneId')::uuid,
    (component ->> 'shotId')::uuid,
    (component ->> 'mediaAssetId')::uuid,
    component ->> 'mediaChecksum',
    (component ->> 'durationSeconds')::numeric,
    component ->> 'storageBucket',
    component ->> 'storagePath'
  from jsonb_array_elements(v_components) component
  order by (component ->> 'ordinal')::integer;

  return jsonb_build_object(
    'assemblyId', v_assembly_id,
    'jobId', v_job_id,
    'reused', false
  );
end;
$$;

revoke all on function public.enqueue_final_video_assembly(uuid, uuid, text) from public;
revoke all on function public.enqueue_final_video_assembly(uuid, uuid, text) from anon;
revoke all on function public.enqueue_final_video_assembly(uuid, uuid, text) from authenticated;
grant execute on function public.enqueue_final_video_assembly(uuid, uuid, text) to authenticated;
