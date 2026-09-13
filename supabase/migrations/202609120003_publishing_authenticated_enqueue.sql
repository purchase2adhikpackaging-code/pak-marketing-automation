-- Harden authenticated production-run creation/enqueue while keeping worker-only
-- execution paths behind SECURITY DEFINER RPCs and service-role grants.

drop policy if exists publishing_runs_insert_editor on public.publishing_production_runs;
create policy publishing_runs_insert_authorized
on public.publishing_production_runs
for insert
to authenticated
with check (
  created_by = auth.uid()
  and public.has_org_role(organization_id, array['OWNER','ADMIN','EDITOR'])
  and (
    scope_type <> 'PORTFOLIO'
    or public.has_org_role(organization_id, array['OWNER','ADMIN'])
  )
);

drop policy if exists publishing_jobs_insert_authorized on public.publishing_production_jobs;
create policy publishing_jobs_insert_authorized
on public.publishing_production_jobs
for insert
to authenticated
with check (
  exists (
    select 1
    from public.publishing_production_runs r
    where r.id = production_run_id
      and r.organization_id = organization_id
      and public.has_org_role(r.organization_id, array['OWNER','ADMIN','EDITOR'])
      and (
        r.scope_type <> 'PORTFOLIO'
        or public.has_org_role(r.organization_id, array['OWNER','ADMIN'])
      )
  )
);

-- This function is invoked by a SECURITY DEFINER trigger after authenticated job
-- inserts as well as by service-role worker mutations. It must not depend on the
-- caller JWT role; direct execution remains revoked from browser roles below.
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

create or replace function public.set_publishing_run_state(
  p_run_id uuid,
  p_state text
)
returns public.publishing_production_runs
language plpgsql
security definer
set search_path = public
as $$
declare
  v_run public.publishing_production_runs;
  v_role text;
begin
  select r.* into v_run
  from public.publishing_production_runs r
  where r.id = p_run_id;

  if v_run.id is null then
    raise exception 'publishing run not found';
  end if;

  select m.role into v_role
  from public.organization_memberships m
  where m.organization_id = v_run.organization_id
    and m.user_id = auth.uid();

  if v_role not in ('OWNER','ADMIN','EDITOR') then
    raise exception 'publishing run control is forbidden';
  end if;
  if v_role = 'EDITOR' and v_run.scope_type = 'PORTFOLIO' then
    raise exception 'editors cannot control portfolio production';
  end if;
  if p_state not in ('PAUSED','RUNNING','CANCELLED') then
    raise exception 'unsupported publishing run state';
  end if;

  update public.publishing_production_runs
  set status = p_state,
      cancel_requested_at = case when p_state = 'CANCELLED' then now() else cancel_requested_at end,
      completed_at = case when p_state in ('RUNNING','PAUSED') then null else completed_at end,
      updated_at = now()
  where id = p_run_id
  returning * into v_run;

  if p_state = 'CANCELLED' then
    update public.publishing_production_jobs
    set status = 'CANCELLED',
        lease_owner = null,
        lease_expires_at = null,
        updated_at = now(),
        completed_at = now()
    where production_run_id = p_run_id
      and status = 'QUEUED';
  end if;

  return v_run;
end;
$$;

revoke execute on function public.set_publishing_run_state(uuid, text) from public;
revoke execute on function public.set_publishing_run_state(uuid, text) from anon;
grant execute on function public.set_publishing_run_state(uuid, text) to authenticated;
