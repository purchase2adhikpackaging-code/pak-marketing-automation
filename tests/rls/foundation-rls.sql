begin;

-- Supabase local-test style RLS assertions for organization isolation.
-- This file intentionally contains executable shape checks plus the exact
-- fixture-driven policy cases that a local Supabase harness must run once
-- auth/org fixtures are wired into CI.

-- Existing organization/content assertions:
-- 1. a member can select content_items belonging to their organization.
-- 2. a member cannot select content_items belonging to another organization.
-- 3. OWNER, ADMIN, and EDITOR may insert/update content_items in their organization.
-- 4. REVIEWER and ANALYST may not insert/update content_items.
-- 5. only OWNER and ADMIN may delete content_items.

-- Multilingual script artifact assertions required by the artifact slice:
-- 1. same-organization members can SELECT content_script_artifacts.
-- 2. cross-organization SELECT returns no artifact rows.
-- 3. OWNER, ADMIN, and EDITOR can INSERT/UPDATE artifacts in their organization.
-- 4. REVIEWER and ANALYST cannot INSERT/UPDATE artifacts.
-- 5. only OWNER and ADMIN can DELETE artifacts.
-- 6. artifact organization_id differing from its parent content_item organization is rejected.
-- 7. duplicate (content_item_id, language) rows are rejected.
-- 8. a second is_source=true artifact for the same content item is rejected.
-- 9. GENERATED artifacts require non-empty script_text.
-- 10. GENERATED/STALE translations retain the source_revision they were derived from.

-- Example fixture claim setup once local Supabase fixtures are available:
-- set local role authenticated;
-- select set_config('request.jwt.claim.sub', '<fixture-user-uuid>', true);
-- select set_config('request.jwt.claim.role', 'authenticated', true);

-- Executable schema-shape assertions. These fail deterministically if the
-- multilingual migration has not been applied to the database under test.
do $$
begin
  if to_regclass('public.content_script_artifacts') is null then
    raise exception 'content_script_artifacts table is missing';
  end if;

  if not exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'content_script_artifacts'
      and indexname = 'content_script_one_source_idx'
  ) then
    raise exception 'content_script_one_source_idx is missing';
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'content_script_artifacts'
      and policyname = 'content_script_artifacts_select_member'
  ) then
    raise exception 'content_script_artifacts SELECT policy is missing';
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'content_script_artifacts'
      and policyname = 'content_script_artifacts_update_editor'
  ) then
    raise exception 'content_script_artifacts UPDATE policy is missing';
  end if;
end
$$;

select 1;

rollback;
