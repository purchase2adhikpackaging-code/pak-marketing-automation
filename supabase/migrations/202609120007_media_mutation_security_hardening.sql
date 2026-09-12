drop policy if exists media_assets_delete_admin on public.media_assets;
drop policy if exists media_assets_update_editor on public.media_assets;

revoke all privileges on table public.media_assets from anon;
revoke insert, delete, update on table public.media_assets from authenticated;
grant select on table public.media_assets to authenticated;
grant update (status, archived_at, archived_by, updated_at)
  on table public.media_assets to authenticated;

create policy media_assets_archive_editor
on public.media_assets
for update
to authenticated
using (
  public.has_org_role(organization_id, array['OWNER','ADMIN','EDITOR'])
  and status = 'ACTIVE'
)
with check (
  public.has_org_role(organization_id, array['OWNER','ADMIN','EDITOR'])
  and status = 'ARCHIVED'
  and archived_at is not null
  and archived_by = auth.uid()
);

revoke all privileges on table public.video_assemblies from anon;
revoke insert, update, delete on table public.video_assemblies from authenticated;
grant select on table public.video_assemblies to authenticated;

revoke all privileges on table public.video_assembly_components from anon;
revoke insert, update, delete on table public.video_assembly_components from authenticated;
grant select on table public.video_assembly_components to authenticated;

revoke all privileges on table public.media_upload_sessions from anon;
revoke insert, update, delete on table public.media_upload_sessions from authenticated;
grant select on table public.media_upload_sessions to authenticated;
