create table if not exists public.content_script_artifacts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  content_item_id uuid not null references public.content_items(id) on delete cascade,
  language text not null check (language in ('EN','PL','HI')),
  is_source boolean not null default false,
  status text not null default 'PENDING'
    check (status in ('PENDING','GENERATING','GENERATED','STALE','FAILED')),
  script_text text,
  revision integer not null default 1 check (revision >= 1),
  source_revision integer check (source_revision is null or source_revision >= 1),
  provider text,
  provider_model text,
  provider_metadata jsonb,
  failure_metadata jsonb,
  created_by uuid references auth.users(id) on delete set null,
  generated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (content_item_id, language),
  constraint content_script_generated_has_text check (
    status <> 'GENERATED' or nullif(btrim(script_text), '') is not null
  ),
  constraint content_script_source_revision_shape check (
    (is_source and source_revision is null)
    or (
      not is_source
      and (
        status not in ('GENERATED','STALE')
        or source_revision is not null
      )
    )
  )
);

create unique index if not exists content_script_one_source_idx
  on public.content_script_artifacts (content_item_id)
  where is_source;

create index if not exists content_script_artifacts_org_content_idx
  on public.content_script_artifacts (organization_id, content_item_id);

create index if not exists content_script_artifacts_org_status_idx
  on public.content_script_artifacts (organization_id, status);

create or replace function public.enforce_content_script_artifact_parent_org()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  parent_org_id uuid;
begin
  select organization_id
    into parent_org_id
  from public.content_items
  where id = new.content_item_id;

  if parent_org_id is null then
    raise exception 'content item % does not exist', new.content_item_id;
  end if;

  if parent_org_id <> new.organization_id then
    raise exception 'artifact organization must match parent content item organization';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_content_script_artifact_parent_org() from public;

drop trigger if exists content_script_artifact_parent_org_guard
  on public.content_script_artifacts;

create trigger content_script_artifact_parent_org_guard
before insert or update of organization_id, content_item_id
on public.content_script_artifacts
for each row
execute function public.enforce_content_script_artifact_parent_org();

insert into public.content_script_artifacts (
  organization_id,
  content_item_id,
  language,
  is_source,
  status,
  script_text,
  revision,
  provider,
  provider_model,
  provider_metadata,
  failure_metadata,
  created_by,
  generated_at,
  created_at,
  updated_at
)
select
  ci.organization_id,
  ci.id,
  ci.language,
  true,
  'GENERATED',
  ci.generated_script,
  1,
  ci.provider,
  ci.provider_model,
  ci.provider_metadata,
  null,
  ci.created_by,
  ci.updated_at,
  ci.created_at,
  ci.updated_at
from public.content_items ci
where nullif(btrim(ci.generated_script), '') is not null
on conflict (content_item_id, language) do nothing;

alter table public.content_script_artifacts enable row level security;

drop policy if exists content_script_artifacts_select_member
  on public.content_script_artifacts;
create policy content_script_artifacts_select_member
on public.content_script_artifacts
for select
to authenticated
using (public.is_org_member(organization_id));

drop policy if exists content_script_artifacts_insert_editor
  on public.content_script_artifacts;
create policy content_script_artifacts_insert_editor
on public.content_script_artifacts
for insert
to authenticated
with check (
  public.has_org_role(organization_id, array['OWNER','ADMIN','EDITOR'])
  and (created_by is null or created_by = auth.uid())
);

drop policy if exists content_script_artifacts_update_editor
  on public.content_script_artifacts;
create policy content_script_artifacts_update_editor
on public.content_script_artifacts
for update
to authenticated
using (public.has_org_role(organization_id, array['OWNER','ADMIN','EDITOR']))
with check (public.has_org_role(organization_id, array['OWNER','ADMIN','EDITOR']));

drop policy if exists content_script_artifacts_delete_admin
  on public.content_script_artifacts;
create policy content_script_artifacts_delete_admin
on public.content_script_artifacts
for delete
to authenticated
using (public.has_org_role(organization_id, array['OWNER','ADMIN']));
