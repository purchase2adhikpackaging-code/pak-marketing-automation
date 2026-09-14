create or replace function public.persist_content_generation_provenance(
  _organization_id uuid,
  _content_item_id uuid,
  _profile_revision integer,
  _brand_kit_revision integer,
  _knowledge_snapshots jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := auth.uid();
  item_owner uuid;
  item_status text;
  current_profile_revision integer;
  current_brand_revision integer;
  stored_profile_revision integer;
  stored_brand_revision integer;
  non_core_snapshot_count integer := 0;
  snapshot jsonb;
  source public.knowledge_records%rowtype;
begin
  if actor_id is null then
    raise exception 'authentication required';
  end if;

  if not public.has_org_role(_organization_id, array['OWNER','ADMIN','EDITOR']) then
    raise exception 'actor is not authorized to persist content provenance';
  end if;

  select created_by, status
    into item_owner, item_status
  from public.content_items
  where id = _content_item_id
    and organization_id = _organization_id;

  if not found then
    raise exception 'content item not found';
  end if;
  if item_owner is distinct from actor_id then
    raise exception 'content item provenance may only be persisted by its creator';
  end if;
  if item_status <> 'GENERATED' then
    raise exception 'content item must be generated before provenance is persisted';
  end if;

  select revision into current_profile_revision
  from public.organization_profiles
  where organization_id = _organization_id;
  if current_profile_revision is null or current_profile_revision <> _profile_revision then
    raise exception 'organization profile revision does not match resolved provenance';
  end if;

  select revision into current_brand_revision
  from public.organization_brand_kits
  where organization_id = _organization_id;
  if current_brand_revision is null or current_brand_revision <> _brand_kit_revision then
    raise exception 'brand kit revision does not match resolved provenance';
  end if;

  if _knowledge_snapshots is null or jsonb_typeof(_knowledge_snapshots) <> 'array' then
    raise exception 'knowledge snapshots must be a JSON array';
  end if;

  for snapshot in select value from jsonb_array_elements(_knowledge_snapshots)
  loop
    if jsonb_typeof(snapshot) <> 'object' then
      raise exception 'invalid knowledge snapshot';
    end if;

    select * into source
    from public.knowledge_records
    where id = (snapshot ->> 'knowledge_record_id')::uuid
      and organization_id = _organization_id
      and status = 'ACTIVE';

    if not found then
      raise exception 'knowledge record unavailable';
    end if;

    if source.revision <> (snapshot ->> 'knowledge_revision')::integer
      or source.title is distinct from snapshot ->> 'title_snapshot'
      or source.content is distinct from snapshot ->> 'content_snapshot'
      or source.source_type is distinct from snapshot ->> 'source_type_snapshot'
      or source.source_label is distinct from nullif(snapshot ->> 'source_label_snapshot', '')
      or source.source_reference is distinct from nullif(snapshot ->> 'source_reference_snapshot', '') then
      raise exception 'knowledge snapshot does not match resolved source revision';
    end if;

    if not source.is_core then
      non_core_snapshot_count := non_core_snapshot_count + 1;
      if non_core_snapshot_count > 20 then
        raise exception 'too many selected knowledge snapshots';
      end if;
    end if;
  end loop;

  insert into public.content_item_identity_provenance (
    content_item_id,
    organization_id,
    profile_revision,
    brand_kit_revision
  ) values (
    _content_item_id,
    _organization_id,
    _profile_revision,
    _brand_kit_revision
  )
  on conflict (content_item_id) do nothing;

  select profile_revision, brand_kit_revision
    into stored_profile_revision, stored_brand_revision
  from public.content_item_identity_provenance
  where content_item_id = _content_item_id
    and organization_id = _organization_id;

  if stored_profile_revision is distinct from _profile_revision
    or stored_brand_revision is distinct from _brand_kit_revision then
    raise exception 'content identity provenance conflicts with an existing immutable snapshot';
  end if;

  for snapshot in select value from jsonb_array_elements(_knowledge_snapshots)
  loop
    insert into public.content_item_knowledge_sources (
      organization_id,
      content_item_id,
      knowledge_record_id,
      knowledge_revision,
      title_snapshot,
      content_snapshot,
      source_type_snapshot,
      source_label_snapshot,
      source_reference_snapshot
    ) values (
      _organization_id,
      _content_item_id,
      (snapshot ->> 'knowledge_record_id')::uuid,
      (snapshot ->> 'knowledge_revision')::integer,
      snapshot ->> 'title_snapshot',
      snapshot ->> 'content_snapshot',
      snapshot ->> 'source_type_snapshot',
      nullif(snapshot ->> 'source_label_snapshot', ''),
      nullif(snapshot ->> 'source_reference_snapshot', '')
    )
    on conflict (content_item_id, knowledge_record_id) do nothing;
  end loop;
end;
$$;

revoke all on function public.persist_content_generation_provenance(uuid,uuid,integer,integer,jsonb) from public;
revoke all on function public.persist_content_generation_provenance(uuid,uuid,integer,integer,jsonb) from anon;
revoke all on function public.persist_content_generation_provenance(uuid,uuid,integer,integer,jsonb) from authenticated;
grant execute on function public.persist_content_generation_provenance(uuid,uuid,integer,integer,jsonb) to authenticated;
