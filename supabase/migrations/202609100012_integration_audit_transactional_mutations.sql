create or replace function public.update_integration_connection_config(
  _organization_id uuid,
  _provider text,
  _actor_user_id uuid,
  _config jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  connection_id_value uuid;
begin
  if _provider not in ('OPENAI','META','LTX') then
    raise exception 'unsupported integration provider';
  end if;

  if _config is null or jsonb_typeof(_config) <> 'object' then
    raise exception 'config must be an object';
  end if;

  if not exists (
    select 1
    from public.organization_memberships m
    where m.organization_id = _organization_id
      and m.user_id = _actor_user_id
      and m.role in ('OWNER','ADMIN')
  ) then
    raise exception 'actor is not authorized to manage integration settings';
  end if;

  update public.integration_connections
  set config = _config,
      updated_by = _actor_user_id,
      updated_at = now()
  where organization_id = _organization_id
    and provider = _provider
  returning id into connection_id_value;

  if connection_id_value is null then
    return null;
  end if;

  insert into public.integration_audit_events (
    organization_id,
    connection_id,
    actor_user_id,
    event_type,
    metadata
  ) values (
    _organization_id,
    connection_id_value,
    _actor_user_id,
    'UPDATED',
    jsonb_build_object('fields', jsonb_build_array('config'))
  );

  return connection_id_value;
end;
$$;

revoke all on function public.update_integration_connection_config(uuid,text,uuid,jsonb) from public;
revoke all on function public.update_integration_connection_config(uuid,text,uuid,jsonb) from anon;
revoke all on function public.update_integration_connection_config(uuid,text,uuid,jsonb) from authenticated;
grant execute on function public.update_integration_connection_config(uuid,text,uuid,jsonb) to service_role;

create or replace function public.set_integration_connection_disabled(
  _organization_id uuid,
  _provider text,
  _actor_user_id uuid,
  _disabled boolean
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  connection_id_value uuid;
  secret_version_value integer;
  next_status text;
begin
  if _provider not in ('OPENAI','META','LTX') then
    raise exception 'unsupported integration provider';
  end if;

  if not exists (
    select 1
    from public.organization_memberships m
    where m.organization_id = _organization_id
      and m.user_id = _actor_user_id
      and m.role in ('OWNER','ADMIN')
  ) then
    raise exception 'actor is not authorized to manage integration settings';
  end if;

  select id, secret_version
    into connection_id_value, secret_version_value
  from public.integration_connections
  where organization_id = _organization_id
    and provider = _provider
  for update;

  if connection_id_value is null then
    return null;
  end if;

  next_status := case
    when _disabled then 'DISABLED'
    when coalesce(secret_version_value, 0) > 0 then 'CONFIGURED'
    else 'NOT_CONFIGURED'
  end;

  update public.integration_connections
  set status = next_status,
      updated_by = _actor_user_id,
      updated_at = now()
  where id = connection_id_value
    and organization_id = _organization_id;

  insert into public.integration_audit_events (
    organization_id,
    connection_id,
    actor_user_id,
    event_type,
    metadata
  ) values (
    _organization_id,
    connection_id_value,
    _actor_user_id,
    case when _disabled then 'DISABLED' else 'ENABLED' end,
    '{}'::jsonb
  );

  return connection_id_value;
end;
$$;

revoke all on function public.set_integration_connection_disabled(uuid,text,uuid,boolean) from public;
revoke all on function public.set_integration_connection_disabled(uuid,text,uuid,boolean) from anon;
revoke all on function public.set_integration_connection_disabled(uuid,text,uuid,boolean) from authenticated;
grant execute on function public.set_integration_connection_disabled(uuid,text,uuid,boolean) to service_role;
