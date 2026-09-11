drop policy if exists scene_plan_qc_update_editor on public.scene_plan_qc_findings;
create policy scene_plan_qc_update_editor
on public.scene_plan_qc_findings
for update
to authenticated
using (public.has_org_role(organization_id, array['OWNER','ADMIN','EDITOR','REVIEWER']))
with check (public.has_org_role(organization_id, array['OWNER','ADMIN','EDITOR','REVIEWER']));

create or replace function public.enforce_scene_plan_reviewer_qc_ack_scope()
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
    if old.severity <> 'WARNING'
      or new.acknowledged_by <> auth.uid()
      or new.acknowledged_at is null
      or new.organization_id is distinct from old.organization_id
      or new.scene_plan_version_id is distinct from old.scene_plan_version_id
      or new.scene_id is distinct from old.scene_id
      or new.shot_id is distinct from old.shot_id
      or new.severity is distinct from old.severity
      or new.code is distinct from old.code
      or new.message is distinct from old.message
      or new.created_at is distinct from old.created_at then
      raise exception 'reviewers may only acknowledge warning findings';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.enforce_scene_plan_reviewer_qc_ack_scope() from public;
revoke all on function public.enforce_scene_plan_reviewer_qc_ack_scope() from anon;
revoke all on function public.enforce_scene_plan_reviewer_qc_ack_scope() from authenticated;

drop trigger if exists scene_plan_reviewer_qc_ack_scope_guard on public.scene_plan_qc_findings;
create trigger scene_plan_reviewer_qc_ack_scope_guard
before update on public.scene_plan_qc_findings
for each row execute function public.enforce_scene_plan_reviewer_qc_ack_scope();
