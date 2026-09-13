create table if not exists public.publishing_production_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete restrict,
  scope_type text not null check (scope_type in ('SUBJECT','PROGRAMME','PILOT','PORTFOLIO')),
  scope_value jsonb not null default '{}'::jsonb,
  status text not null default 'QUEUED' check (
    status in ('QUEUED','RUNNING','PAUSED','COMPLETED','COMPLETED_WITH_BLOCKED','CANCELLED','FAILED')
  ),
  requested_concurrency integer not null default 4 check (requested_concurrency between 1 and 32),
  planned_count integer not null default 0 check (planned_count >= 0),
  queued_count integer not null default 0 check (queued_count >= 0),
  running_count integer not null default 0 check (running_count >= 0),
  qa_passed_count integer not null default 0 check (qa_passed_count >= 0),
  blocked_count integer not null default 0 check (blocked_count >= 0),
  cancelled_count integer not null default 0 check (cancelled_count >= 0),
  released_count integer not null default 0 check (released_count >= 0),
  idempotency_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  cancel_requested_at timestamptz
);

create unique index if not exists publishing_production_runs_org_idempotency_uq
  on public.publishing_production_runs(organization_id, idempotency_key)
  where idempotency_key is not null;

create index if not exists publishing_production_runs_org_created_idx
  on public.publishing_production_runs(organization_id, created_at desc);

create table if not exists public.publishing_production_jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  production_run_id uuid not null references public.publishing_production_runs(id) on delete cascade,
  book_id text not null,
  programme_code text not null,
  subject_code text not null,
  academic_period text,
  edition text not null,
  revision text not null,
  book_job_payload jsonb not null,
  curriculum_text text not null,
  status text not null default 'QUEUED' check (status in ('QUEUED','RUNNING','QA_PASSED','BLOCKED','CANCELLED')),
  claim_count integer not null default 0 check (claim_count >= 0),
  failure_attempts integer not null default 0 check (failure_attempts >= 0),
  max_failure_attempts integer not null default 3 check (max_failure_attempts = 3),
  lease_owner text,
  lease_expires_at timestamptz,
  last_error text,
  current_stage text,
  checkpoint_root text,
  qa_status text,
  pdf_artifact_path text,
  manifest_artifact_path text,
  provider_name text,
  provider_model text,
  knowledge_hashes jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  unique (production_run_id, book_id, edition, revision)
);

create index if not exists publishing_production_jobs_claim_idx
  on public.publishing_production_jobs(status, lease_expires_at, created_at)
  where status in ('QUEUED','RUNNING');

create index if not exists publishing_production_jobs_run_idx
  on public.publishing_production_jobs(production_run_id, created_at);

create table if not exists public.publishing_publications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  production_run_id uuid not null references public.publishing_production_runs(id) on delete restrict,
  production_job_id uuid not null references public.publishing_production_jobs(id) on delete restrict,
  book_id text not null,
  programme_code text not null,
  subject_code text not null,
  academic_period text,
  edition text not null,
  revision text not null,
  status text not null default 'RELEASED' check (status = 'RELEASED'),
  pdf_artifact_path text not null,
  manuscript_html_path text not null,
  manuscript_json_path text not null,
  blueprint_path text not null,
  qa_report_path text not null,
  release_manifest_path text not null,
  provider_name text,
  provider_model text,
  knowledge_hashes jsonb not null default '[]'::jsonb,
  qa_summary jsonb not null default '{}'::jsonb,
  released_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (organization_id, book_id, edition, revision)
);

create index if not exists publishing_publications_library_idx
  on public.publishing_publications(organization_id, programme_code, academic_period, subject_code, released_at desc);

alter table public.publishing_production_runs enable row level security;
alter table public.publishing_production_jobs enable row level security;
alter table public.publishing_publications enable row level security;

create policy publishing_runs_select_member
on public.publishing_production_runs
for select
to authenticated
using (public.is_org_member(organization_id));

create policy publishing_runs_insert_editor
on public.publishing_production_runs
for insert
to authenticated
with check (
  created_by = auth.uid()
  and public.has_org_role(organization_id, array['OWNER','ADMIN','EDITOR'])
);

create policy publishing_runs_update_admin
on public.publishing_production_runs
for update
to authenticated
using (public.has_org_role(organization_id, array['OWNER','ADMIN','EDITOR']))
with check (public.has_org_role(organization_id, array['OWNER','ADMIN','EDITOR']));

create policy publishing_jobs_select_member
on public.publishing_production_jobs
for select
to authenticated
using (public.is_org_member(organization_id));

