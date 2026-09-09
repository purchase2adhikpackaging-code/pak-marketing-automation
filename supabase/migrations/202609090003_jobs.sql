create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  parent_job_id uuid references public.jobs(id) on delete cascade,
  job_type text not null,
  resource_type text,
  resource_id uuid,
  state text not null default 'QUEUED' check (state in ('QUEUED','PROCESSING','COMPLETED','FAILED','RETRYING','CANCELLED')),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  max_attempts integer not null default 3 check (max_attempts > 0),
  retry_policy jsonb not null default '{}'::jsonb,
  input_payload jsonb not null default '{}'::jsonb,
  result_payload jsonb,
  failure_metadata jsonb,
  idempotency_key text,
  lease_owner text,
  lease_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz
);

create unique index if not exists jobs_org_idempotency_key_uq
  on public.jobs(organization_id, idempotency_key)
  where idempotency_key is not null;

create index if not exists jobs_claim_idx
  on public.jobs(state, lease_expires_at, created_at)
  where state in ('QUEUED','RETRYING');

create index if not exists jobs_org_idx on public.jobs(organization_id, created_at desc);
create index if not exists jobs_parent_idx on public.jobs(parent_job_id);

alter table public.jobs enable row level security;

create policy jobs_select_member
on public.jobs
for select
to authenticated
using (public.is_org_member(organization_id));

create policy jobs_insert_editor
on public.jobs
for insert
to authenticated
with check (public.has_org_role(organization_id, array['OWNER','ADMIN','EDITOR']));

create policy jobs_update_editor
on public.jobs
for update
to authenticated
using (public.has_org_role(organization_id, array['OWNER','ADMIN','EDITOR']))
with check (public.has_org_role(organization_id, array['OWNER','ADMIN','EDITOR']));

create or replace function public.claim_next_job(
  p_worker_id text,
  p_lease_seconds integer default 120,
  p_job_types text[] default null
)
returns public.jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job public.jobs;
begin
  if p_worker_id is null or length(trim(p_worker_id)) = 0 then
    raise exception 'worker id is required';
  end if;

  with candidate as (
    select j.id
    from public.jobs j
    where j.state in ('QUEUED','RETRYING')
      and (j.lease_expires_at is null or j.lease_expires_at <= now())
      and (p_job_types is null or j.job_type = any(p_job_types))
      and j.attempt_count < j.max_attempts
    order by j.created_at asc
    for update skip locked
    limit 1
  )
  update public.jobs j
  set state = 'PROCESSING',
      attempt_count = j.attempt_count + 1,
      lease_owner = p_worker_id,
      lease_expires_at = now() + make_interval(secs => greatest(p_lease_seconds, 30)),
      started_at = coalesce(j.started_at, now()),
      updated_at = now()
  from candidate c
  where j.id = c.id
  returning j.* into v_job;

  return v_job;
end;
$$;

revoke all on function public.claim_next_job(text, integer, text[]) from public;
revoke all on function public.claim_next_job(text, integer, text[]) from authenticated;
