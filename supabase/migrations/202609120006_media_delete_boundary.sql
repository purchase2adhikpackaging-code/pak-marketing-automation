create or replace function public.delete_media_asset_if_unreferenced(
  _organization_id uuid,
  _media_asset_id uuid,
  _actor_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_media public.media_assets%rowtype;
begin
  if _organization_id is null or _media_asset_id is null or _actor_user_id is null then
    raise exception 'invalid media delete input';
  end if;

  if not exists (
    select 1
    from public.organization_memberships m
    where m.organization_id = _organization_id
      and m.user_id = _actor_user_id
      and m.role in ('OWNER','ADMIN')
  ) then
    raise exception 'forbidden';
  end if;

  select * into v_media
  from public.media_assets
  where id = _media_asset_id
    and organization_id = _organization_id
  for update;

  if v_media.id is null then
    raise exception 'media asset not found';
  end if;

  if exists (
    select 1
    from public.video_generation_attempts a
    where a.organization_id = _organization_id
      and a.media_asset_id = _media_asset_id
  ) or exists (
    select 1
    from public.video_assembly_components c
    where c.organization_id = _organization_id
      and c.media_asset_id = _media_asset_id
  ) or exists (
    select 1
    from public.video_assemblies a
    where a.organization_id = _organization_id
      and a.final_media_asset_id = _media_asset_id
  ) then
    raise exception 'media asset is retained by active generation lineage';
  end if;

  delete from public.media_assets
  where id = _media_asset_id
    and organization_id = _organization_id;

  return jsonb_build_object(
    'mediaAssetId', v_media.id,
    'storageBucket', v_media.storage_bucket,
    'storagePath', v_media.storage_path
  );
end;
$$;

revoke all on function public.delete_media_asset_if_unreferenced(uuid, uuid, uuid) from public;
revoke all on function public.delete_media_asset_if_unreferenced(uuid, uuid, uuid) from anon;
revoke all on function public.delete_media_asset_if_unreferenced(uuid, uuid, uuid) from authenticated;
grant execute on function public.delete_media_asset_if_unreferenced(uuid, uuid, uuid) to service_role;
