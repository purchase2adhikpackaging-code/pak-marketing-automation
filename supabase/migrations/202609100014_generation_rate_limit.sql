create table if not exists public.generation_rate_windows (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  actor_user_id uuid not null references auth.users(id) on delete cascade,
  window_start timestamptz not null,
  request_count integer not null default 1 check (request_count > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (organization_id, actor_user_id, window_start)
);

alter table public.generation_rate_windows enable row level security;

revoke all on table public.generation_rate_windows from public;
revoke all on table public.generation_rate_windows from anon;
revoke all on table public.generation_rate_windows from authenticated;

create or replace function public.consume_generation_quota(
  _organization_id uuid,
  _actor_user_id uuid,
  _window_seconds integer,
  _request_limit integer
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  window_start_value timestamptz;
  count_value integer;
begin
  if _window_seconds < 60 or _window_seconds > 3600 then
    raise exception 'generation quota window is outside the allowed range';
  end if;

  if _request_limit < 1 or _request_limit > 100 then
    raise exception 'generation quota request limit is outside the allowed range';
  end if;

  if not exists (
    select 1
    from public.organization_memberships m
    where m.organization_id = _organization_id
      and m.user_id = _actor_user_id
      and m.role in ('OWNER','ADMIN','EDITOR')
  ) then
    raise exception 'actor is not authorized to generate content';
  end if;

  window_start_value := to_timestamp(
    floor(extract(epoch from clock_timestamp()) / _window_seconds) * _window_seconds
  );

  insert into public.generation_rate_windows (
    organization_id,
    actor_user_id,
    window_start,
    request_count,
    created_at,
    updated_at
  ) values (
    _organization_id,
    _actor_user_id,
    window_start_value,
    1,
    now(),
    now()
  )
  on conflict (organization_id, actor_user_id, window_start)
  do update set
    request_count = public.generation_rate_windows.request_count + 1,
    updated_at = now()
  returning request_count into count_value;

  return count_value <= _request_limit;
end;
$$;

revoke all on function public.consume_generation_quota(uuid,uuid,integer,integer) from public;
revoke all on function public.consume_generation_quota(uuid,uuid,integer,integer) from anon;
revoke all on function public.consume_generation_quota(uuid,uuid,integer,integer) from authenticated;
grant execute on function public.consume_generation_quota(uuid,uuid,integer,integer) to service_role;
