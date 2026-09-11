-- Phase 6 production hardening from live Supabase database advisor findings.
-- Keep one permissive UPDATE policy for authenticated members and let the
-- lifecycle/reviewer triggers constrain role-specific mutations.
drop policy if exists scene_plan_versions_update_reviewer on public.scene_plan_versions;
drop policy if exists scene_plan_versions_update_editor on public.scene_plan_versions;
create policy scene_plan_versions_update_editor
on public.scene_plan_versions
for update
to authenticated
using (public.has_org_role(organization_id, array['OWNER','ADMIN','EDITOR','REVIEWER']))
with check (public.has_org_role(organization_id, array['OWNER','ADMIN','EDITOR','REVIEWER']));

-- Avoid per-row auth.uid() re-evaluation in insert policies.
drop policy if exists video_projects_insert_editor on public.video_projects;
create policy video_projects_insert_editor
on public.video_projects
for insert
to authenticated
with check (
  public.has_org_role(organization_id, array['OWNER','ADMIN','EDITOR'])
  and (created_by is null or created_by = (select auth.uid()))
);

drop policy if exists scene_plan_versions_insert_editor on public.scene_plan_versions;
create policy scene_plan_versions_insert_editor
on public.scene_plan_versions
for insert
to authenticated
with check (
  public.has_org_role(organization_id, array['OWNER','ADMIN','EDITOR'])
  and (created_by is null or created_by = (select auth.uid()))
);

-- Cover foreign-key access paths reported by the live database advisor.
create index if not exists video_projects_source_content_id_idx
  on public.video_projects (source_content_id);
create index if not exists video_projects_source_artifact_id_only_idx
  on public.video_projects (source_artifact_id);
create index if not exists video_projects_created_by_idx
  on public.video_projects (created_by);

create index if not exists visual_bibles_created_by_idx
  on public.visual_bibles (created_by);

create index if not exists scene_plan_versions_parent_version_id_idx
  on public.scene_plan_versions (parent_version_id);
create index if not exists scene_plan_versions_created_by_idx
  on public.scene_plan_versions (created_by);
create index if not exists scene_plan_versions_approved_by_idx
  on public.scene_plan_versions (approved_by);

create index if not exists scene_plan_qc_version_id_idx
  on public.scene_plan_qc_findings (scene_plan_version_id);
create index if not exists scene_plan_qc_scene_id_idx
  on public.scene_plan_qc_findings (scene_id);
create index if not exists scene_plan_qc_shot_id_idx
  on public.scene_plan_qc_findings (shot_id);
create index if not exists scene_plan_qc_acknowledged_by_idx
  on public.scene_plan_qc_findings (acknowledged_by);
