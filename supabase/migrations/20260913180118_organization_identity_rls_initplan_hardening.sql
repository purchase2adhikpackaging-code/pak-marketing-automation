drop policy if exists brand_kit_media_assets_insert_admin on public.brand_kit_media_assets;
create policy brand_kit_media_assets_insert_admin
on public.brand_kit_media_assets
for insert
to authenticated
with check (
  public.has_org_role(organization_id, array['OWNER','ADMIN'])
  and created_by = (select auth.uid())
);

drop policy if exists knowledge_documents_insert_manager on public.knowledge_documents;
create policy knowledge_documents_insert_manager
on public.knowledge_documents
for insert
to authenticated
with check (
  public.has_org_role(organization_id, array['OWNER','ADMIN','EDITOR'])
  and revision = 1
  and extraction_status = 'PENDING'
  and created_by = (select auth.uid())
  and updated_by = (select auth.uid())
);
