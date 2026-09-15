-- Phase 9 Approval Center: cover the organization foreign key and tenant-scoped
-- audit-history filtering identified by the live Supabase performance advisor.

create index if not exists approval_events_organization_id_idx
  on public.approval_events (organization_id);
