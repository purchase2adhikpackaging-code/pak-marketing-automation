begin;

-- Supabase local-test style RLS assertions for organization isolation.
-- These checks validate security-critical schema shape without weakening RLS
-- or requiring live provider credentials.

-- Existing organization/content behavioral cases remain part of the local
-- fixture harness when auth/org fixtures are available.

-- Multilingual artifact structural assertions.
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

  select relrowsecurity into rls_enabled
  from pg_class where oid = 'public.content_script_artifacts'::regclass;
  if not coalesce(rls_enabled, false) then
    raise exception 'content_script_artifacts RLS is not enabled';
  end if;

  if not exists (
    select 1 from pg_indexes
    where schemaname = 'public'
      and tablename = 'content_script_artifacts'
      and indexname = 'content_script_one_source_idx'
      and indexdef ilike '%unique%'
      and indexdef ilike '%where is_source%'
  ) then
    raise exception 'unique one-source artifact index is missing or malformed';
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.content_script_artifacts'::regclass
      and contype = 'u'
      and pg_get_constraintdef(oid) ilike '%content_item_id%language%'
  ) then
    raise exception 'content item/language uniqueness constraint is missing';
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.content_script_artifacts'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%GENERATED%script_text%'
  ) then
    raise exception 'generated artifact text constraint is missing';
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.content_script_artifacts'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%source_revision%'
  ) then
    raise exception 'translation source revision constraint is missing';
  end if;

  select count(*) into parent_trigger_count
  from pg_trigger
  where tgrelid = 'public.content_script_artifacts'::regclass
    and tgname = 'content_script_artifact_parent_org_guard'
    and not tgisinternal;
  if parent_trigger_count <> 1 then
    raise exception 'parent organization integrity trigger is missing or duplicated';
  end if;

  select * into select_policy from pg_policies
  where schemaname = 'public' and tablename = 'content_script_artifacts'
    and policyname = 'content_script_artifacts_select_member';
  if select_policy.policyname is null or select_policy.cmd <> 'SELECT'
     or select_policy.qual not ilike '%is_org_member%organization_id%' then
    raise exception 'content_script_artifacts SELECT policy is missing or malformed';
  end if;

  select * into insert_policy from pg_policies
  where schemaname = 'public' and tablename = 'content_script_artifacts'
    and policyname = 'content_script_artifacts_insert_editor';
  if insert_policy.policyname is null or insert_policy.cmd <> 'INSERT'
     or insert_policy.with_check not ilike '%has_org_role%organization_id%OWNER%ADMIN%EDITOR%'
     or insert_policy.with_check not ilike '%created_by%auth.uid%' then
    raise exception 'content_script_artifacts INSERT policy is missing or malformed';
  end if;

  select * into update_policy from pg_policies
  where schemaname = 'public' and tablename = 'content_script_artifacts'
    and policyname = 'content_script_artifacts_update_editor';
  if update_policy.policyname is null or update_policy.cmd <> 'UPDATE'
     or update_policy.qual not ilike '%has_org_role%organization_id%OWNER%ADMIN%EDITOR%'
     or update_policy.with_check not ilike '%has_org_role%organization_id%OWNER%ADMIN%EDITOR%' then
    raise exception 'content_script_artifacts UPDATE policy is missing or malformed';
  end if;

  select * into delete_policy from pg_policies
  where schemaname = 'public' and tablename = 'content_script_artifacts'
    and policyname = 'content_script_artifacts_delete_admin';
  if delete_policy.policyname is null or delete_policy.cmd <> 'DELETE'
     or delete_policy.qual not ilike '%has_org_role%organization_id%OWNER%ADMIN%'
     or delete_policy.qual ilike '%EDITOR%' then
    raise exception 'content_script_artifacts DELETE policy is missing or malformed';
  end if;
end
$$;

-- Knowledge Base and immutable provenance structural assertions.
do $$
declare
  knowledge_select pg_policies%rowtype;
  knowledge_insert pg_policies%rowtype;
  knowledge_update pg_policies%rowtype;
  knowledge_delete pg_policies%rowtype;
  snapshot_select pg_policies%rowtype;
  knowledge_rls boolean;
  snapshot_rls boolean;
  integrity_trigger_count integer;
  audit_trigger_count integer;
