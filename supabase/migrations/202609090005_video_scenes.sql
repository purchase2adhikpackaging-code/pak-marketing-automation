create table if not exists public.video_scenes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  content_item_id uuid not null,
  scene_order integer not null check (scene_order > 0),
  required boolean not null default true,
  script text not null,
  visual_prompt text not null,
  duration_seconds numeric(6,2) not null check (duration_seconds > 0),
  aspect_ratio text not null check (aspect_ratio in ('16:9','9:16','1:1')),
  continuity jsonb not null default '{}'::jsonb,
  provider text,
  provider_model text,
  provider_config jsonb not null default '{}'::jsonb,
  generation_state text not null default 'QUEUED' check (generation_state in ('QUEUED','PROCESSING','COMPLETED','FAILED','RETRYING','CANCELLED')),
  retry_count integer not null default 0 check (retry_count >= 0),
  provider_output_ref text,
  qa_state text not null default 'PENDING' check (qa_state in ('PENDING','PASSED','FAILED')),
  failure_metadata jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, content_item_id, scene_order)
);

create index if not exists video_scenes_org_content_idx
  on public.video_scenes(organization_id, content_item_id, scene_order);

alter table public.video_scenes enable row level security;

create policy video_scenes_select_member
on public.video_scenes
for select
to authenticated
using (public.is_org_member(organization_id));

create policy video_scenes_insert_editor
on public.video_scenes
for insert
to authenticated
with check (public.has_org_role(organization_id, array['OWNER','ADMIN','EDITOR']));

create policy video_scenes_update_editor
on public.video_scenes
for update
to authenticated
using (public.has_org_role(organization_id, array['OWNER','ADMIN','EDITOR']))
with check (public.has_org_role(organization_id, array['OWNER','ADMIN','EDITOR']));
