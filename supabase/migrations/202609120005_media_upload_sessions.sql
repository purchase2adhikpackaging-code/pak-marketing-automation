insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit
) values (
  'media-library',
  'media-library',
  false,
  536870912
)
on conflict (id) do update
set
  public = false,
  file_size_limit = excluded.file_size_limit;

create table if not exists public.media_upload_sessions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete restrict,
  asset_type text not null check (asset_type in ('IMAGE','VIDEO','AUDIO','DOCUMENT')),
  original_filename text not null,
  normalized_filename text not null,
  display_name text,
  expected_storage_path text not null,
  expected_mime_type text not null,
  expected_size_bytes bigint not null check (expected_size_bytes > 0 and expected_size_bytes <= 536870912),
  state text not null default 'ISSUED' check (state in ('ISSUED','FINALIZED','EXPIRED','FAILED')),
  media_asset_id uuid references public.media_assets(id) on delete set null,
  expires_at timestamptz not null,
  finalized_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, expected_storage_path)
);

create index if not exists media_upload_sessions_org_created_idx
  on public.media_upload_sessions(organization_id, created_at desc);
create index if not exists media_upload_sessions_org_state_expiry_idx
  on public.media_upload_sessions(organization_id, state, expires_at);
create index if not exists media_upload_sessions_created_by_idx
  on public.media_upload_sessions(created_by, created_at desc);

alter table public.media_upload_sessions enable row level security;

create policy media_upload_sessions_select_member
on public.media_upload_sessions
for select
to authenticated
using (public.is_org_member(organization_id));

-- Authoritative upload media rows are created only by the trusted Edge/service-role
-- finalization boundary. Authenticated clients cannot fabricate UPLOAD lineage directly.
drop policy if exists media_assets_insert_editor on public.media_assets;

create or replace function public.finalize_media_upload_session(
  _organization_id uuid,
  _session_id uuid,
  _actor_user_id uuid,
  _actual_mime_type text,
  _actual_size_bytes bigint
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.media_upload_sessions%rowtype;
  v_media_id uuid;
  v_now timestamptz := now();
begin
  if _organization_id is null
     or _session_id is null
     or _actor_user_id is null
     or _actual_mime_type is null
     or btrim(_actual_mime_type) = ''
     or _actual_size_bytes is null
     or _actual_size_bytes <= 0 then
    raise exception 'invalid media upload finalization input';
  end if;

  if not exists (
    select 1
    from public.organization_memberships m
    where m.organization_id = _organization_id
      and m.user_id = _actor_user_id
      and m.role in ('OWNER','ADMIN','EDITOR')
  ) then
    raise exception 'forbidden';
  end if;

  select * into v_session
  from public.media_upload_sessions
  where id = _session_id
    and organization_id = _organization_id
  for update;

  if v_session.id is null then
    raise exception 'media upload session not found';
  end if;

  if v_session.state = 'FINALIZED' and v_session.media_asset_id is not null then
    return v_session.media_asset_id;
  end if;

  if v_session.state <> 'ISSUED' then
    raise exception 'media upload session is not finalizable';
  end if;

  if v_session.expires_at <= v_now then
    raise exception 'media upload session expired';
  end if;

  if lower(v_session.expected_mime_type) <> lower(_actual_mime_type)
     or v_session.expected_size_bytes <> _actual_size_bytes then
    raise exception 'uploaded object metadata does not match issued session';
  end if;

  if v_session.expected_storage_path not like (_organization_id::text || '/uploads/' || _session_id::text || '/%') then
    raise exception 'media upload storage lineage mismatch';
  end if;

  insert into public.media_assets (
    organization_id,
    asset_type,
    storage_bucket,
    storage_path,
    source,
    mime_type,
    status,
    display_name,
    size_bytes,
    metadata,
    created_by,
    created_at,
    updated_at
  ) values (
    _organization_id,
    v_session.asset_type,
    'media-library',
    v_session.expected_storage_path,
    'UPLOAD',
    _actual_mime_type,
    'ACTIVE',
    coalesce(nullif(btrim(v_session.display_name), ''), v_session.original_filename),
    _actual_size_bytes,
    jsonb_build_object(
      'uploadSessionId', v_session.id,
      'originalFilename', v_session.original_filename
    ),
    _actor_user_id,
    v_now,
    v_now
  )
  on conflict (organization_id, storage_bucket, storage_path) do update
  set
    mime_type = excluded.mime_type,
    status = 'ACTIVE',
    display_name = excluded.display_name,
    size_bytes = excluded.size_bytes,
    metadata = excluded.metadata,
    updated_at = v_now
  returning id into v_media_id;

  update public.media_upload_sessions
  set state = 'FINALIZED',
      media_asset_id = v_media_id,
      finalized_at = v_now,
      updated_at = v_now
  where id = _session_id
    and organization_id = _organization_id;

  return v_media_id;
end;
$$;

revoke all on function public.finalize_media_upload_session(uuid, uuid, uuid, text, bigint) from public;
revoke all on function public.finalize_media_upload_session(uuid, uuid, uuid, text, bigint) from anon;
revoke all on function public.finalize_media_upload_session(uuid, uuid, uuid, text, bigint) from authenticated;
grant execute on function public.finalize_media_upload_session(uuid, uuid, uuid, text, bigint) to service_role;
