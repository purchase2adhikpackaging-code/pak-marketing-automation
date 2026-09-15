-- Phase 9 release hardening: preserve approval audit semantics when reviewed media is deleted.
-- Approval history remains immutable; pending/approved usability is retired before the target disappears.

create or replace function public.supersede_media_asset_approvals_before_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.supersede_target_approvals(
    old.organization_id,
    'MEDIA_ASSET',
    old.id,
    'media_asset_deleted'
  );

  return old;
end;
$$;

revoke all on function public.supersede_media_asset_approvals_before_delete() from public;
revoke all on function public.supersede_media_asset_approvals_before_delete() from anon;
revoke all on function public.supersede_media_asset_approvals_before_delete() from authenticated;

drop trigger if exists trg_media_assets_supersede_approvals_before_delete on public.media_assets;
create trigger trg_media_assets_supersede_approvals_before_delete
before delete on public.media_assets
for each row
execute function public.supersede_media_asset_approvals_before_delete();
