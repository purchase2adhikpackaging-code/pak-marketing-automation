drop function if exists public.is_knowledge_record_fk_audit_nullification(public.knowledge_records, public.knowledge_records);

create or replace function public.enforce_knowledge_record_audit_integrity()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if pg_trigger_depth() > 1
    and new.revision = old.revision
    and new.organization_id is not distinct from old.organization_id
    and new.title is not distinct from old.title
    and new.content is not distinct from old.content
    and new.status is not distinct from old.status
    and new.source_type is not distinct from old.source_type
    and new.source_label is not distinct from old.source_label
    and new.source_reference is not distinct from old.source_reference
    and new.created_at is not distinct from old.created_at
    and new.updated_at is not distinct from old.updated_at
    and (new.created_by is null or new.created_by is not distinct from old.created_by)
    and (new.updated_by is null or new.updated_by is not distinct from old.updated_by)
    and (new.created_by is distinct from old.created_by or new.updated_by is distinct from old.updated_by) then
    return new;
  end if;

  if auth.uid() is not null then
    if new.created_by is distinct from old.created_by
      or new.created_at is distinct from old.created_at then
      raise exception 'knowledge record creation audit fields are immutable';
    end if;

    new.updated_by := auth.uid();
    new.updated_at := now();
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_knowledge_record_audit_integrity() from public;
revoke all on function public.enforce_knowledge_record_audit_integrity() from anon;
revoke all on function public.enforce_knowledge_record_audit_integrity() from authenticated;

create or replace function public.enforce_knowledge_record_revision_increment()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if pg_trigger_depth() > 1
    and new.revision = old.revision
    and new.organization_id is not distinct from old.organization_id
    and new.title is not distinct from old.title
    and new.content is not distinct from old.content
    and new.status is not distinct from old.status
    and new.source_type is not distinct from old.source_type
    and new.source_label is not distinct from old.source_label
    and new.source_reference is not distinct from old.source_reference
    and new.created_at is not distinct from old.created_at
    and new.updated_at is not distinct from old.updated_at
    and (new.created_by is null or new.created_by is not distinct from old.created_by)
    and (new.updated_by is null or new.updated_by is not distinct from old.updated_by)
    and (new.created_by is distinct from old.created_by or new.updated_by is distinct from old.updated_by) then
    return new;
  end if;

  if new.revision <> old.revision + 1 then
    raise exception 'knowledge record revision must increment exactly once';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_knowledge_record_revision_increment() from public;
revoke all on function public.enforce_knowledge_record_revision_increment() from anon;
revoke all on function public.enforce_knowledge_record_revision_increment() from authenticated;
