-- Phase 9 live-runtime hardening: pgcrypto is installed in Supabase's
-- `extensions` schema. Keep the SECURITY DEFINER search path pinned to public
-- and schema-qualify digest rather than widening search_path.

create or replace function public.submit_approval_request(
  _organization_id uuid,
  _target_type text,
  _target_id uuid,
  _publication_intent jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_target_type text := upper(coalesce(_target_type, ''));
  v_snapshot jsonb;
  v_revision integer;
  v_checksum text;
  v_fingerprint text;
  v_request_id uuid;
  v_created boolean := false;
begin
  if v_actor is null then
    raise exception 'authentication required';
  end if;

  if _organization_id is null or _target_id is null then
    raise exception 'organization and target are required';
  end if;

  if not public.has_org_role(_organization_id, array['OWNER','ADMIN','EDITOR']) then
    raise exception 'approval submission permission required';
  end if;

  if v_target_type not in ('CONTENT_ARTIFACT','MEDIA_ASSET') then
    raise exception 'unsupported approval target type';
  end if;

  if _publication_intent is null
     or jsonb_typeof(_publication_intent) <> 'object'
     or octet_length(_publication_intent::text) > 8192 then
    raise exception 'invalid publication intent';
  end if;

  if v_target_type = 'CONTENT_ARTIFACT' then
    select
      a.revision,
      jsonb_build_object(
        'targetType', 'CONTENT_ARTIFACT',
        'artifactId', a.id,
        'contentItemId', a.content_item_id,
        'language', a.language,
        'isSource', a.is_source,
        'status', a.status,
        'revision', a.revision,
        'sourceRevision', a.source_revision,
        'scriptText', a.script_text,
        'provider', a.provider,
        'providerModel', a.provider_model,
        'generatedAt', a.generated_at,
        'topic', c.topic,
        'knowledgeContext', c.knowledge_context
      )
    into v_revision, v_snapshot
    from public.content_script_artifacts a
    join public.content_items c on c.id = a.content_item_id
    where a.id = _target_id
      and a.organization_id = _organization_id
      and c.organization_id = _organization_id
      and a.status = 'GENERATED'
      and nullif(btrim(a.script_text), '') is not null;

    if v_revision is null then
      raise exception 'eligible content artifact not found';
    end if;

    v_fingerprint := 'sha256:' || encode(
      extensions.digest(
        convert_to(
          concat_ws('|', _organization_id::text, v_target_type, _target_id::text, v_revision::text),
          'UTF8'
        ),
        'sha256'
      ),
      'hex'
    );
  else
    select
      m.checksum,
      jsonb_build_object(
        'targetType', 'MEDIA_ASSET',
        'mediaAssetId', m.id,
        'assetType', m.asset_type,
        'displayName', m.display_name,
        'source', m.source,
        'mimeType', m.mime_type,
        'width', m.width,
        'height', m.height,
        'durationSeconds', m.duration_seconds,
        'sizeBytes', m.size_bytes,
        'checksum', m.checksum,
        'sceneId', m.scene_id,
        'generatingJobId', m.generating_job_id,
        'storageBucket', m.storage_bucket,
        'storagePath', m.storage_path,
        'metadata', m.metadata,
        'createdAt', m.created_at
      )
    into v_checksum, v_snapshot
    from public.media_assets m
    where m.id = _target_id
      and m.organization_id = _organization_id
      and m.status = 'ACTIVE'
      and nullif(btrim(m.checksum), '') is not null;

    if v_checksum is null then
      raise exception 'eligible media asset not found';
    end if;

    v_fingerprint := 'sha256:' || encode(
      extensions.digest(
        convert_to(
          concat_ws('|', _organization_id::text, v_target_type, _target_id::text, v_checksum),
          'UTF8'
        ),
        'sha256'
      ),
      'hex'
    );
  end if;

  insert into public.approval_requests (
    organization_id,
    target_type,
    target_id,
    target_revision,
    target_checksum,
    target_fingerprint,
    target_snapshot,
    publication_intent,
    status,
    requested_by
  ) values (
    _organization_id,
    v_target_type,
    _target_id,
    v_revision,
    v_checksum,
    v_fingerprint,
    v_snapshot,
    _publication_intent,
    'PENDING',
    v_actor
  )
  on conflict (organization_id, target_type, target_fingerprint) do nothing
  returning id into v_request_id;

  if v_request_id is not null then
    v_created := true;
  else
    select r.id into v_request_id
    from public.approval_requests r
    where r.organization_id = _organization_id
      and r.target_type = v_target_type
      and r.target_fingerprint = v_fingerprint;
  end if;

  if v_created then
    insert into public.approval_events (
      organization_id,
      approval_request_id,
      actor_kind,
      actor_user_id,
      event_type,
      target_revision,
      target_checksum
    ) values (
      _organization_id,
      v_request_id,
      'USER',
      v_actor,
      'SUBMITTED',
      v_revision,
      v_checksum
    );
  end if;

  return v_request_id;
end;
$$;

revoke all on function public.submit_approval_request(uuid, text, uuid, jsonb) from public;
revoke all on function public.submit_approval_request(uuid, text, uuid, jsonb) from anon;
revoke all on function public.submit_approval_request(uuid, text, uuid, jsonb) from authenticated;
grant execute on function public.submit_approval_request(uuid, text, uuid, jsonb) to authenticated;
