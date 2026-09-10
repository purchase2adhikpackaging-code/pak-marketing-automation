create or replace function public.bootstrap_first_owner()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := auth.uid();
  org_id uuid;
begin
  if actor_id is null then
    raise exception 'authentication required';
  end if;

  -- Serialize first-run bootstrap so two concurrent signups cannot create
  -- competing tenant roots.
  perform pg_advisory_xact_lock(hashtext('pak:first-owner-bootstrap'));

  select id into org_id
  from public.organizations
  limit 1;

  if org_id is not null then
    if exists (
      select 1
      from public.organization_memberships
      where organization_id = org_id
        and user_id = actor_id
        and role = 'OWNER'
    ) then
      return org_id;
    end if;

    raise exception 'PAK bootstrap is already complete';
  end if;

  insert into public.organizations (name, slug)
  values ('Polska Akademia Kolejnictwa', 'pak')
  returning id into org_id;

  insert into public.organization_memberships (organization_id, user_id, role)
  values (org_id, actor_id, 'OWNER');

  return org_id;
end;
$$;

revoke all on function public.bootstrap_first_owner() from public;
revoke all on function public.bootstrap_first_owner() from anon;
grant execute on function public.bootstrap_first_owner() to authenticated;
