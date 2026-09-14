do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.knowledge_records'::regclass
      and conname = 'knowledge_records_organization_id_id_key'
  ) then
    alter table public.knowledge_records
      add constraint knowledge_records_organization_id_id_key
      unique (organization_id, id);
  end if;
end;
$$;

create table public.research_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  query text not null check (char_length(query) between 3 and 300),
  provider text not null check (provider = 'EXA_MCP'),
  status text not null check (status in ('RUNNING','COMPLETED','PARTIAL','FAILED')),
  result_count integer not null default 0 check (result_count between 0 and 8),
  failure_code text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (organization_id, id)
);

create table public.research_candidates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  research_run_id uuid not null,
  provider text not null check (provider = 'EXA_MCP'),
  title text not null check (char_length(title) between 1 and 500),
  canonical_url text not null check (char_length(canonical_url) between 1 and 2048),
  source_host text not null check (char_length(source_host) between 1 and 255),
  excerpt text not null check (char_length(excerpt) between 1 and 4000),
  retrieved_at timestamptz not null,
  review_status text not null default 'SUGGESTED'
    check (review_status in ('SUGGESTED','CONVERTED','DISMISSED')),
  knowledge_record_id uuid,
  created_at timestamptz not null default now(),
  unique (organization_id, id),
  foreign key (organization_id, research_run_id)
    references public.research_runs(organization_id, id) on delete cascade,
  foreign key (organization_id, knowledge_record_id)
    references public.knowledge_records(organization_id, id) on delete restrict
);

create index research_runs_org_created_idx
  on public.research_runs (organization_id, created_at desc);
create index research_candidates_run_idx
  on public.research_candidates (research_run_id);
create index research_candidates_org_status_created_idx
  on public.research_candidates (organization_id, review_status, created_at desc);
create unique index research_candidates_knowledge_record_unique_idx
  on public.research_candidates (knowledge_record_id)
  where knowledge_record_id is not null;

alter table public.research_runs enable row level security;
alter table public.research_candidates enable row level security;

revoke all privileges on table public.research_runs from anon;
revoke all privileges on table public.research_candidates from anon;
revoke insert, update, delete on public.research_runs from anon, authenticated;
revoke insert, update, delete on public.research_candidates from anon, authenticated;
grant select on public.research_runs to authenticated;
grant select on public.research_candidates to authenticated;
grant select, insert, update, delete on public.research_runs to service_role;
grant select, insert, update, delete on public.research_candidates to service_role;

drop policy if exists research_runs_select_managers on public.research_runs;
create policy research_runs_select_managers
on public.research_runs
for select
to authenticated
using (
  public.has_org_role(organization_id, array['OWNER','ADMIN','EDITOR'])
);

drop policy if exists research_candidates_select_managers on public.research_candidates;
create policy research_candidates_select_managers
on public.research_candidates
for select
to authenticated
using (
  public.has_org_role(organization_id, array['OWNER','ADMIN','EDITOR'])
);
