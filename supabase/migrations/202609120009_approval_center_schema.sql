create table public.approval_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  target_type text not null check (target_type in ('CONTENT_ARTIFACT','MEDIA_ASSET')),
  target_id uuid not null,
  target_revision integer,
  target_checksum text,
  target_fingerprint text not null,
  target_snapshot jsonb not null,
  publication_intent jsonb not null default '{}'::jsonb,
  status text not null default 'PENDING'
    check (status in ('PENDING','CHANGES_REQUESTED','APPROVED','REJECTED','SUPERSEDED')),
  requested_by uuid references auth.users(id) on delete set null,
  requested_at timestamptz not null default now(),
  decided_by uuid references auth.users(id) on delete set null,
  decided_at timestamptz,
  superseded_at timestamptz,
  superseded_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, target_type, target_fingerprint),
  check (target_revision is null or target_revision >= 1),
  check (
    (target_type = 'CONTENT_ARTIFACT' and target_revision is not null and target_checksum is null)
    or
    (target_type = 'MEDIA_ASSET' and target_revision is null and target_checksum is not null and btrim(target_checksum) <> '')
  ),
  check (jsonb_typeof(target_snapshot) = 'object'),
  check (jsonb_typeof(publication_intent) = 'object'),
  check (octet_length(publication_intent::text) <= 8192),
  check (
    (status = 'PENDING' and decided_by is null and decided_at is null and superseded_at is null and superseded_reason is null)
    or
    (status in ('APPROVED','CHANGES_REQUESTED','REJECTED') and decided_at is not null)
    or
    (status = 'SUPERSEDED' and superseded_at is not null and superseded_reason is not null and btrim(superseded_reason) <> '')
  )
);

create table public.approval_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  approval_request_id uuid not null references public.approval_requests(id) on delete cascade,
  actor_kind text not null check (actor_kind in ('USER','SYSTEM')),
  actor_user_id uuid references auth.users(id) on delete set null,
  event_type text not null
    check (event_type in ('SUBMITTED','APPROVED','CHANGES_REQUESTED','REJECTED','SUPERSEDED')),
  comment text,
  target_revision integer,
  target_checksum text,
  created_at timestamptz not null default now(),
  check ((actor_kind = 'USER' and actor_user_id is not null) or actor_kind = 'SYSTEM'),
  check (comment is null or char_length(comment) <= 2000),
  check (
    event_type not in ('CHANGES_REQUESTED','REJECTED')
    or (comment is not null and char_length(btrim(comment)) between 1 and 2000)
  )
);

create index approval_requests_queue_idx
  on public.approval_requests (organization_id, status, requested_at desc, id);

create index approval_events_history_idx
  on public.approval_events (approval_request_id, created_at, id);

create or replace function public.guard_approval_request_identity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.organization_id is distinct from new.organization_id
    or old.target_type is distinct from new.target_type
    or old.target_id is distinct from new.target_id
    or old.target_revision is distinct from new.target_revision
    or old.target_checksum is distinct from new.target_checksum
    or old.target_fingerprint is distinct from new.target_fingerprint
    or old.target_snapshot is distinct from new.target_snapshot
    or old.publication_intent is distinct from new.publication_intent
    or old.requested_by is distinct from new.requested_by
    or old.requested_at is distinct from new.requested_at
    or old.created_at is distinct from new.created_at then
    raise exception 'approval request identity is immutable';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

revoke all on function public.guard_approval_request_identity() from public;
revoke all on function public.guard_approval_request_identity() from anon;
revoke all on function public.guard_approval_request_identity() from authenticated;

create trigger approval_requests_identity_guard
before update on public.approval_requests
for each row execute function public.guard_approval_request_identity();

create or replace function public.guard_approval_event_parent()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.approval_requests%rowtype;
begin
  select * into v_request
  from public.approval_requests
  where id = new.approval_request_id;

  if v_request.id is null then
    raise exception 'approval request is unavailable';
  end if;

  if new.organization_id <> v_request.organization_id then
    raise exception 'approval event organization mismatch';
  end if;

  if new.target_revision is distinct from v_request.target_revision
    or new.target_checksum is distinct from v_request.target_checksum then
    raise exception 'approval event target identity mismatch';
  end if;

  return new;
end;
$$;

revoke all on function public.guard_approval_event_parent() from public;
revoke all on function public.guard_approval_event_parent() from anon;
revoke all on function public.guard_approval_event_parent() from authenticated;

create trigger approval_events_parent_guard
before insert on public.approval_events
for each row execute function public.guard_approval_event_parent();

create or replace function public.prevent_approval_event_mutation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  raise exception 'approval events are immutable';
end;
$$;

revoke all on function public.prevent_approval_event_mutation() from public;
revoke all on function public.prevent_approval_event_mutation() from anon;
revoke all on function public.prevent_approval_event_mutation() from authenticated;

create trigger approval_events_immutable
before update or delete on public.approval_events
for each row execute function public.prevent_approval_event_mutation();

alter table public.approval_requests enable row level security;
alter table public.approval_events enable row level security;

create policy approval_requests_select_review_roles
on public.approval_requests
for select
to authenticated
using (public.has_org_role(organization_id, array['OWNER','ADMIN','EDITOR','REVIEWER']));

create policy approval_events_select_review_roles
on public.approval_events
for select
to authenticated
using (public.has_org_role(organization_id, array['OWNER','ADMIN','EDITOR','REVIEWER']));

revoke all privileges on table public.approval_requests from anon;
revoke all privileges on table public.approval_events from anon;

revoke insert, update, delete on table public.approval_requests from authenticated;
revoke insert, update, delete on table public.approval_events from authenticated;

grant select on table public.approval_requests to authenticated;
grant select on table public.approval_events to authenticated;
