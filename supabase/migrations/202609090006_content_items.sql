create table if not exists public.content_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  topic text not null,
  knowledge_context text,
  language text not null check (language in ('EN','PL','HI')),
  status text not null default 'DRAFT' check (status in ('DRAFT','GENERATING','GENERATED','FAILED')),
  generated_script text,
  provider text,
  provider_model text,
  provider_metadata jsonb,
  failure_metadata jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists content_items_org_created_idx
  on public.content_items (organization_id, created_at desc);

create index if not exists content_items_org_status_idx
  on public.content_items (organization_id, status);

alter table public.content_items enable row level security;

create policy content_items_select_member
on public.content_items
for select
to authenticated
using (public.is_org_member(organization_id));

create policy content_items_insert_editor
on public.content_items
for insert
to authenticated
with check (
  public.has_org_role(organization_id, array['OWNER','ADMIN','EDITOR'])
  and (created_by is null or created_by = auth.uid())
);

create policy content_items_update_editor
on public.content_items
for update
to authenticated
using (public.has_org_role(organization_id, array['OWNER','ADMIN','EDITOR']))
with check (public.has_org_role(organization_id, array['OWNER','ADMIN','EDITOR']));

create policy content_items_delete_admin
on public.content_items
for delete
to authenticated
using (public.has_org_role(organization_id, array['OWNER','ADMIN']));
