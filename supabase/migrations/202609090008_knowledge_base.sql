create table if not exists public.knowledge_records (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 3 and 200),
  content text not null check (char_length(btrim(content)) between 1 and 50000),
  status text not null default 'DRAFT' check (status in ('DRAFT','ACTIVE','ARCHIVED')),
  source_type text not null check (source_type in ('MANUAL','DOCUMENT','URL')),
  source_label text check (source_label is null or char_length(btrim(source_label)) <= 300),
  source_reference text check (source_reference is null or char_length(btrim(source_reference)) <= 2000),
  revision integer not null default 1 check (revision >= 1),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists knowledge_records_org_status_updated_idx
  on public.knowledge_records (organization_id, status, updated_at desc);

create table if not exists public.content_item_knowledge_sources (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  content_item_id uuid not null references public.content_items(id) on delete cascade,
  knowledge_record_id uuid references public.knowledge_records(id) on delete set null,
  knowledge_revision integer not null check (knowledge_revision >= 1),
  title_snapshot text not null,
  content_snapshot text not null,
  source_type_snapshot text not null check (source_type_snapshot in ('MANUAL','DOCUMENT','URL')),
  source_label_snapshot text,
  source_reference_snapshot text,
  created_at timestamptz not null default now(),
  unique (content_item_id, knowledge_record_id)
);

create index if not exists content_item_knowledge_sources_org_content_idx
  on public.content_item_knowledge_sources (organization_id, content_item_id);

create or replace function public.enforce_knowledge_record_revision_increment()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.revision <> old.revision + 1 then
    raise exception 'knowledge record revision must increment exactly once';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_knowledge_record_revision_increment() from public;

drop trigger if exists knowledge_record_revision_guard on public.knowledge_records;
create trigger knowledge_record_revision_guard
before update on public.knowledge_records
for each row
execute function public.enforce_knowledge_record_revision_increment();

create or replace function public.enforce_content_item_knowledge_source_integrity()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  parent_org_id uuid;
  source_org_id uuid;
begin
  select organization_id
    into parent_org_id
  from public.content_items
  where id = new.content_item_id;

  if parent_org_id is null then
    raise exception 'content item % does not exist', new.content_item_id;
  end if;

  if parent_org_id <> new.organization_id then
    raise exception 'knowledge snapshot organization must match parent content item organization';
  end if;

  if new.knowledge_record_id is not null then
    select organization_id
      into source_org_id
    from public.knowledge_records
    where id = new.knowledge_record_id;

    if source_org_id is null then
      raise exception 'knowledge record % does not exist', new.knowledge_record_id;
    end if;

    if source_org_id <> new.organization_id then
      raise exception 'knowledge record organization must match snapshot organization';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_content_item_knowledge_source_integrity() from public;

drop trigger if exists content_item_knowledge_source_integrity_guard
  on public.content_item_knowledge_sources;
create trigger content_item_knowledge_source_integrity_guard
before insert or update of organization_id, content_item_id, knowledge_record_id
on public.content_item_knowledge_sources
for each row
execute function public.enforce_content_item_knowledge_source_integrity();

alter table public.knowledge_records enable row level security;
alter table public.content_item_knowledge_sources enable row level security;

drop policy if exists knowledge_records_select_visible on public.knowledge_records;
create policy knowledge_records_select_visible
on public.knowledge_records
for select
to authenticated
using (
  public.is_org_member(organization_id)
  and (
    status = 'ACTIVE'
    or public.has_org_role(organization_id, array['OWNER','ADMIN','EDITOR'])
  )
);

drop policy if exists knowledge_records_insert_editor on public.knowledge_records;
create policy knowledge_records_insert_editor
on public.knowledge_records
for insert
to authenticated
with check (
  public.has_org_role(organization_id, array['OWNER','ADMIN','EDITOR'])
  and (created_by is null or created_by = auth.uid())
  and (updated_by is null or updated_by = auth.uid())
);

drop policy if exists knowledge_records_update_editor on public.knowledge_records;
create policy knowledge_records_update_editor
on public.knowledge_records
for update
to authenticated
using (public.has_org_role(organization_id, array['OWNER','ADMIN','EDITOR']))
with check (
  public.has_org_role(organization_id, array['OWNER','ADMIN','EDITOR'])
  and (updated_by is null or updated_by = auth.uid())
);

drop policy if exists knowledge_records_delete_admin on public.knowledge_records;
create policy knowledge_records_delete_admin
on public.knowledge_records
for delete
to authenticated
using (public.has_org_role(organization_id, array['OWNER','ADMIN']));

drop policy if exists content_item_knowledge_sources_select_member
  on public.content_item_knowledge_sources;
create policy content_item_knowledge_sources_select_member
on public.content_item_knowledge_sources
for select
to authenticated
using (public.is_org_member(organization_id));

drop policy if exists content_item_knowledge_sources_insert_editor
  on public.content_item_knowledge_sources;
create policy content_item_knowledge_sources_insert_editor
on public.content_item_knowledge_sources
for insert
to authenticated
with check (public.has_org_role(organization_id, array['OWNER','ADMIN','EDITOR']));

-- Intentionally no UPDATE or DELETE policies for content_item_knowledge_sources.
-- Generation provenance is immutable for ordinary authenticated users.
