-- Phase 9 Approval Center: remove implicit table mutation privileges.
-- Browser/session clients may read tenant-scoped rows through RLS, while all
-- workflow mutations remain behind the trusted SECURITY DEFINER RPC boundary.

revoke all privileges on table public.approval_requests from anon;
revoke all privileges on table public.approval_requests from authenticated;
grant select on table public.approval_requests to authenticated;

revoke all privileges on table public.approval_events from anon;
revoke all privileges on table public.approval_events from authenticated;
grant select on table public.approval_events to authenticated;
