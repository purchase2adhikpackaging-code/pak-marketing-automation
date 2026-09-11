create or replace function public.enforce_scene_plan_approved_immutability()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if old.status <> 'APPROVED' then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  if tg_op = 'DELETE' then
    raise exception 'approved scene plan versions are immutable';
  end if;

  if new.status in ('STALE','SUPERSEDED')
    and new.organization_id is not distinct from old.organization_id
    and new.video_project_id is not distinct from old.video_project_id
    and new.version_number is not distinct from old.version_number
    and new.source_integrity_hash is not distinct from old.source_integrity_hash
    and new.parent_version_id is not distinct from old.parent_version_id
    and new.planner_provider is not distinct from old.planner_provider
    and new.planner_model is not distinct from old.planner_model
    and new.creative_brief_snapshot is not distinct from old.creative_brief_snapshot
    and new.visual_bible_snapshot is not distinct from old.visual_bible_snapshot
    and new.canonical_narration is not distinct from old.canonical_narration
    and new.language is not distinct from old.language
    and new.aspect_ratio is not distinct from old.aspect_ratio
    and new.total_duration_seconds is not distinct from old.total_duration_seconds
    and new.narration_coverage_hash is not distinct from old.narration_coverage_hash
    and new.qc_summary is not distinct from old.qc_summary
    and new.created_by is not distinct from old.created_by
    and new.approved_by is not distinct from old.approved_by
    and new.approved_at is not distinct from old.approved_at
    and new.created_at is not distinct from old.created_at then
    return new;
  end if;

  raise exception 'approved scene plan versions are immutable';
end;
$$;

revoke all on function public.enforce_scene_plan_approved_immutability() from public;
revoke all on function public.enforce_scene_plan_approved_immutability() from anon;
revoke all on function public.enforce_scene_plan_approved_immutability() from authenticated;
