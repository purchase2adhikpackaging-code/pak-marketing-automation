-- Expose only a boolean dispatcher-readiness signal to authenticated application users.
-- The worker URL, Vault credential and cron command remain privileged and undisclosed.
create or replace function public.publishing_worker_recovery_ready()
returns boolean
language sql
stable
security definer
set search_path = public, cron, pg_temp
as $$
  select exists (
    select 1
    from cron.job
    where jobname = 'pak-publishing-worker-recovery'
      and active
  );
$$;

revoke all on function public.publishing_worker_recovery_ready() from public;
revoke all on function public.publishing_worker_recovery_ready() from anon;
grant execute on function public.publishing_worker_recovery_ready() to authenticated;
