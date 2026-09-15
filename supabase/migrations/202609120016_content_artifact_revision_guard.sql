-- Phase 9 release hardening: exact-version approvals require every substantive script edit
-- to advance the content artifact revision before approval supersession logic evaluates it.

create or replace function public.advance_content_script_artifact_revision()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.script_text is distinct from new.script_text then
    new.revision := old.revision + 1;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_content_script_artifacts_advance_revision on public.content_script_artifacts;
create trigger trg_content_script_artifacts_advance_revision
before update of script_text, revision on public.content_script_artifacts
for each row
execute function public.advance_content_script_artifact_revision();
