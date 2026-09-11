create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

-- One internal dispatch credential, encrypted by Supabase Vault. The plaintext value
-- is generated inside Postgres and is never committed to source control.
do $$
begin
  if not exists (
    select 1
    from vault.secrets
    where name = 'pak/video-generation/dispatcher'
  ) then
    perform vault.create_secret(
      encode(extensions.gen_random_bytes(32), 'hex'),
      'pak/video-generation/dispatcher',
      'Internal credential for unattended Phase 7 video-generation dispatch.',
      null
    );
  end if;
end;
$$;

create or replace function public.read_video_generation_dispatch_secret()
returns text
language sql
security definer
stable
set search_path = public, vault
as $$
  select decrypted_secret
  from vault.decrypted_secrets
  where name = 'pak/video-generation/dispatcher'
  limit 1;
$$;

revoke all on function public.read_video_generation_dispatch_secret() from public;
revoke all on function public.read_video_generation_dispatch_secret() from anon;
revoke all on function public.read_video_generation_dispatch_secret() from authenticated;
grant execute on function public.read_video_generation_dispatch_secret() to service_role;

create or replace function public.claim_due_video_generation_dispatch(
  _worker_id text,
  _batch_size integer default 10,
  _lease_seconds integer default 120
)
returns table (
  organization_id uuid,
  job_id uuid,
  attempt_id uuid,
  action text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if _worker_id is null or btrim(_worker_id) = '' then
    raise exception 'worker id is required';
  end if;

  if _batch_size < 1 or _batch_size > 20 then
    raise exception 'dispatch batch size must be between 1 and 20';
  end if;

  if _lease_seconds < 30 or _lease_seconds > 900 then
    raise exception 'dispatch lease must be between 30 and 900 seconds';
  end if;

  return query
  with candidates as (
    select
      a.organization_id,
      j.id as job_id,
      a.id as attempt_id,
      case
        when a.state = 'QUEUED' then 'SUBMIT'
        when a.state in ('SUBMITTED', 'PROCESSING', 'IMPORT_PENDING') then 'RECONCILE'
        else 'RETRY'
      end as action
    from public.jobs j
    join public.video_generation_attempts a
      on a.job_id = j.id
     and a.organization_id = j.organization_id
    where j.job_type = 'VIDEO_SHOT_GENERATION'
      and (j.lease_expires_at is null or j.lease_expires_at <= now())
      and not exists (
        select 1
        from public.video_generation_attempts newer
        where newer.organization_id = a.organization_id
          and newer.job_id = a.job_id
          and newer.attempt_number > a.attempt_number
      )
      and (
        (
          a.state = 'QUEUED'
          and j.state in ('QUEUED', 'RETRYING', 'PROCESSING')
          and a.created_at <= now() - interval '5 seconds'
        )
        or (
          a.state in ('SUBMITTED', 'PROCESSING', 'IMPORT_PENDING')
          and j.state = 'PROCESSING'
          and (a.last_polled_at is null or a.last_polled_at <= now() - interval '5 seconds')
        )
        or (
          a.state = 'FAILED'
          and a.retryable is true
          and a.attempt_number < 4
          and j.state = 'FAILED'
          and a.terminal_at is not null
          and now() >= a.terminal_at + case a.attempt_number
            when 1 then interval '5 seconds'
            when 2 then interval '15 seconds'
            else interval '45 seconds'
          end
        )
      )
    order by coalesce(a.last_polled_at, a.terminal_at, a.created_at) asc, a.created_at asc
    for update of j skip locked
    limit least(_batch_size, 20)
  ), claimed as (
    update public.jobs j
    set lease_owner = _worker_id,
        lease_expires_at = now() + make_interval(secs => _lease_seconds),
        updated_at = now()
    from candidates c
    where j.id = c.job_id
      and j.organization_id = c.organization_id
    returning j.id
  )
  select c.organization_id, c.job_id, c.attempt_id, c.action
  from candidates c
  join claimed claimed_job on claimed_job.id = c.job_id;
end;
$$;

revoke all on function public.claim_due_video_generation_dispatch(text, integer, integer) from public;
revoke all on function public.claim_due_video_generation_dispatch(text, integer, integer) from anon;
revoke all on function public.claim_due_video_generation_dispatch(text, integer, integer) from authenticated;
grant execute on function public.claim_due_video_generation_dispatch(text, integer, integer) to service_role;
