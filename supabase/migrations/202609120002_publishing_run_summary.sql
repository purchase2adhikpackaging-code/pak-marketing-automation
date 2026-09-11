create or replace function public.refresh_publishing_run_summary(p_run_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_queued integer;
  v_running integer;
  v_passed integer;
  v_blocked integer;
  v_cancelled integer;
  v_released integer;
  v_current_status text;
begin
  select
    count(*) filter (where status = 'QUEUED'),
    count(*) filter (where status = 'RUNNING'),
    count(*) filter (where status = 'QA_PASSED'),
    count(*) filter (where status = 'BLOCKED'),
    count(*) filter (where status = 'CANCELLED')
  into v_queued, v_running, v_passed, v_blocked, v_cancelled
  from public.publishing_production_jobs
  where production_run_id = p_run_id;

  select count(*) into v_released
  from public.publishing_publications
  where production_run_id = p_run_id
    and status = 'RELEASED';

  select status into v_current_status
  from public.publishing_production_runs
  where id = p_run_id;

  update public.publishing_production_runs
  set queued_count = coalesce(v_queued, 0),
      running_count = coalesce(v_running, 0),
      qa_passed_count = coalesce(v_passed, 0),
      blocked_count = coalesce(v_blocked, 0),
      cancelled_count = coalesce(v_cancelled, 0),
      released_count = coalesce(v_released, 0),
      status = case
        when v_current_status in ('CANCELLED','PAUSED','FAILED') then v_current_status
        when coalesce(v_queued, 0) = 0 and coalesce(v_running, 0) = 0 and coalesce(v_blocked, 0) > 0
          then 'COMPLETED_WITH_BLOCKED'
        when coalesce(v_queued, 0) = 0 and coalesce(v_running, 0) = 0
          then 'COMPLETED'
        when coalesce(v_running, 0) > 0 then 'RUNNING'
        else 'QUEUED'
      end,
      completed_at = case
        when coalesce(v_queued, 0) = 0 and coalesce(v_running, 0) = 0 then coalesce(completed_at, now())
        else null
      end,
      updated_at = now()
  where id = p_run_id;
end;
$$;

revoke execute on function public.refresh_publishing_run_summary(uuid) from public;
revoke execute on function public.refresh_publishing_run_summary(uuid) from anon;
revoke execute on function public.refresh_publishing_run_summary(uuid) from authenticated;
grant execute on function public.refresh_publishing_run_summary(uuid) to service_role;

create or replace function public.trigger_refresh_publishing_run_summary()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.refresh_publishing_run_summary(coalesce(new.production_run_id, old.production_run_id));
  return coalesce(new, old);
end;
$$;

revoke execute on function public.trigger_refresh_publishing_run_summary() from public;
revoke execute on function public.trigger_refresh_publishing_run_summary() from anon;
revoke execute on function public.trigger_refresh_publishing_run_summary() from authenticated;

drop trigger if exists publishing_jobs_refresh_run_summary on public.publishing_production_jobs;
create trigger publishing_jobs_refresh_run_summary
after insert or update or delete on public.publishing_production_jobs
for each row execute function public.trigger_refresh_publishing_run_summary();

drop trigger if exists publishing_publications_refresh_run_summary on public.publishing_publications;
create trigger publishing_publications_refresh_run_summary
after insert or update or delete on public.publishing_publications
for each row execute function public.trigger_refresh_publishing_run_summary();
