revoke all privileges on table public.organization_profiles from anon;
revoke all privileges on table public.organization_profiles from authenticated;
grant select, update on table public.organization_profiles to authenticated;

revoke all privileges on table public.organization_brand_kits from anon;
revoke all privileges on table public.organization_brand_kits from authenticated;
grant select, update on table public.organization_brand_kits to authenticated;

revoke all privileges on table public.brand_kit_media_assets from anon;
revoke all privileges on table public.brand_kit_media_assets from authenticated;
grant select, insert, update, delete on table public.brand_kit_media_assets to authenticated;

revoke all privileges on table public.content_item_identity_provenance from anon;
revoke all privileges on table public.content_item_identity_provenance from authenticated;
grant select on table public.content_item_identity_provenance to authenticated;

revoke all privileges on table public.content_item_knowledge_sources from anon;
revoke all privileges on table public.content_item_knowledge_sources from authenticated;
grant select on table public.content_item_knowledge_sources to authenticated;
