create or replace function public.save_organization_brand_kit(
  _organization_id uuid,
  _expected_revision integer,
  _primary_color text default null,
  _secondary_color text default null,
  _accent_color text default null,
  _typography_rules text default null,
  _brand_voice text default null,
  _logo_usage_rules text default null,
  _visual_constraints text default null,
  _primary_logo_asset_id uuid default null,
  _light_logo_asset_id uuid default null,
  _dark_logo_asset_id uuid default null,
  _brand_mark_asset_id uuid default null,
  _favicon_asset_id uuid default null,
  _approved_imagery_asset_ids uuid[] default '{}'::uuid[]
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_revision integer;
  v_asset_ids uuid[];
begin
  if v_actor is null then
    raise exception 'authentication required';
  end if;
  if _organization_id is null or _expected_revision is null or _expected_revision < 1 then
    raise exception 'invalid Brand Kit save input';
  end if;
  if not public.has_org_role(_organization_id, array['OWNER','ADMIN']) then
    raise exception 'Brand Kit management permission required';
  end if;
  if coalesce(cardinality(_approved_imagery_asset_ids), 0) > 20 then
    raise exception 'too many approved imagery assets';
  end if;

  select revision into v_revision
  from public.organization_brand_kits
  where organization_id = _organization_id
  for update;

  if v_revision is null or v_revision <> _expected_revision then
    return null;
  end if;

  v_asset_ids := array_remove(array[
    _primary_logo_asset_id,
    _light_logo_asset_id,
    _dark_logo_asset_id,
    _brand_mark_asset_id,
    _favicon_asset_id
  ]::uuid[], null) || coalesce(_approved_imagery_asset_ids, '{}'::uuid[]);

  if exists (
    select 1
    from unnest(v_asset_ids) as candidate(asset_id)
    left join public.media_assets m on m.id = candidate.asset_id
    where m.id is null
       or m.organization_id <> _organization_id
       or m.status <> 'ACTIVE'
       or m.asset_type <> 'IMAGE'
       or m.mime_type not like 'image/%'
  ) then
    raise exception 'invalid Brand Kit media asset';
  end if;

  update public.organization_brand_kits
  set
    primary_color = _primary_color,
    secondary_color = _secondary_color,
    accent_color = _accent_color,
    typography_rules = _typography_rules,
    brand_voice = _brand_voice,
    logo_usage_rules = _logo_usage_rules,
    visual_constraints = _visual_constraints,
    revision = v_revision + 1,
    updated_by = v_actor,
    updated_at = now()
  where organization_id = _organization_id;

  delete from public.brand_kit_media_assets
  where organization_id = _organization_id;

  insert into public.brand_kit_media_assets (
    organization_id,
    role,
    media_asset_id,
    sort_order,
    created_by
  )
  select _organization_id, assignment.role, assignment.media_asset_id, assignment.sort_order, v_actor
  from (
    values
      ('PRIMARY_LOGO'::text, _primary_logo_asset_id, 10),
      ('LIGHT_LOGO'::text, _light_logo_asset_id, 20),
      ('DARK_LOGO'::text, _dark_logo_asset_id, 30),
      ('BRAND_MARK'::text, _brand_mark_asset_id, 40),
      ('FAVICON'::text, _favicon_asset_id, 50)
  ) as assignment(role, media_asset_id, sort_order)
  where assignment.media_asset_id is not null;

  insert into public.brand_kit_media_assets (
    organization_id,
    role,
    media_asset_id,
    sort_order,
    created_by
  )
  select
    _organization_id,
    'APPROVED_IMAGERY',
    dedup.media_asset_id,
    1000 + dedup.first_position,
    v_actor
  from (
    select media_asset_id, min(position)::integer as first_position
    from unnest(coalesce(_approved_imagery_asset_ids, '{}'::uuid[]))
      with ordinality as imagery(media_asset_id, position)
    group by media_asset_id
  ) as dedup
  order by dedup.first_position, dedup.media_asset_id;

  return v_revision + 1;
end;
$$;

revoke all on function public.save_organization_brand_kit(
  uuid, integer, text, text, text, text, text, text, text,
  uuid, uuid, uuid, uuid, uuid, uuid[]
) from public;
revoke all on function public.save_organization_brand_kit(
  uuid, integer, text, text, text, text, text, text, text,
  uuid, uuid, uuid, uuid, uuid, uuid[]
) from anon;
revoke all on function public.save_organization_brand_kit(
  uuid, integer, text, text, text, text, text, text, text,
  uuid, uuid, uuid, uuid, uuid, uuid[]
) from authenticated;
grant execute on function public.save_organization_brand_kit(
  uuid, integer, text, text, text, text, text, text, text,
  uuid, uuid, uuid, uuid, uuid, uuid[]
) to authenticated;