create policy publishing_publications_select_member
on public.publishing_publications
for select
to authenticated
using (public.is_org_member(organization_id));

create or replace function public.claim_publishing_jobs(
  p_worker_id text,
  p_limit integer default 4,
  p_lease_seconds integer default 300
)
returns setof public.publishing_production_jobs
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() <> 'service_role' then
    raise exception 'service role required';
  end if;
  if p_worker_id is null or length(trim(p_worker_id)) = 0 then
    raise exception 'worker id is required';
  end if;
  if p_limit < 1 or p_limit > 32 then
    raise exception 'claim limit must be between 1 and 32';
  end if;

  return query
  with candidates as (
    select j.id
    from public.publishing_production_jobs j
    join public.publishing_production_runs r on r.id = j.production_run_id
    where r.status in ('QUEUED','RUNNING')
      and j.status in ('QUEUED','RUNNING')
      and (j.status = 'QUEUED' or j.lease_expires_at <= now())
      and j.failure_attempts < j.max_failure_attempts
    order by j.created_at asc
    for update of j skip locked
    limit p_limit
  ), claimed as (
    update public.publishing_production_jobs j
    set status = 'RUNNING',
        claim_count = j.claim_count + 1,
        lease_owner = p_worker_id,
        lease_expires_at = now() + make_interval(secs => greatest(p_lease_seconds, 30)),
        started_at = coalesce(j.started_at, now()),
        updated_at = now()
    from candidates c
    where j.id = c.id
    returning j.*
  )
  select * from claimed;

  update public.publishing_production_runs r
  set status = 'RUNNING',
      started_at = coalesce(r.started_at, now()),
      updated_at = now()
  where r.id in (
    select distinct j.production_run_id
    from public.publishing_production_jobs j
    where j.lease_owner = p_worker_id
      and j.status = 'RUNNING'
  )
    and r.status = 'QUEUED';
end;
$$;

create or replace function public.heartbeat_publishing_job(
  p_job_id uuid,
  p_worker_id text,
  p_lease_seconds integer default 300
)
returns public.publishing_production_jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job public.publishing_production_jobs;
begin
  if auth.role() <> 'service_role' then
    raise exception 'service role required';
  end if;

  update public.publishing_production_jobs
  set lease_expires_at = now() + make_interval(secs => greatest(p_lease_seconds, 30)),
      updated_at = now()
  where id = p_job_id
    and status = 'RUNNING'
    and lease_owner = p_worker_id
  returning * into v_job;

  if v_job.id is null then
    raise exception 'publishing job lease is unavailable';
  end if;
  return v_job;
end;
$$;

create or replace function public.yield_publishing_job(
  p_job_id uuid,
  p_worker_id text,
  p_checkpoint_root text,
  p_current_stage text
)
returns public.publishing_production_jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job public.publishing_production_jobs;
begin
  if auth.role() <> 'service_role' then
    raise exception 'service role required';
  end if;

  update public.publishing_production_jobs
  set status = 'QUEUED',
      checkpoint_root = p_checkpoint_root,
      current_stage = p_current_stage,
      lease_owner = null,
      lease_expires_at = null,
      last_error = null,
      updated_at = now()
  where id = p_job_id
    and status = 'RUNNING'
    and lease_owner = p_worker_id
  returning * into v_job;

  if v_job.id is null then
    raise exception 'publishing job lease is unavailable';
  end if;
  return v_job;
end;
$$;

create or replace function public.complete_publishing_job(
  p_job_id uuid,
  p_worker_id text,
  p_qa_status text,
  p_pdf_artifact_path text,
  p_manifest_artifact_path text,
  p_provider_name text default null,
  p_provider_model text default null,
  p_knowledge_hashes jsonb default '[]'::jsonb
)
returns public.publishing_production_jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job public.publishing_production_jobs;
begin
  if auth.role() <> 'service_role' then
    raise exception 'service role required';
  end if;
  if p_qa_status <> 'QA_PASSED' then
    raise exception 'only QA-passed jobs may complete';
  end if;

  update public.publishing_production_jobs
  set status = 'QA_PASSED',
      current_stage = 'QA_PASSED',
      qa_status = p_qa_status,
      pdf_artifact_path = p_pdf_artifact_path,
      manifest_artifact_path = p_manifest_artifact_path,
      provider_name = p_provider_name,
      provider_model = p_provider_model,
      knowledge_hashes = coalesce(p_knowledge_hashes, '[]'::jsonb),
      lease_owner = null,
      lease_expires_at = null,
      completed_at = now(),
      updated_at = now()
  where id = p_job_id
    and status = 'RUNNING'
    and lease_owner = p_worker_id
  returning * into v_job;

  if v_job.id is null then
    raise exception 'publishing job lease is unavailable';
  end if;
  return v_job;
