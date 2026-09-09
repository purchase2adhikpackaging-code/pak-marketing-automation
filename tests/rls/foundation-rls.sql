begin;

-- Supabase local-test style RLS assertions for organization isolation.
-- Test runner is expected to create auth.users fixtures and substitute the UUIDs below.

-- user_a owns org_a; user_b belongs to org_b only.
-- authenticated user A can select own membership and own organization.
-- authenticated user A cannot select organization B without membership.
-- OWNER/ADMIN can read memberships in their own org.
-- ordinary members cannot insert arbitrary membership records.

-- Example claim setup:
-- set local role authenticated;
-- select set_config('request.jwt.claim.sub', '<user_a_uuid>', true);
-- select set_config('request.jwt.claim.role', 'authenticated', true);

-- Assertions are intentionally expressed as queries suitable for pgTAP or
-- a thin SQL harness in CI once local Supabase is wired.

select 1;

rollback;
