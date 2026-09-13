create table if not exists public.content_item_identity_provenance (
  content_item_id uuid primary key references public.content_items(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  profile_revision integer not null check (profile_revision >= 1),
  brand_kit_revision integer not null check (brand_kit_revision >= 1),
  created_at timestamptz not null default now()
);

create index if not exists content_item_identity_provenance_org_idx
  on public.content_item_identity_provenance (organization_id, created_at desc);

create or replace function public.enforce_content_identity_provenance_integrity()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  parent_org_id uuid;
  current_profile_revision integer;
  current_brand_revision integer;
begin
  select organization_id into parent_org_id
  from public.content_items
  where id = new.content_item_id;

  if parent_org_id is null then
    raise exception 'content item does not exist';
  end if;
  if parent_org_id <> new.organization_id then
    raise exception 'identity provenance organization must match parent content item organization';
  end if;

  select revision into current_profile_revision
  from public.organization_profiles
  where organization_id = new.organization_id;
  if current_profile_revision is null or current_profile_revision <> new.profile_revision then
    raise exception 'organization profile revision does not match resolved provenance';
  end if;

  select revision into current_brand_revision
  from public.organization_brand_kits
  where organization_id = new.organization_id;
  if current_brand_revision is null or current_brand_revision <> new.brand_kit_revision then
    raise exception 'brand kit revision does not match resolved provenance';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_content_identity_provenance_integrity() from public;
revoke all on function public.enforce_content_identity_provenance_integrity() from anon;
revoke all on function public.enforce_content_identity_provenance_integrity() from authenticated;

drop trigger if exists content_item_identity_provenance_integrity_guard
  on public.content_item_identity_provenance;
create trigger content_item_identity_provenance_integrity_guard
before insert on public.content_item_identity_provenance
for each row execute function public.enforce_content_identity_provenance_integrity();

create or replace function public.prevent_content_identity_provenance_update()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  raise exception 'content identity provenance is immutable';
end;
$$;

revoke all on function public.prevent_content_identity_provenance_update() from public;
revoke all on function public.prevent_content_identity_provenance_update() from anon;
revoke all on function public.prevent_content_identity_provenance_update() from authenticated;

drop trigger if exists content_item_identity_provenance_immutable_guard
  on public.content_item_identity_provenance;
create trigger content_item_identity_provenance_immutable_guard
before update on public.content_item_identity_provenance
for each row execute function public.prevent_content_identity_provenance_update();

alter table public.content_item_identity_provenance enable row level security;

drop policy if exists content_item_identity_provenance_select_member
  on public.content_item_identity_provenance;
create policy content_item_identity_provenance_select_member
on public.content_item_identity_provenance
for select
to authenticated
using (public.is_org_member(organization_id));

-- Identity and Knowledge provenance are persisted in one PostgreSQL function so
-- all inserts share one transaction. Ordinary authenticated users receive no
-- direct INSERT/UPDATE/DELETE policy on either provenance table.
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
  if jsonb_array_length(_knowledge_snapshots) > 20 then
    raise exception 'too many knowledge snapshots';
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
