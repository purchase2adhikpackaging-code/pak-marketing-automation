create table if not exists public.knowledge_documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  source_type text not null check (source_type in ('FILE','URL')),
  format text not null check (format in ('PDF','DOCX','PPTX','TXT','URL')),
  media_asset_id uuid references public.media_assets(id) on delete restrict,
  source_url text check (source_url is null or char_length(source_url) <= 2000),
  source_label text check (source_label is null or char_length(source_label) <= 300),
  source_fingerprint text check (source_fingerprint is null or char_length(source_fingerprint) <= 256),
  extraction_status text not null default 'PENDING'
    check (extraction_status in ('PENDING','PROCESSING','EXTRACTED','FAILED')),
  extracted_text text check (extracted_text is null or char_length(extracted_text) <= 50000),
  extraction_metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(extraction_metadata) = 'object'),
  error_summary text check (error_summary is null or char_length(error_summary) <= 1000),
  revision integer not null default 1 check (revision >= 1),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (source_type = 'FILE' and media_asset_id is not null and source_url is null and format <> 'URL')
    or
    (source_type = 'URL' and media_asset_id is null and source_url is not null and format = 'URL')
  )
);

create index if not exists knowledge_documents_org_status_updated_idx
  on public.knowledge_documents (organization_id, extraction_status, updated_at desc);
create index if not exists knowledge_documents_media_asset_idx
  on public.knowledge_documents (media_asset_id)
  where media_asset_id is not null;

alter table public.knowledge_records
  add column if not exists knowledge_document_id uuid
  references public.knowledge_documents(id) on delete set null;

create index if not exists knowledge_records_document_idx
  on public.knowledge_records (knowledge_document_id)
  where knowledge_document_id is not null;

create or replace function public.enforce_knowledge_document_source_integrity()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  m public.media_assets%rowtype;
begin
  if new.source_type = 'FILE' then
    if new.media_asset_id is null or new.source_url is not null or new.format = 'URL' then
      raise exception 'invalid file knowledge source identity';
    end if;

    select * into m
    from public.media_assets
    where id = new.media_asset_id;

    if m.id is null then
      raise exception 'knowledge source media asset does not exist';
    end if;
    if m.organization_id <> new.organization_id then
      raise exception 'knowledge source media organization mismatch';
    end if;
    if m.asset_type <> 'DOCUMENT' then
      raise exception 'knowledge source media must be a document';
    end if;
    if m.status <> 'ACTIVE' then
      raise exception 'knowledge source media must be active';
    end if;
  elsif new.source_type = 'URL' then
    if new.media_asset_id is not null or new.source_url is null or new.format <> 'URL' then
      raise exception 'invalid URL knowledge source identity';
    end if;
  else
    raise exception 'invalid knowledge source type';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_knowledge_document_source_integrity() from public;
revoke all on function public.enforce_knowledge_document_source_integrity() from anon;
revoke all on function public.enforce_knowledge_document_source_integrity() from authenticated;

drop trigger if exists knowledge_document_source_integrity_guard on public.knowledge_documents;
create trigger knowledge_document_source_integrity_guard
before insert or update of source_type, format, media_asset_id, source_url, organization_id
on public.knowledge_documents
for each row execute function public.enforce_knowledge_document_source_integrity();

create or replace function public.enforce_knowledge_document_source_identity()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.organization_id is distinct from old.organization_id
     or new.source_type is distinct from old.source_type
     or new.format is distinct from old.format
     or new.media_asset_id is distinct from old.media_asset_id
     or new.source_url is distinct from old.source_url then
    raise exception 'knowledge document source identity is immutable';
  end if;
  return new;
end;
$$;

revoke all on function public.enforce_knowledge_document_source_identity() from public;
revoke all on function public.enforce_knowledge_document_source_identity() from anon;
revoke all on function public.enforce_knowledge_document_source_identity() from authenticated;

drop trigger if exists knowledge_document_source_identity_guard on public.knowledge_documents;
create trigger knowledge_document_source_identity_guard
before update of organization_id, source_type, format, media_asset_id, source_url
on public.knowledge_documents
for each row execute function public.enforce_knowledge_document_source_identity();

create or replace function public.enforce_knowledge_document_revision()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.revision <> old.revision + 1 then
    raise exception 'knowledge document revision must increment exactly once';
  end if;
  if new.created_by is distinct from old.created_by
     or new.created_at is distinct from old.created_at then
    raise exception 'knowledge document creation audit fields are immutable';
  end if;
  if auth.uid() is not null then
    new.updated_by := auth.uid();
    new.updated_at := now();
  end if;
  return new;
end;
$$;

revoke all on function public.enforce_knowledge_document_revision() from public;
revoke all on function public.enforce_knowledge_document_revision() from anon;
revoke all on function public.enforce_knowledge_document_revision() from authenticated;

drop trigger if exists knowledge_document_revision_guard on public.knowledge_documents;
create trigger knowledge_document_revision_guard
before update on public.knowledge_documents
for each row execute function public.enforce_knowledge_document_revision();

create or replace function public.enforce_knowledge_document_link_integrity()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  d public.knowledge_documents%rowtype;
begin
  if new.knowledge_document_id is null then
    return new;
  end if;

  select * into d
  from public.knowledge_documents
  where id = new.knowledge_document_id;

  if d.id is null then
    raise exception 'knowledge document does not exist';
  end if;
  if d.organization_id <> new.organization_id then
    raise exception 'knowledge document organization mismatch';
  end if;
  if new.status <> 'DRAFT' then
    raise exception 'document ingestion may link only DRAFT Knowledge';
  end if;
  if (d.source_type = 'FILE' and new.source_type <> 'DOCUMENT')
     or (d.source_type = 'URL' and new.source_type <> 'URL') then
    raise exception 'knowledge source type does not match document source';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_knowledge_document_link_integrity() from public;
revoke all on function public.enforce_knowledge_document_link_integrity() from anon;
revoke all on function public.enforce_knowledge_document_link_integrity() from authenticated;

drop trigger if exists knowledge_document_link_integrity_guard on public.knowledge_records;
create trigger knowledge_document_link_integrity_guard
before insert or update of knowledge_document_id
on public.knowledge_records
for each row execute function public.enforce_knowledge_document_link_integrity();

alter table public.knowledge_documents enable row level security;

revoke all privileges on table public.knowledge_documents from anon;
revoke all privileges on table public.knowledge_documents from authenticated;
grant select, insert, update on table public.knowledge_documents to authenticated;

drop policy if exists knowledge_documents_select_manager on public.knowledge_documents;
create policy knowledge_documents_select_manager
on public.knowledge_documents
for select
to authenticated
using (
  public.is_org_member(organization_id)
  and public.has_org_role(organization_id, array['OWNER','ADMIN','EDITOR'])
);

drop policy if exists knowledge_documents_insert_manager on public.knowledge_documents;
create policy knowledge_documents_insert_manager
on public.knowledge_documents
for insert
to authenticated
with check (
  public.has_org_role(organization_id, array['OWNER','ADMIN','EDITOR'])
  and revision = 1
  and extraction_status = 'PENDING'
  and created_by = auth.uid()
  and updated_by = auth.uid()
);

drop policy if exists knowledge_documents_update_manager on public.knowledge_documents;
create policy knowledge_documents_update_manager
on public.knowledge_documents
for update
to authenticated
using (public.has_org_role(organization_id, array['OWNER','ADMIN','EDITOR']))
with check (public.has_org_role(organization_id, array['OWNER','ADMIN','EDITOR']));