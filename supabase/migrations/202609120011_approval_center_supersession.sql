create or replace function public.supersede_target_approvals(
  _organization_id uuid,
  _target_type text,
  _target_id uuid,
  _reason text
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer := 0;
begin
  if _organization_id is null
     or _target_id is null
     or upper(coalesce(_target_type, '')) not in ('CONTENT_ARTIFACT','MEDIA_ASSET')
     or nullif(btrim(coalesce(_reason, '')), '') is null then
    raise exception 'invalid approval supersession input';
  end if;

  with transitioned as (
    update public.approval_requests as r
    set
      status = 'SUPERSEDED',
      superseded_at = now(),
      superseded_reason = left(btrim(_reason), 2000),
      updated_at = now()
    where r.organization_id = _organization_id
      and r.target_type = upper(_target_type)
      and r.target_id = _target_id
      and r.status in ('PENDING','CHANGES_REQUESTED','APPROVED')
    returning r.id, r.organization_id, r.target_revision, r.target_checksum
  ), inserted as (
    insert into public.approval_events (
      organization_id,
      approval_request_id,
      actor_kind,
      actor_user_id,
      event_type,
      comment,
      target_revision,
      target_checksum
    )
    select
      t.organization_id,
      t.id,
      'SYSTEM',
      null,
      'SUPERSEDED',
      left(btrim(_reason), 2000),
      t.target_revision,
      t.target_checksum
    from transitioned t
    returning id
  )
  select count(*)::integer into v_count from inserted;

  return v_count;
end;
$$;

revoke all on function public.supersede_target_approvals(uuid, text, uuid, text) from public;
revoke all on function public.supersede_target_approvals(uuid, text, uuid, text) from anon;
revoke all on function public.supersede_target_approvals(uuid, text, uuid, text) from authenticated;

create or replace function public.supersede_content_artifact_approvals()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.revision is distinct from new.revision
     or old.status is distinct from new.status
     or old.script_text is distinct from new.script_text then
    perform public.supersede_target_approvals(
      new.organization_id,
      'CONTENT_ARTIFACT',
      new.id,
      'CONTENT_ARTIFACT_CHANGED'
    );
  end if;
  return new;
end;
$$;

revoke all on function public.supersede_content_artifact_approvals() from public;
revoke all on function public.supersede_content_artifact_approvals() from anon;
revoke all on function public.supersede_content_artifact_approvals() from authenticated;

drop trigger if exists content_artifact_approval_supersession on public.content_script_artifacts;
create trigger content_artifact_approval_supersession
after update of revision, status, script_text
on public.content_script_artifacts
for each row
execute function public.supersede_content_artifact_approvals();

create or replace function public.supersede_media_asset_approvals()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.status is distinct from new.status
     or old.checksum is distinct from new.checksum then
    perform public.supersede_target_approvals(
      new.organization_id,
      'MEDIA_ASSET',
      new.id,
      'MEDIA_ASSET_CHANGED'
    );
  end if;
  return new;
end;
$$;

revoke all on function public.supersede_media_asset_approvals() from public;
revoke all on function public.supersede_media_asset_approvals() from anon;
revoke all on function public.supersede_media_asset_approvals() from authenticated;

drop trigger if exists media_asset_approval_supersession on public.media_assets;
create trigger media_asset_approval_supersession
after update of status, checksum
on public.media_assets
for each row
execute function public.supersede_media_asset_approvals();

create or replace function public.is_target_currently_approved(
  _organization_id uuid,
  _target_type text,
  _target_id uuid,
  _target_revision integer default null,
  _target_checksum text default null
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_type text := upper(coalesce(_target_type, ''));
begin
  if auth.uid() is null
     or _organization_id is null
     or _target_id is null
     or not public.is_org_member(_organization_id) then
    return false;
  end if;

  if v_type = 'CONTENT_ARTIFACT' then
    if _target_revision is null or _target_checksum is not null then
      return false;
    end if;

    return exists (
      select 1
      from public.content_script_artifacts a
      join public.approval_requests r
        on r.organization_id = a.organization_id
       and r.target_type = 'CONTENT_ARTIFACT'
       and r.target_id = a.id
       and r.target_revision = a.revision
      where a.id = _target_id
        and a.organization_id = _organization_id
        and a.revision = _target_revision
        and a.status = 'GENERATED'
        and nullif(btrim(a.script_text), '') is not null
        and r.status = 'APPROVED'
    );
  elsif v_type = 'MEDIA_ASSET' then
    if _target_revision is not null or nullif(btrim(coalesce(_target_checksum, '')), '') is null then
      return false;
    end if;

    return exists (
      select 1
      from public.media_assets m
      join public.approval_requests r
        on r.organization_id = m.organization_id
       and r.target_type = 'MEDIA_ASSET'
       and r.target_id = m.id
       and r.target_checksum = m.checksum
      where m.id = _target_id
        and m.organization_id = _organization_id
        and m.checksum = _target_checksum
        and m.status = 'ACTIVE'
        and nullif(btrim(m.checksum), '') is not null
        and r.status = 'APPROVED'
    );
  end if;

  return false;
end;
$$;

revoke all on function public.is_target_currently_approved(uuid, text, uuid, integer, text) from public;
revoke all on function public.is_target_currently_approved(uuid, text, uuid, integer, text) from anon;
revoke all on function public.is_target_currently_approved(uuid, text, uuid, integer, text) from authenticated;
grant execute on function public.is_target_currently_approved(uuid, text, uuid, integer, text) to authenticated;