end;
$$;

create or replace function public.fail_publishing_job(
  p_job_id uuid,
  p_worker_id text,
  p_error text
)
returns public.publishing_production_jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job public.publishing_production_jobs;
begin
  if auth.role() <> 'service_role' then
    raise exception 'service role required';
  end if;

  update public.publishing_production_jobs
  set failure_attempts = least(failure_attempts + 1, max_failure_attempts),
      status = case when failure_attempts + 1 >= max_failure_attempts then 'BLOCKED' else 'QUEUED' end,
      last_error = left(coalesce(p_error, 'Unknown publishing failure'), 4000),
      lease_owner = null,
      lease_expires_at = null,
      completed_at = case when failure_attempts + 1 >= max_failure_attempts then now() else completed_at end,
      updated_at = now()
  where id = p_job_id
    and status = 'RUNNING'
    and lease_owner = p_worker_id
  returning * into v_job;

  if v_job.id is null then
    raise exception 'publishing job lease is unavailable';
  end if;
  return v_job;
end;
$$;

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
  if p_state not in ('PAUSED','RUNNING','CANCELLED') then
    raise exception 'unsupported publishing run state';
  end if;

  update public.publishing_production_runs
  set status = p_state,
      cancel_requested_at = case when p_state = 'CANCELLED' then now() else cancel_requested_at end,
      updated_at = now()
  where id = p_run_id
  returning * into v_run;

  if p_state = 'CANCELLED' then
    update public.publishing_production_jobs
    set status = 'CANCELLED', updated_at = now(), completed_at = now()
    where production_run_id = p_run_id and status = 'QUEUED';
  end if;

  return v_run;
end;
$$;

revoke execute on function public.claim_publishing_jobs(text, integer, integer) from public;
revoke execute on function public.claim_publishing_jobs(text, integer, integer) from anon;
revoke execute on function public.claim_publishing_jobs(text, integer, integer) from authenticated;
grant execute on function public.claim_publishing_jobs(text, integer, integer) to service_role;

revoke execute on function public.heartbeat_publishing_job(uuid, text, integer) from public;
revoke execute on function public.heartbeat_publishing_job(uuid, text, integer) from anon;
revoke execute on function public.heartbeat_publishing_job(uuid, text, integer) from authenticated;
grant execute on function public.heartbeat_publishing_job(uuid, text, integer) to service_role;

revoke execute on function public.yield_publishing_job(uuid, text, text, text) from public;
revoke execute on function public.yield_publishing_job(uuid, text, text, text) from anon;
revoke execute on function public.yield_publishing_job(uuid, text, text, text) from authenticated;
grant execute on function public.yield_publishing_job(uuid, text, text, text) to service_role;

revoke execute on function public.complete_publishing_job(uuid, text, text, text, text, text, text, jsonb) from public;
revoke execute on function public.complete_publishing_job(uuid, text, text, text, text, text, text, jsonb) from anon;
revoke execute on function public.complete_publishing_job(uuid, text, text, text, text, text, text, jsonb) from authenticated;
grant execute on function public.complete_publishing_job(uuid, text, text, text, text, text, text, jsonb) to service_role;

revoke execute on function public.fail_publishing_job(uuid, text, text) from public;
revoke execute on function public.fail_publishing_job(uuid, text, text) from anon;
revoke execute on function public.fail_publishing_job(uuid, text, text) from authenticated;
grant execute on function public.fail_publishing_job(uuid, text, text) to service_role;

revoke execute on function public.set_publishing_run_state(uuid, text) from public;
revoke execute on function public.set_publishing_run_state(uuid, text) from anon;
grant execute on function public.set_publishing_run_state(uuid, text) to authenticated;

insert into storage.buckets (id, name, public)
values ('publishing-books', 'publishing-books', false)
on conflict (id) do update set public = false;

create policy publishing_books_select_org_member
on storage.objects
for select
to authenticated
using (
  bucket_id = 'publishing-books'
  and exists (
    select 1 from public.organization_memberships m
    where m.user_id = auth.uid()
      and m.organization_id::text = (storage.foldername(name))[1]
  )
);

create policy publishing_books_service_insert
on storage.objects
for insert
to service_role
with check (bucket_id = 'publishing-books');

create policy publishing_books_service_update
on storage.objects
for update
to service_role
using (bucket_id = 'publishing-books')
with check (bucket_id = 'publishing-books');
