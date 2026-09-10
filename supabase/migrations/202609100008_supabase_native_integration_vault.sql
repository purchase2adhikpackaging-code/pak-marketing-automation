alter table public.integration_secrets
  add column if not exists vault_secret_id uuid;

alter table public.integration_secrets
  alter column ciphertext drop not null;

create unique index if not exists integration_secrets_vault_secret_id_key
  on public.integration_secrets(vault_secret_id)
  where vault_secret_id is not null;

create or replace function public.save_integration_vault_secret(
  _organization_id uuid,
  _provider text,
  _actor_user_id uuid,
  _secret_name text,
  _secret_value text,
  _masked_hint text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, vault
as $$
declare
  connection_id_value uuid;
  secret_row_id uuid;
  vault_id uuid;
  existed boolean := false;
  vault_name text;
begin
  if coalesce(length(trim(_secret_value)), 0) = 0 then
    raise exception 'secret value is required';
  end if;

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
    raise exception 'actor is not authorized to manage integration credentials';
  end if;

  select id into connection_id_value
  from public.integration_connections
  where organization_id = _organization_id
    and provider = _provider;

  if connection_id_value is null then
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
    existed := true;
    update public.integration_connections
    set status = 'CONFIGURED',
        secret_version = secret_version + 1,
        masked_hint = _masked_hint,
        last_error_code = null,
        updated_by = _actor_user_id,
        updated_at = now()
    where id = connection_id_value;
  end if;

  select id, vault_secret_id
    into secret_row_id, vault_id
  from public.integration_secrets
  where connection_id = connection_id_value
    and secret_name = _secret_name;

  vault_name := 'pak/' || _organization_id::text || '/' || lower(_provider) || '/' || lower(_secret_name);

  if vault_id is null then
    select vault.create_secret(
      _secret_value,
      vault_name,
      'PAK integration credential. Managed by integration-vault Edge Function.'
    ) into vault_id;
  else
    perform vault.update_secret(vault_id, _secret_value, vault_name, 'PAK integration credential. Managed by integration-vault Edge Function.');
  end if;

  insert into public.integration_secrets (
    organization_id,
    connection_id,
    secret_name,
    ciphertext,
    encryption_version,
    vault_secret_id,
    created_by,
    rotated_at
  ) values (
    _organization_id,
    connection_id_value,
    _secret_name,
    null,
    2,
    vault_id,
    _actor_user_id,
    case when secret_row_id is not null then now() else null end
  )
  on conflict (connection_id, secret_name)
  do update set
    ciphertext = null,
    encryption_version = 2,
    vault_secret_id = excluded.vault_secret_id,
    rotated_at = now();

  insert into public.integration_audit_events (
    organization_id, connection_id, actor_user_id, event_type, metadata
  ) values (
    _organization_id,
    connection_id_value,
    _actor_user_id,
    case when existed or secret_row_id is not null then 'SECRET_REPLACED' else 'CREATED' end,
    jsonb_build_object(
      'secret_name', _secret_name,
      'secret_version', (select secret_version from public.integration_connections where id = connection_id_value),
      'storage', 'SUPABASE_VAULT'
    )
  );

  return connection_id_value;
end;
$$;

revoke all on function public.save_integration_vault_secret(uuid,text,uuid,text,text,text) from public;
revoke all on function public.save_integration_vault_secret(uuid,text,uuid,text,text,text) from anon;
revoke all on function public.save_integration_vault_secret(uuid,text,uuid,text,text,text) from authenticated;
grant execute on function public.save_integration_vault_secret(uuid,text,uuid,text,text,text) to service_role;

create or replace function public.read_integration_vault_secret(
  _organization_id uuid,
  _provider text,
  _secret_name text
)
returns text
language plpgsql
security definer
set search_path = public, vault
as $$
declare
  vault_id uuid;
  secret_value text;
begin
  select s.vault_secret_id
    into vault_id
  from public.integration_secrets s
  join public.integration_connections c on c.id = s.connection_id
  where s.organization_id = _organization_id
    and c.organization_id = _organization_id
    and c.provider = _provider
    and s.secret_name = _secret_name;

  if vault_id is null then
    return null;
  end if;

  select decrypted_secret into secret_value
  from vault.decrypted_secrets
  where id = vault_id;

  return secret_value;
end;
$$;

revoke all on function public.read_integration_vault_secret(uuid,text,text) from public;
revoke all on function public.read_integration_vault_secret(uuid,text,text) from anon;
revoke all on function public.read_integration_vault_secret(uuid,text,text) from authenticated;
grant execute on function public.read_integration_vault_secret(uuid,text,text) to service_role;

create or replace function public.remove_integration_vault_secret(
  _organization_id uuid,
  _provider text,
  _actor_user_id uuid,
  _secret_name text
)
returns boolean
language plpgsql
security definer
set search_path = public, vault
as $$
declare
  connection_id_value uuid;
  secret_row_id uuid;
  vault_id uuid;
begin
  if not exists (
    select 1
    from public.organization_memberships m
    where m.organization_id = _organization_id
      and m.user_id = _actor_user_id
      and m.role in ('OWNER','ADMIN')
  ) then
    raise exception 'actor is not authorized to manage integration credentials';
  end if;

  select id into connection_id_value
  from public.integration_connections
  where organization_id = _organization_id
    and provider = _provider;

  if connection_id_value is null then
    return false;
  end if;

  select id, vault_secret_id
    into secret_row_id, vault_id
  from public.integration_secrets
  where connection_id = connection_id_value
    and secret_name = _secret_name;

  if secret_row_id is null then
    return false;
  end if;

  if vault_id is not null then
    delete from vault.secrets where id = vault_id;
  end if;

  delete from public.integration_secrets where id = secret_row_id;

  update public.integration_connections
  set status = 'NOT_CONFIGURED',
      secret_version = secret_version + 1,
      masked_hint = null,
      last_verified_at = null,
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
    jsonb_build_object(
      'secret_name', _secret_name,
      'secret_version', (select secret_version from public.integration_connections where id = connection_id_value),
      'storage', 'SUPABASE_VAULT'
    )
  );

  return true;
end;
$$;

revoke all on function public.remove_integration_vault_secret(uuid,text,uuid,text) from public;
revoke all on function public.remove_integration_vault_secret(uuid,text,uuid,text) from anon;
revoke all on function public.remove_integration_vault_secret(uuid,text,uuid,text) from authenticated;
grant execute on function public.remove_integration_vault_secret(uuid,text,uuid,text) to service_role;
