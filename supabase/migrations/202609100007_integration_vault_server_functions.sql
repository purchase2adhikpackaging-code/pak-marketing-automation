create or replace function public.save_integration_secret_server(
  _organization_id uuid,
  _provider text,
  _actor_user_id uuid,
  _secret_name text,
  _ciphertext text,
  _encryption_version integer,
  _masked_hint text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  connection_id_value uuid;
  existed boolean;
begin
  if not exists (
    select 1 from public.organization_memberships m
    where m.organization_id = _organization_id
      and m.user_id = _actor_user_id
      and m.role in ('OWNER','ADMIN')
  ) then
    raise exception 'actor is not authorized to manage integration credentials';
  end if;

  select id into connection_id_value
  from public.integration_connections
  where organization_id = _organization_id and provider = _provider;

  existed := connection_id_value is not null;

  if not existed then
    insert into public.integration_connections (
      organization_id, provider, display_name, status, secret_version,
      masked_hint, created_by, updated_by
    ) values (
      _organization_id,
      _provider,
      case _provider when 'OPENAI' then 'OpenAI' when 'META' then 'Meta' when 'LTX' then 'LTX' else _provider end,
      'CONFIGURED',
      1,
      _masked_hint,
      _actor_user_id,
      _actor_user_id
    ) returning id into connection_id_value;
  else
    update public.integration_connections
    set status = 'CONFIGURED',
        secret_version = secret_version + 1,
        masked_hint = _masked_hint,
        last_error_code = null,
        updated_by = _actor_user_id,
        updated_at = now()
    where id = connection_id_value;
  end if;

  insert into public.integration_secrets (
    organization_id, connection_id, secret_name, ciphertext,
    encryption_version, created_by, rotated_at
  ) values (
    _organization_id, connection_id_value, _secret_name, _ciphertext,
    _encryption_version, _actor_user_id, case when existed then now() else null end
  )
  on conflict (connection_id, secret_name)
  do update set
    ciphertext = excluded.ciphertext,
    encryption_version = excluded.encryption_version,
    rotated_at = now();

  insert into public.integration_audit_events (
    organization_id, connection_id, actor_user_id, event_type, metadata
  ) values (
    _organization_id,
    connection_id_value,
    _actor_user_id,
    case when existed then 'SECRET_REPLACED' else 'CREATED' end,
    jsonb_build_object('secret_name', _secret_name, 'secret_version', (
      select secret_version from public.integration_connections where id = connection_id_value
    ))
  );

  return connection_id_value;
end;
$$;

revoke all on function public.save_integration_secret_server(uuid,text,uuid,text,text,integer,text) from public;
revoke all on function public.save_integration_secret_server(uuid,text,uuid,text,text,integer,text) from anon;
revoke all on function public.save_integration_secret_server(uuid,text,uuid,text,text,integer,text) from authenticated;
grant execute on function public.save_integration_secret_server(uuid,text,uuid,text,text,integer,text) to service_role;

create or replace function public.remove_integration_secret_server(
  _organization_id uuid,
  _provider text,
  _actor_user_id uuid,
  _secret_name text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  connection_id_value uuid;
  deleted_count integer;
  remaining_count integer;
begin
  if not exists (
    select 1 from public.organization_memberships m
    where m.organization_id = _organization_id
      and m.user_id = _actor_user_id
      and m.role in ('OWNER','ADMIN')
  ) then
    raise exception 'actor is not authorized to manage integration credentials';
  end if;

  select id into connection_id_value
  from public.integration_connections
  where organization_id = _organization_id and provider = _provider;

  if connection_id_value is null then
    return false;
  end if;

  delete from public.integration_secrets
  where organization_id = _organization_id
    and connection_id = connection_id_value
    and secret_name = _secret_name;
  get diagnostics deleted_count = row_count;

  if deleted_count = 0 then
    return false;
  end if;

  select count(*) into remaining_count
  from public.integration_secrets
  where connection_id = connection_id_value;

  update public.integration_connections
  set status = case when remaining_count = 0 then 'NOT_CONFIGURED' else status end,
      secret_version = secret_version + 1,
      masked_hint = case when remaining_count = 0 then null else masked_hint end,
      last_verified_at = case when remaining_count = 0 then null else last_verified_at end,
      last_error_code = null,
      updated_by = _actor_user_id,
      updated_at = now()
  where id = connection_id_value;

  insert into public.integration_audit_events (
    organization_id, connection_id, actor_user_id, event_type, metadata
  ) values (
    _organization_id,
    connection_id_value,
    _actor_user_id,
    'SECRET_REMOVED',
    jsonb_build_object('secret_name', _secret_name, 'secret_version', (
      select secret_version from public.integration_connections where id = connection_id_value
    ))
  );

  return true;
end;
$$;

revoke all on function public.remove_integration_secret_server(uuid,text,uuid,text) from public;
revoke all on function public.remove_integration_secret_server(uuid,text,uuid,text) from anon;
revoke all on function public.remove_integration_secret_server(uuid,text,uuid,text) from authenticated;
grant execute on function public.remove_integration_secret_server(uuid,text,uuid,text) to service_role;
