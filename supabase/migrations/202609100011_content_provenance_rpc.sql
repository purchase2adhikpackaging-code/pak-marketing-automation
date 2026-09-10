create or replace function public.persist_content_knowledge_snapshots(
  _organization_id uuid,
  _content_item_id uuid,
  _snapshots jsonb
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

  if _snapshots is null or jsonb_typeof(_snapshots) <> 'array' then
    raise exception 'snapshots must be a JSON array';
  end if;

  if jsonb_array_length(_snapshots) > 20 then
    raise exception 'too many knowledge snapshots';
  end if;

  for snapshot in select value from jsonb_array_elements(_snapshots)
  loop
    if jsonb_typeof(snapshot) <> 'object' then
      raise exception 'invalid knowledge snapshot';
    end if;

    select *
      into source
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
      source.id,
      source.revision,
      source.title,
      source.content,
      source.source_type,
      source.source_label,
      source.source_reference
    )
    on conflict (content_item_id, knowledge_record_id) do nothing;
  end loop;
end;
$$;

revoke all on function public.persist_content_knowledge_snapshots(uuid,uuid,jsonb) from public;
revoke all on function public.persist_content_knowledge_snapshots(uuid,uuid,jsonb) from anon;
revoke all on function public.persist_content_knowledge_snapshots(uuid,uuid,jsonb) from authenticated;
grant execute on function public.persist_content_knowledge_snapshots(uuid,uuid,jsonb) to authenticated;
