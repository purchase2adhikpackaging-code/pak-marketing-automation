create or replace function public.is_knowledge_record_fk_audit_nullification(old_row public.knowledge_records, new_row public.knowledge_records)
returns boolean
language sql
stable
set search_path = public
as $$
  select pg_trigger_depth() > 1
    and new_row.revision = old_row.revision
    and new_row.organization_id is not distinct from old_row.organization_id
    and new_row.title is not distinct from old_row.title
    and new_row.content is not distinct from old_row.content
    and new_row.status is not distinct from old_row.status
    and new_row.source_type is not distinct from old_row.source_type
    and new_row.source_label is not distinct from old_row.source_label
    and new_row.source_reference is not distinct from old_row.source_reference
    and new_row.created_at is not distinct from old_row.created_at
    and new_row.updated_at is not distinct from old_row.updated_at
    and (new_row.created_by is null or new_row.created_by is not distinct from old_row.created_by)
    and (new_row.updated_by is null or new_row.updated_by is not distinct from old_row.updated_by)
    and (new_row.created_by is distinct from old_row.created_by or new_row.updated_by is distinct from old_row.updated_by);
$$;

revoke all on function public.is_knowledge_record_fk_audit_nullification(public.knowledge_records, public.knowledge_records) from public;
revoke all on function public.is_knowledge_record_fk_audit_nullification(public.knowledge_records, public.knowledge_records) from anon;
revoke all on function public.is_knowledge_record_fk_audit_nullification(public.knowledge_records, public.knowledge_records) from authenticated;

create or replace function public.enforce_knowledge_record_audit_integrity()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if public.is_knowledge_record_fk_audit_nullification(old, new) then
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
  if public.is_knowledge_record_fk_audit_nullification(old, new) then
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
