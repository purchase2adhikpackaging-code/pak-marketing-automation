alter table public.knowledge_records
  add column if not exists knowledge_document_revision integer
  check (knowledge_document_revision is null or knowledge_document_revision >= 1);

alter table public.knowledge_records
  drop constraint if exists knowledge_records_document_revision_pair_check;
alter table public.knowledge_records
  add constraint knowledge_records_document_revision_pair_check
  check (
    (knowledge_document_id is null and knowledge_document_revision is null)
    or
    (knowledge_document_id is not null and knowledge_document_revision is not null)
  );

create or replace function public.enforce_knowledge_record_document_identity()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.knowledge_document_id is distinct from old.knowledge_document_id
     or new.knowledge_document_revision is distinct from old.knowledge_document_revision then
    raise exception 'knowledge document revision identity is immutable';
  end if;
  return new;
end;
$$;

revoke all on function public.enforce_knowledge_record_document_identity() from public;
revoke all on function public.enforce_knowledge_record_document_identity() from anon;
revoke all on function public.enforce_knowledge_record_document_identity() from authenticated;

drop trigger if exists knowledge_record_document_identity_guard on public.knowledge_records;
create trigger knowledge_record_document_identity_guard
before update of knowledge_document_id, knowledge_document_revision
on public.knowledge_records
for each row execute function public.enforce_knowledge_record_document_identity();

create or replace function public.finalize_knowledge_document_ingestion(
  p_document_id uuid,
  p_organization_id uuid,
  p_expected_revision integer,
  p_title text,
  p_content text,
  p_source_type text,
  p_source_reference text,
  p_source_fingerprint text,
  p_extraction_metadata jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := auth.uid();
  document_row public.knowledge_documents%rowtype;
  record_row public.knowledge_records%rowtype;
begin
  if actor_id is null then
    raise exception 'authentication required';
  end if;

  if not public.has_org_role(
    p_organization_id,
    array['OWNER','ADMIN','EDITOR']
  ) then
    raise exception 'insufficient knowledge ingestion role';
  end if;

  if p_expected_revision < 1 then
    raise exception 'invalid knowledge document revision';
  end if;

  if char_length(btrim(p_title)) < 3 or char_length(btrim(p_title)) > 200 then
    raise exception 'invalid knowledge title';
  end if;

  if char_length(btrim(p_content)) < 1 or char_length(btrim(p_content)) > 50000 then
    raise exception 'invalid extracted knowledge content';
  end if;

  if p_source_type not in ('DOCUMENT','URL') then
    raise exception 'invalid knowledge source type';
  end if;

  if p_source_reference is null or char_length(btrim(p_source_reference)) > 2000 then
    raise exception 'invalid knowledge source reference';
  end if;

  if p_source_fingerprint is null
     or p_source_fingerprint !~ '^[a-f0-9]{64}$' then
    raise exception 'invalid knowledge source fingerprint';
  end if;

  if p_extraction_metadata is null
     or jsonb_typeof(p_extraction_metadata) <> 'object' then
    raise exception 'invalid extraction metadata';
  end if;

  select *
    into document_row
  from public.knowledge_documents
  where id = p_document_id
    and organization_id = p_organization_id
    and extraction_status = 'PROCESSING'
    and revision = p_expected_revision
  for update;

  if document_row.id is null then
    raise exception 'knowledge document is not in the expected processing revision';
  end if;

  if (document_row.source_type = 'FILE' and p_source_type <> 'DOCUMENT')
     or (document_row.source_type = 'URL' and p_source_type <> 'URL') then
    raise exception 'knowledge source type does not match document source';
  end if;

  update public.knowledge_documents
  set extraction_status = 'EXTRACTED',
      extracted_text = btrim(p_content),
      source_fingerprint = p_source_fingerprint,
      extraction_metadata = p_extraction_metadata,
      error_summary = null,
      revision = p_expected_revision + 1
  where id = p_document_id
    and organization_id = p_organization_id
    and extraction_status = 'PROCESSING'
    and revision = p_expected_revision
  returning * into document_row;

  if document_row.id is null then
    raise exception 'knowledge document finalization conflict';
  end if;

  insert into public.knowledge_records (
    organization_id,
    title,
    content,
    status,
    source_type,
    source_label,
    source_reference,
    revision,
    created_by,
    updated_by,
    knowledge_document_id,
    knowledge_document_revision
  ) values (
    p_organization_id,
    btrim(p_title),
    btrim(p_content),
    'DRAFT',
    p_source_type,
    document_row.source_label,
    btrim(p_source_reference),
    1,
    actor_id,
    actor_id,
    p_document_id,
    p_expected_revision + 1
  )
  returning * into record_row;

  return jsonb_build_object(
    'document', to_jsonb(document_row),
    'record', to_jsonb(record_row)
  );
end;
$$;

revoke all on function public.finalize_knowledge_document_ingestion(
  uuid, uuid, integer, text, text, text, text, text, jsonb
) from public;
revoke all on function public.finalize_knowledge_document_ingestion(
  uuid, uuid, integer, text, text, text, text, text, jsonb
) from anon;
revoke all on function public.finalize_knowledge_document_ingestion(
  uuid, uuid, integer, text, text, text, text, text, jsonb
) from authenticated;
grant execute on function public.finalize_knowledge_document_ingestion(
  uuid, uuid, integer, text, text, text, text, text, jsonb
) to authenticated;
