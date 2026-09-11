drop policy if exists scene_plan_versions_update_reviewer on public.scene_plan_versions;
create policy scene_plan_versions_update_reviewer
on public.scene_plan_versions
for update
to authenticated
using (public.has_org_role(organization_id, array['REVIEWER']))
with check (public.has_org_role(organization_id, array['REVIEWER']));

create or replace function public.enforce_scene_plan_review_qc_and_approval_scope()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  blocker_count integer;
  reviewer_only boolean;
begin
  if new.status = 'REVIEW_REQUIRED' and old.status is distinct from new.status then
    if old.status not in ('DRAFT','QC_REQUIRED') then
      raise exception 'scene plan may enter review only from a fresh draft QC result or QC_REQUIRED';
    end if;

    if new.narration_coverage_hash is null then
      raise exception 'scene plan must pass current QC before review';
    end if;

    select count(*) into blocker_count
    from public.scene_plan_qc_findings
    where organization_id = old.organization_id
      and scene_plan_version_id = old.id
      and severity = 'BLOCKER';

    if blocker_count > 0 then
      raise exception 'scene plan must resolve blocker findings before review';
    end if;
  end if;

  if new.status = 'APPROVED' and old.status is distinct from new.status then
    if old.status <> 'REVIEW_REQUIRED' then
      raise exception 'scene plan may be approved only from REVIEW_REQUIRED';
    end if;

    if not public.has_org_role(old.organization_id, array['OWNER','ADMIN','REVIEWER']) then
      raise exception 'scene plan approval role required';
    end if;

    if new.approved_by is distinct from auth.uid() or new.approved_at is null then
      raise exception 'scene plan approval identity is invalid';
    end if;

    if new.narration_coverage_hash is null then
      raise exception 'scene plan must pass current QC before approval';
    end if;

    select count(*) into blocker_count
    from public.scene_plan_qc_findings
    where organization_id = old.organization_id
      and scene_plan_version_id = old.id
      and severity = 'BLOCKER';

    if blocker_count > 0 then
      raise exception 'scene plan must resolve blocker findings before approval';
    end if;
  end if;

  reviewer_only := public.has_org_role(old.organization_id, array['REVIEWER'])
    and not public.has_org_role(old.organization_id, array['OWNER','ADMIN','EDITOR']);

  if reviewer_only then
    if old.status <> 'REVIEW_REQUIRED'
      or new.status <> 'APPROVED'
      or new.organization_id is distinct from old.organization_id
      or new.video_project_id is distinct from old.video_project_id
      or new.version_number is distinct from old.version_number
      or new.source_integrity_hash is distinct from old.source_integrity_hash
      or new.parent_version_id is distinct from old.parent_version_id
      or new.planner_provider is distinct from old.planner_provider
      or new.planner_model is distinct from old.planner_model
      or new.creative_brief_snapshot is distinct from old.creative_brief_snapshot
      or new.visual_bible_snapshot is distinct from old.visual_bible_snapshot
      or new.canonical_narration is distinct from old.canonical_narration
      or new.language is distinct from old.language
      or new.aspect_ratio is distinct from old.aspect_ratio
      or new.total_duration_seconds is distinct from old.total_duration_seconds
      or new.narration_coverage_hash is distinct from old.narration_coverage_hash
      or new.qc_summary is distinct from old.qc_summary
      or new.created_by is distinct from old.created_by
      or new.created_at is distinct from old.created_at then
      raise exception 'reviewers may only approve a review-ready scene plan';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_scene_plan_review_qc_and_approval_scope() from public;
revoke all on function public.enforce_scene_plan_review_qc_and_approval_scope() from anon;
revoke all on function public.enforce_scene_plan_review_qc_and_approval_scope() from authenticated;

drop trigger if exists scene_plan_review_qc_and_approval_guard on public.scene_plan_versions;
create trigger scene_plan_review_qc_and_approval_guard
before update on public.scene_plan_versions
for each row execute function public.enforce_scene_plan_review_qc_and_approval_scope();