begin
  if to_regclass('public.knowledge_records') is null then
    raise exception 'knowledge_records table is missing';
  end if;
  if to_regclass('public.content_item_knowledge_sources') is null then
    raise exception 'content_item_knowledge_sources table is missing';
  end if;

  select relrowsecurity into knowledge_rls from pg_class
  where oid = 'public.knowledge_records'::regclass;
  select relrowsecurity into snapshot_rls from pg_class
  where oid = 'public.content_item_knowledge_sources'::regclass;
  if not coalesce(knowledge_rls, false) or not coalesce(snapshot_rls, false) then
    raise exception 'Knowledge Base RLS is not enabled on both tables';
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.knowledge_records'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%DRAFT%ACTIVE%ARCHIVED%'
  ) then
    raise exception 'knowledge lifecycle constraint is missing';
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.knowledge_records'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%MANUAL%DOCUMENT%URL%'
  ) then
    raise exception 'knowledge source type constraint is missing';
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.content_item_knowledge_sources'::regclass
      and contype = 'u'
      and pg_get_constraintdef(oid) ilike '%content_item_id%knowledge_record_id%'
  ) then
    raise exception 'knowledge provenance uniqueness constraint is missing';
  end if;

  select count(*) into integrity_trigger_count
  from pg_trigger
  where tgrelid = 'public.content_item_knowledge_sources'::regclass
    and tgname = 'content_item_knowledge_source_integrity_guard'
    and not tgisinternal;
  if integrity_trigger_count <> 1 then
    raise exception 'knowledge provenance organization integrity trigger is missing or duplicated';
  end if;

  select count(*) into audit_trigger_count
  from pg_trigger
  where tgrelid = 'public.knowledge_records'::regclass
    and tgname = 'knowledge_record_audit_guard'
    and not tgisinternal;
  if audit_trigger_count <> 1 then
    raise exception 'knowledge audit integrity trigger is missing or duplicated';
  end if;

  select * into knowledge_select from pg_policies
  where schemaname = 'public' and tablename = 'knowledge_records'
    and policyname = 'knowledge_records_select_visible';
  if knowledge_select.policyname is null or knowledge_select.cmd <> 'SELECT'
     or knowledge_select.qual not ilike '%is_org_member%organization_id%'
     or knowledge_select.qual not ilike '%ACTIVE%'
     or knowledge_select.qual not ilike '%has_org_role%OWNER%ADMIN%EDITOR%' then
    raise exception 'knowledge_records SELECT visibility policy is missing or malformed';
  end if;

  select * into knowledge_insert from pg_policies
  where schemaname = 'public' and tablename = 'knowledge_records'
    and policyname = 'knowledge_records_insert_editor';
  if knowledge_insert.policyname is null or knowledge_insert.cmd <> 'INSERT'
     or knowledge_insert.with_check not ilike '%has_org_role%organization_id%OWNER%ADMIN%EDITOR%'
     or knowledge_insert.with_check not ilike '%created_by%auth.uid%'
     or knowledge_insert.with_check not ilike '%updated_by%auth.uid%' then
    raise exception 'knowledge_records INSERT policy is missing or malformed';
  end if;

  select * into knowledge_update from pg_policies
  where schemaname = 'public' and tablename = 'knowledge_records'
    and policyname = 'knowledge_records_update_editor';
  if knowledge_update.policyname is null or knowledge_update.cmd <> 'UPDATE'
     or knowledge_update.qual not ilike '%has_org_role%organization_id%OWNER%ADMIN%EDITOR%'
     or knowledge_update.with_check not ilike '%has_org_role%organization_id%OWNER%ADMIN%EDITOR%'
     or knowledge_update.with_check not ilike '%updated_by%auth.uid%' then
    raise exception 'knowledge_records UPDATE policy is missing or malformed';
  end if;

  select * into knowledge_delete from pg_policies
  where schemaname = 'public' and tablename = 'knowledge_records'
    and policyname = 'knowledge_records_delete_admin';
  if knowledge_delete.policyname is null or knowledge_delete.cmd <> 'DELETE'
     or knowledge_delete.qual not ilike '%has_org_role%organization_id%OWNER%ADMIN%'
     or knowledge_delete.qual ilike '%EDITOR%' then
    raise exception 'knowledge_records DELETE policy is missing or malformed';
  end if;

  select * into snapshot_select from pg_policies
  where schemaname = 'public' and tablename = 'content_item_knowledge_sources'
    and policyname = 'content_item_knowledge_sources_select_member';
  if snapshot_select.policyname is null or snapshot_select.cmd <> 'SELECT'
     or snapshot_select.qual not ilike '%is_org_member%organization_id%' then
    raise exception 'knowledge snapshot SELECT policy is missing or malformed';
  end if;

  if exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'content_item_knowledge_sources'
      and cmd in ('INSERT','UPDATE','DELETE')
  ) then
    raise exception 'knowledge snapshots must not expose authenticated INSERT, UPDATE, or DELETE policies';
  end if;
end
$$;

select 1;

rollback;