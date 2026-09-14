create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

-- One internal publishing worker credential, generated inside Postgres and encrypted
-- by Supabase Vault. The plaintext value is never committed to source control.
do $$
begin
  if not exists (
    select 1
    from vault.secrets
    where name = 'pak/publishing/worker-dispatch'
  ) then
    perform vault.create_secret(
      encode(extensions.gen_random_bytes(32), 'hex'),
      'pak/publishing/worker-dispatch',
      'Internal credential for unattended PAK publishing worker dispatch.',
      null
    );
  end if;
end;
$$;

create or replace function public.read_publishing_worker_dispatch_secret()
returns text
language sql
security definer
stable
set search_path = public, vault
as $$
  select decrypted_secret
  from vault.decrypted_secrets
  where name = 'pak/publishing/worker-dispatch'
  limit 1;
$$;

revoke all on function public.read_publishing_worker_dispatch_secret() from public;
revoke all on function public.read_publishing_worker_dispatch_secret() from anon;
revoke all on function public.read_publishing_worker_dispatch_secret() from authenticated;
grant execute on function public.read_publishing_worker_dispatch_secret() to service_role;

-- Install or replace the minute-level recovery dispatcher. The URL is supplied at
-- deployment time so branches and production can target their own Vercel endpoint.
-- The bearer credential is read from Vault only when the cron actually executes.
create or replace function public.install_publishing_worker_recovery(_worker_url text)
returns bigint
language plpgsql
security definer
set search_path = public, cron, net, vault
as $$
declare
  v_job_id bigint;
  v_existing_job_id bigint;
  v_endpoint text;
begin
  if _worker_url is null
     or btrim(_worker_url) = ''
     or _worker_url !~ '^https://[A-Za-z0-9.-]+(?::[0-9]+)?(?:/.*)?$'
  then
    raise exception 'a valid HTTPS publishing worker URL is required';
  end if;

  if not exists (
    select 1
    from vault.decrypted_secrets
    where name = 'pak/publishing/worker-dispatch'
      and coalesce(decrypted_secret, '') <> ''
  ) then
    raise exception 'publishing worker dispatch credential is unavailable';
  end if;

  for v_existing_job_id in
    select jobid
    from cron.job
    where jobname = 'pak-publishing-worker-recovery'
  loop
    perform cron.unschedule(v_existing_job_id);
  end loop;

  v_endpoint := rtrim(_worker_url, '/') || '/api/internal/publishing-worker';

  select cron.schedule(
    'pak-publishing-worker-recovery',
    '* * * * *',
    format(
      $cron$
        select net.http_post(
          url := %L,
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization',
            'Bearer ' || (
              select decrypted_secret
              from vault.decrypted_secrets
              where name = 'pak/publishing/worker-dispatch'
              limit 1
            )
          ),
          body := '{"concurrency":4}'::jsonb,
          timeout_milliseconds := 10000
        ) as request_id;
      $cron$,
      v_endpoint
    )
  ) into v_job_id;

  return v_job_id;
end;
$$;

revoke all on function public.install_publishing_worker_recovery(text) from public;
revoke all on function public.install_publishing_worker_recovery(text) from anon;
revoke all on function public.install_publishing_worker_recovery(text) from authenticated;
grant execute on function public.install_publishing_worker_recovery(text) to service_role;

create or replace function public.remove_publishing_worker_recovery()
returns void
language plpgsql
security definer
set search_path = public, cron
as $$
declare
  v_existing_job_id bigint;
begin
  for v_existing_job_id in
    select jobid
    from cron.job
    where jobname = 'pak-publishing-worker-recovery'
  loop
    perform cron.unschedule(v_existing_job_id);
  end loop;
end;
$$;

revoke all on function public.remove_publishing_worker_recovery() from public;
revoke all on function public.remove_publishing_worker_recovery() from anon;
revoke all on function public.remove_publishing_worker_recovery() from authenticated;
grant execute on function public.remove_publishing_worker_recovery() to service_role;
