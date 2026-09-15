create or replace function public.read_publishing_worker_dispatch_secret()
returns text
language plpgsql
security definer
set search_path = public, vault
as $$
declare
  v_secret text;
  v_attempt integer;
begin
  for v_attempt in 1..5 loop
    begin
      select decrypted_secret
      into v_secret
      from vault.decrypted_secrets
      where name = 'pak/publishing/worker-dispatch'
      limit 1;

      if v_secret is not null and length(trim(v_secret)) > 0 then
        return v_secret;
      end if;
    exception when others then
      if v_attempt = 5 then
        raise;
      end if;
    end;

    if v_attempt < 5 then
      perform pg_sleep(0.2 * v_attempt);
    end if;
  end loop;

  return null;
end;
$$;

revoke all on function public.read_publishing_worker_dispatch_secret() from public;
revoke all on function public.read_publishing_worker_dispatch_secret() from anon;
revoke all on function public.read_publishing_worker_dispatch_secret() from authenticated;
grant execute on function public.read_publishing_worker_dispatch_secret() to service_role;
