create or replace function public.persist_scene_plan_draft(
  _organization_id uuid,
  _video_project_id uuid,
  _version_number integer,
  _source_integrity_hash text,
  _canonical_narration text,
  _language text,
  _aspect_ratio text,
  _planner_provider text,
  _planner_model text,
  _creative_brief_snapshot jsonb,
  _visual_bible_snapshot jsonb,
  _created_by uuid,
  _scenes jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  plan_id uuid := gen_random_uuid();
  scene_row jsonb;
  shot_row jsonb;
  scene_id uuid;
begin
  if auth.uid() is null or auth.uid() <> _created_by then
    raise exception 'Scene Planning actor mismatch';
  end if;
  if not public.has_org_role(_organization_id, array['OWNER','ADMIN','EDITOR']) then
    raise exception 'Scene Planning edit permission required';
  end if;
  if not exists (
    select 1 from public.video_projects
    where id = _video_project_id and organization_id = _organization_id
  ) then
    raise exception 'Scene Planning project not found for organization';
  end if;

  insert into public.scene_plan_versions (
    id, organization_id, video_project_id, version_number, source_integrity_hash,
    status, planner_provider, planner_model, creative_brief_snapshot,
    visual_bible_snapshot, canonical_narration, language, aspect_ratio, created_by
  ) values (
    plan_id, _organization_id, _video_project_id, _version_number, _source_integrity_hash,
    'DRAFT', _planner_provider, _planner_model,
    coalesce(_creative_brief_snapshot, '{}'::jsonb),
    coalesce(_visual_bible_snapshot, '{}'::jsonb),
    _canonical_narration, _language, _aspect_ratio, _created_by
  );

  for scene_row in select value from jsonb_array_elements(coalesce(_scenes, '[]'::jsonb)) loop
    scene_id := gen_random_uuid();
    insert into public.scene_plan_scenes (
      id, organization_id, scene_plan_version_id, ordinal, title, narrative_role,
      narration_text, narration_start_char, narration_end_char,
      narrative_objective, emotional_objective, duration_seconds,
      continuity_context, creative_direction
    ) values (
      scene_id, _organization_id, plan_id,
      (scene_row->>'ordinal')::integer,
      scene_row->>'title',
      scene_row->>'narrativeRole',
      coalesce(scene_row->>'narrationText', ''),
      nullif(scene_row->>'narrationStartChar', '')::integer,
      nullif(scene_row->>'narrationEndChar', '')::integer,
      coalesce(scene_row->>'narrativeObjective', ''),
      coalesce(scene_row->>'emotionalObjective', ''),
      (scene_row->>'durationSeconds')::numeric,
      coalesce(scene_row->'continuityContext', '{}'::jsonb),
      scene_row->>'creativeDirection'
    );

    for shot_row in select value from jsonb_array_elements(coalesce(scene_row->'shots', '[]'::jsonb)) loop
      insert into public.scene_plan_shots (
        organization_id, scene_id, ordinal, duration_seconds,
        narration_text, narration_start_char, narration_end_char,
        creative_direction, master_visual_prompt, negative_constraints,
        subject_refs, location_refs, composition, shot_size, camera_angle,
        lens_intent, camera_motion, subject_motion, environment_motion,
        depth_of_field_intent, lighting, mood, transition_in, transition_out,
        ambience_intent, sfx_intent, music_intent, aspect_ratio,
        continuity_state, generation_requirements, human_modified
      ) values (
        _organization_id, scene_id,
        (shot_row->>'ordinal')::integer,
        (shot_row->>'durationSeconds')::numeric,
        coalesce(shot_row->>'narrationText', ''),
        nullif(shot_row->>'narrationStartChar', '')::integer,
        nullif(shot_row->>'narrationEndChar', '')::integer,
        shot_row->>'creativeDirection',
        shot_row->>'masterVisualPrompt',
        coalesce(shot_row->'negativeConstraints', '[]'::jsonb),
        coalesce(shot_row->'subjectRefs', '[]'::jsonb),
        coalesce(shot_row->'locationRefs', '[]'::jsonb),
        coalesce(shot_row->>'composition', ''),
        coalesce(shot_row->>'shotSize', ''),
        coalesce(shot_row->>'cameraAngle', ''),
        coalesce(shot_row->>'lensIntent', ''),
        coalesce(shot_row->>'cameraMotion', ''),
        coalesce(shot_row->>'subjectMotion', ''),
        coalesce(shot_row->>'environmentMotion', ''),
        coalesce(shot_row->>'depthOfFieldIntent', ''),
        coalesce(shot_row->>'lighting', ''),
        coalesce(shot_row->>'mood', ''),
        coalesce(shot_row->>'transitionIn', ''),
        coalesce(shot_row->>'transitionOut', ''),
        coalesce(shot_row->>'ambienceIntent', ''),
        coalesce(shot_row->>'sfxIntent', ''),
        coalesce(shot_row->>'musicIntent', ''),
        shot_row->>'aspectRatio',
        coalesce(shot_row->'continuityState', '{}'::jsonb),
        coalesce(shot_row->'generationRequirements', '{}'::jsonb),
        coalesce((shot_row->>'humanModified')::boolean, false)
      );
    end loop;
  end loop;

  return plan_id;
end;
$$;

revoke all on function public.persist_scene_plan_draft(uuid,uuid,integer,text,text,text,text,text,text,jsonb,jsonb,uuid,jsonb) from public;
revoke all on function public.persist_scene_plan_draft(uuid,uuid,integer,text,text,text,text,text,text,jsonb,jsonb,uuid,jsonb) from anon;
grant execute on function public.persist_scene_plan_draft(uuid,uuid,integer,text,text,text,text,text,text,jsonb,jsonb,uuid,jsonb) to authenticated;

create or replace function public.clone_scene_plan_version(
  _organization_id uuid,
  _source_plan_id uuid,
  _next_version_number integer,
  _created_by uuid
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  source_plan public.scene_plan_versions%rowtype;
  new_plan_id uuid := gen_random_uuid();
  source_scene record;
  source_shot record;
  new_scene_id uuid;
begin
  if auth.uid() is null or auth.uid() <> _created_by then
    raise exception 'Scene Planning actor mismatch';
  end if;
  if not public.has_org_role(_organization_id, array['OWNER','ADMIN','EDITOR']) then
    raise exception 'Scene Planning edit permission required';
  end if;

  select * into source_plan
  from public.scene_plan_versions
  where id = _source_plan_id and organization_id = _organization_id;
  if not found then raise exception 'Scene plan version not found'; end if;

  insert into public.scene_plan_versions (
    id, organization_id, video_project_id, version_number, source_integrity_hash,
    parent_version_id, status, planner_provider, planner_model,
    creative_brief_snapshot, visual_bible_snapshot, canonical_narration,
    language, aspect_ratio, total_duration_seconds, narration_coverage_hash,
    qc_summary, created_by
  ) values (
    new_plan_id, source_plan.organization_id, source_plan.video_project_id,
    _next_version_number, source_plan.source_integrity_hash, source_plan.id,
    'DRAFT', source_plan.planner_provider, source_plan.planner_model,
    source_plan.creative_brief_snapshot, source_plan.visual_bible_snapshot,
    source_plan.canonical_narration, source_plan.language, source_plan.aspect_ratio,
    source_plan.total_duration_seconds, source_plan.narration_coverage_hash,
    '{}'::jsonb, _created_by
  );

  for source_scene in
    select * from public.scene_plan_scenes
    where scene_plan_version_id = _source_plan_id
    order by ordinal
  loop
    new_scene_id := gen_random_uuid();
    insert into public.scene_plan_scenes (
      id, organization_id, scene_plan_version_id, ordinal, title, narrative_role,
      narration_text, narration_start_char, narration_end_char,
      narrative_objective, emotional_objective, duration_seconds,
      continuity_context, creative_direction
    ) values (
      new_scene_id, source_scene.organization_id, new_plan_id, source_scene.ordinal,
      source_scene.title, source_scene.narrative_role, source_scene.narration_text,
      source_scene.narration_start_char, source_scene.narration_end_char,
      source_scene.narrative_objective, source_scene.emotional_objective,
      source_scene.duration_seconds, source_scene.continuity_context,
      source_scene.creative_direction
    );

    for source_shot in
      select * from public.scene_plan_shots
      where scene_id = source_scene.id
      order by ordinal
    loop
      insert into public.scene_plan_shots (
        organization_id, scene_id, ordinal, duration_seconds,
        narration_text, narration_start_char, narration_end_char,
        creative_direction, master_visual_prompt, negative_constraints,
        subject_refs, location_refs, composition, shot_size, camera_angle,
        lens_intent, camera_motion, subject_motion, environment_motion,
        depth_of_field_intent, lighting, mood, transition_in, transition_out,
        ambience_intent, sfx_intent, music_intent, aspect_ratio,
        continuity_state, generation_requirements, human_modified
      ) values (
        source_shot.organization_id, new_scene_id, source_shot.ordinal,
        source_shot.duration_seconds, source_shot.narration_text,
        source_shot.narration_start_char, source_shot.narration_end_char,
        source_shot.creative_direction, source_shot.master_visual_prompt,
        source_shot.negative_constraints, source_shot.subject_refs,
        source_shot.location_refs, source_shot.composition, source_shot.shot_size,
        source_shot.camera_angle, source_shot.lens_intent,
        source_shot.camera_motion, source_shot.subject_motion,
        source_shot.environment_motion, source_shot.depth_of_field_intent,
        source_shot.lighting, source_shot.mood, source_shot.transition_in,
        source_shot.transition_out, source_shot.ambience_intent,
        source_shot.sfx_intent, source_shot.music_intent, source_shot.aspect_ratio,
        source_shot.continuity_state, source_shot.generation_requirements,
        source_shot.human_modified
      );
    end loop;
  end loop;

  return new_plan_id;
end;
$$;

revoke all on function public.clone_scene_plan_version(uuid,uuid,integer,uuid) from public;
revoke all on function public.clone_scene_plan_version(uuid,uuid,integer,uuid) from anon;
grant execute on function public.clone_scene_plan_version(uuid,uuid,integer,uuid) to authenticated;

-- REVIEWER already owns the established content:approve permission. Allow only
-- the plan-version row through RLS, then constrain reviewer writes in a trigger.
drop policy if exists scene_plan_versions_update_editor on public.scene_plan_versions;
create policy scene_plan_versions_update_editor
on public.scene_plan_versions
for update
to authenticated
using (public.has_org_role(organization_id, array['OWNER','ADMIN','EDITOR','REVIEWER']))
with check (public.has_org_role(organization_id, array['OWNER','ADMIN','EDITOR','REVIEWER']));

create or replace function public.enforce_scene_plan_reviewer_update_scope()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  reviewer_only boolean;
begin
  reviewer_only := public.has_org_role(old.organization_id, array['REVIEWER'])
    and not public.has_org_role(old.organization_id, array['OWNER','ADMIN','EDITOR']);

  if reviewer_only then
    if old.status <> 'REVIEW_REQUIRED'
      or new.status <> 'APPROVED'
      or new.approved_by <> auth.uid()
      or new.approved_at is null
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
      raise exception 'reviewers may only approve review-ready scene plans';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.enforce_scene_plan_reviewer_update_scope() from public;
revoke all on function public.enforce_scene_plan_reviewer_update_scope() from anon;
revoke all on function public.enforce_scene_plan_reviewer_update_scope() from authenticated;

drop trigger if exists scene_plan_reviewer_update_scope_guard on public.scene_plan_versions;
create trigger scene_plan_reviewer_update_scope_guard
before update on public.scene_plan_versions
for each row execute function public.enforce_scene_plan_reviewer_update_scope();
