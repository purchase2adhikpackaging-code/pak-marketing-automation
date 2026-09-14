-- Pilot-gated autonomous publishing portfolio bootstrap.
-- Privileged bootstrap remains service-role-only behind the worker broker.

create table if not exists public.publishing_automation_settings (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  enabled boolean not null default false,
  concurrency integer not null default 4 check (concurrency = 4),
  pilot_approved_at timestamptz,
  enabled_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.publishing_automation_settings enable row level security;

drop policy if exists publishing_automation_settings_select_member on public.publishing_automation_settings;
create policy publishing_automation_settings_select_member
on public.publishing_automation_settings
for select
to authenticated
using (public.is_org_member(organization_id));

-- Mutations are deliberately not exposed to browser roles during the pilot rollout.
-- Pilot approval/enablement is performed through the trusted operational boundary.

create or replace function public.bootstrap_publishing_auto_portfolio(
  _organization_id uuid,
  _idempotency_key text,
  _jobs jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_setting public.publishing_automation_settings;
  v_run_id uuid;
  v_existing_run_id uuid;
  v_eligible_count integer := 0;
begin
  if auth.role() <> 'service_role' then
    raise exception 'service role required';
  end if;
  if _organization_id is null then
    raise exception 'organization is required';
  end if;
  if _idempotency_key is null or length(trim(_idempotency_key)) < 8 then
    raise exception 'automatic portfolio idempotency key is required';
  end if;
  if jsonb_typeof(_jobs) <> 'array' then
    raise exception 'automatic portfolio jobs must be a JSON array';
  end if;

  select s.* into v_setting
  from public.publishing_automation_settings s
  where s.organization_id = _organization_id
  for update;

  if v_setting.organization_id is null
     or v_setting.enabled <> true
     or v_setting.pilot_approved_at is null then
    raise exception 'automatic portfolio production is not enabled and pilot-approved';
  end if;
  if v_setting.concurrency <> 4 then
    raise exception 'automatic portfolio concurrency must be four';
  end if;
  if v_setting.enabled_by is null or not exists (
    select 1
    from public.organization_memberships m
    where m.organization_id = _organization_id
      and m.user_id = v_setting.enabled_by
      and m.role in ('OWNER','ADMIN')
  ) then
    raise exception 'automatic portfolio enablement actor is not authorized';
  end if;

  select r.id into v_existing_run_id
  from public.publishing_production_runs r
  where r.organization_id = _organization_id
    and r.idempotency_key = trim(_idempotency_key)
  limit 1;

  if v_existing_run_id is not null then
    return v_existing_run_id;
  end if;

  select count(*) into v_eligible_count
  from jsonb_array_elements(_jobs) as entry(item)
  where nullif(entry.item #>> '{job,bookId}', '') is not null
    and nullif(entry.item #>> '{job,edition}', '') is not null
    and nullif(entry.item #>> '{job,revision}', '') is not null
    and nullif(entry.item ->> 'curriculumText', '') is not null
    and not exists (
      select 1
      from public.publishing_publications p
      where p.organization_id = _organization_id
        and p.book_id = entry.item #>> '{job,bookId}'
        and p.edition = entry.item #>> '{job,edition}'
        and p.revision = entry.item #>> '{job,revision}'
        and p.status = 'RELEASED'
    );

  if v_eligible_count = 0 then
    return null;
  end if;

  insert into public.publishing_production_runs (
    organization_id, created_by, scope_type, scope_value, status,
    requested_concurrency, planned_count, idempotency_key
  ) values (
    _organization_id,
    v_setting.enabled_by,
    'PORTFOLIO',
    jsonb_build_object('automatic', true),
    'QUEUED',
    4,
    v_eligible_count,
    trim(_idempotency_key)
  )
  on conflict (organization_id, idempotency_key) where idempotency_key is not null
  do nothing
  returning id into v_run_id;

  if v_run_id is null then
    select r.id into v_run_id
    from public.publishing_production_runs r
    where r.organization_id = _organization_id
      and r.idempotency_key = trim(_idempotency_key)
    limit 1;
    return v_run_id;
  end if;

  insert into public.publishing_production_jobs (
    organization_id,
    production_run_id,
    book_id,
    programme_code,
    subject_code,
    academic_period,
    edition,
    revision,
    book_job_payload,
    curriculum_text,
    status
  )
  select
    _organization_id,
    v_run_id,
    entry.item #>> '{job,bookId}',
    entry.item #>> '{job,programmeCode}',
    entry.item #>> '{job,subjectCode}',
    nullif(entry.item #>> '{job,academicPeriod}', ''),
    entry.item #>> '{job,edition}',
    entry.item #>> '{job,revision}',
    entry.item -> 'job',
    entry.item ->> 'curriculumText',
    'QUEUED'
  from jsonb_array_elements(_jobs) as entry(item)
  where nullif(entry.item #>> '{job,bookId}', '') is not null
    and nullif(entry.item #>> '{job,programmeCode}', '') is not null
    and nullif(entry.item #>> '{job,subjectCode}', '') is not null
    and nullif(entry.item #>> '{job,edition}', '') is not null
    and nullif(entry.item #>> '{job,revision}', '') is not null
    and nullif(entry.item ->> 'curriculumText', '') is not null
    and not exists (
      select 1
      from public.publishing_publications p
      where p.organization_id = _organization_id
        and p.book_id = entry.item #>> '{job,bookId}'
        and p.edition = entry.item #>> '{job,edition}'
        and p.revision = entry.item #>> '{job,revision}'
        and p.status = 'RELEASED'
    )
  on conflict (production_run_id, book_id, edition, revision) do nothing;

  perform public.refresh_publishing_run_summary(v_run_id);
  return v_run_id;
end;
$$;

revoke execute on function public.bootstrap_publishing_auto_portfolio(uuid, text, jsonb) from public;
revoke execute on function public.bootstrap_publishing_auto_portfolio(uuid, text, jsonb) from anon;
revoke execute on function public.bootstrap_publishing_auto_portfolio(uuid, text, jsonb) from authenticated;
grant execute on function public.bootstrap_publishing_auto_portfolio(uuid, text, jsonb) to service_role;
