create or replace function public.record_integration_test_result(
  _organization_id uuid,
  _provider text,
  _actor_user_id uuid,
  _succeeded boolean,
  _error_code text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  connection_id_value uuid;
  verified_at_value timestamptz := now();
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

  update public.integration_connections
  set status = case when _succeeded then 'CONFIGURED' else 'INVALID' end,
      last_verified_at = verified_at_value,
      last_error_code = case when _succeeded then null else coalesce(_error_code, 'AUTH_INVALID') end,
      updated_by = _actor_user_id,
      updated_at = verified_at_value
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
    case when _succeeded then 'TEST_SUCCEEDED' else 'TEST_FAILED' end,
    case
      when _succeeded then '{}'::jsonb
      else jsonb_build_object('error_code', coalesce(_error_code, 'AUTH_INVALID'))
    end
  );

  return connection_id_value;
end;
$$;

revoke all on function public.record_integration_test_result(uuid,text,uuid,boolean,text) from public;
revoke all on function public.record_integration_test_result(uuid,text,uuid,boolean,text) from anon;
revoke all on function public.record_integration_test_result(uuid,text,uuid,boolean,text) from authenticated;
grant execute on function public.record_integration_test_result(uuid,text,uuid,boolean,text) to service_role;
