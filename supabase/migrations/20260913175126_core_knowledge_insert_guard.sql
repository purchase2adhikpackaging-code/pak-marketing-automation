create or replace function public.enforce_knowledge_core_admin()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if auth.uid() is null then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.is_core and not public.has_org_role(new.organization_id, array['OWNER','ADMIN']) then
      raise exception 'only organization owners or admins may create Core Knowledge';
    end if;
    return new;
  end if;

  if new.is_core is distinct from old.is_core
    and not public.has_org_role(old.organization_id, array['OWNER','ADMIN']) then
    raise exception 'only organization owners or admins may change Core Knowledge';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_knowledge_core_admin() from public;
revoke all on function public.enforce_knowledge_core_admin() from anon;
revoke all on function public.enforce_knowledge_core_admin() from authenticated;

drop trigger if exists knowledge_core_admin_insert_guard on public.knowledge_records;
create trigger knowledge_core_admin_insert_guard
before insert on public.knowledge_records
for each row execute function public.enforce_knowledge_core_admin();

drop trigger if exists knowledge_core_admin_guard on public.knowledge_records;
create trigger knowledge_core_admin_guard
before update of is_core on public.knowledge_records
for each row execute function public.enforce_knowledge_core_admin();
