-- Allow Supabase pg_cron/pg_net to reach protected Vercel previews without
-- weakening Deployment Protection. The automation-bypass secret itself is
-- provisioned separately into Supabase Vault under:
--   pak/publishing/vercel-automation-bypass
--
-- If the Vault secret is absent, the header is omitted so public production
-- deployments continue to work unchanged.
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
          headers := jsonb_strip_nulls(jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization',
            'Bearer ' || (
              select decrypted_secret
              from vault.decrypted_secrets
              where name = 'pak/publishing/worker-dispatch'
              limit 1
            ),
            'x-vercel-protection-bypass', (
              select decrypted_secret
              from vault.decrypted_secrets
              where name = 'pak/publishing/vercel-automation-bypass'
              limit 1
            )
          )),
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
