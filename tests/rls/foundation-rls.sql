begin;

-- Supabase local-test style RLS assertions for organization isolation.
-- These checks validate the multilingual artifact migration's security-critical
-- schema shape without weakening RLS or requiring live provider credentials.

-- Existing organization/content behavioral cases remain part of the local
-- fixture harness when auth/org fixtures are available:
-- 1. a member can select content_items belonging to their organization.
-- 2. a member cannot select content_items belonging to another organization.
-- 3. OWNER, ADMIN, and EDITOR may insert/update content_items in their organization.
-- 4. REVIEWER and ANALYST may not insert/update content_items.
-- 5. only OWNER and ADMIN may delete content_items.

-- Multilingual artifact behavioral cases for fixture-backed local Supabase runs:
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

-- Executable schema/security assertions. These fail deterministically if the
-- multilingual migration has not been applied with the intended tenant boundary.
do $$
declare
  select_policy pg_policies%rowtype;
  insert_policy pg_policies%rowtype;
  update_policy pg_policies%rowtype;
  delete_policy pg_policies%rowtype;
  parent_trigger_count integer;
  rls_enabled boolean;
begin
  if to_regclass('public.content_script_artifacts') is null then
    raise exception 'content_script_artifacts table is missing';
  end if;

  select relrowsecurity
    into rls_enabled
  from pg_class
  where oid = 'public.content_script_artifacts'::regclass;

  if not coalesce(rls_enabled, false) then
    raise exception 'content_script_artifacts RLS is not enabled';
  end if;

  if not exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'content_script_artifacts'
      and indexname = 'content_script_one_source_idx'
      and indexdef ilike '%unique%'
      and indexdef ilike '%where is_source%'
  ) then
    raise exception 'unique one-source artifact index is missing or malformed';
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.content_script_artifacts'::regclass
      and contype = 'u'
      and pg_get_constraintdef(oid) ilike '%content_item_id%language%'
  ) then
    raise exception 'content item/language uniqueness constraint is missing';
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.content_script_artifacts'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%GENERATED%script_text%'
  ) then
    raise exception 'generated artifact text constraint is missing';
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.content_script_artifacts'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%source_revision%'
  ) then
    raise exception 'translation source revision constraint is missing';
  end if;

  select count(*)
    into parent_trigger_count
  from pg_trigger
  where tgrelid = 'public.content_script_artifacts'::regclass
    and tgname = 'content_script_artifact_parent_org_guard'
    and not tgisinternal;

  if parent_trigger_count <> 1 then
    raise exception 'parent organization integrity trigger is missing or duplicated';
  end if;

  select * into select_policy
  from pg_policies
  where schemaname = 'public'
    and tablename = 'content_script_artifacts'
    and policyname = 'content_script_artifacts_select_member';

  if select_policy.policyname is null
     or select_policy.cmd <> 'SELECT'
     or select_policy.qual not ilike '%is_org_member%organization_id%' then
    raise exception 'content_script_artifacts SELECT policy is missing or malformed';
  end if;

  select * into insert_policy
  from pg_policies
  where schemaname = 'public'
    and tablename = 'content_script_artifacts'
    and policyname = 'content_script_artifacts_insert_editor';

  if insert_policy.policyname is null
     or insert_policy.cmd <> 'INSERT'
     or insert_policy.with_check not ilike '%has_org_role%organization_id%OWNER%ADMIN%EDITOR%'
     or insert_policy.with_check not ilike '%created_by%auth.uid%' then
    raise exception 'content_script_artifacts INSERT policy is missing or malformed';
  end if;

  select * into update_policy
  from pg_policies
  where schemaname = 'public'
    and tablename = 'content_script_artifacts'
    and policyname = 'content_script_artifacts_update_editor';

  if update_policy.policyname is null
     or update_policy.cmd <> 'UPDATE'
     or update_policy.qual not ilike '%has_org_role%organization_id%OWNER%ADMIN%EDITOR%'
     or update_policy.with_check not ilike '%has_org_role%organization_id%OWNER%ADMIN%EDITOR%' then
    raise exception 'content_script_artifacts UPDATE policy is missing or malformed';
  end if;

  select * into delete_policy
  from pg_policies
  where schemaname = 'public'
    and tablename = 'content_script_artifacts'
    and policyname = 'content_script_artifacts_delete_admin';

  if delete_policy.policyname is null
     or delete_policy.cmd <> 'DELETE'
     or delete_policy.qual not ilike '%has_org_role%organization_id%OWNER%ADMIN%'
     or delete_policy.qual ilike '%EDITOR%' then
    raise exception 'content_script_artifacts DELETE policy is missing or malformed';
  end if;
end
$$;

select 1;

rollback;
