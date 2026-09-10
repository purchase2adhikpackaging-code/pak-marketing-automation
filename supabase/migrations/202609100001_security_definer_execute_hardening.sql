-- Supabase may apply default EXECUTE grants directly to anon/authenticated
-- when functions are created. Revoke those explicit grants for internal helpers.
revoke all on function public.is_org_member(uuid) from anon;
revoke all on function public.has_org_role(uuid, text[]) from anon;

-- These helpers are intentionally callable by authenticated because RLS policies
-- use them to resolve organization membership/role without recursive RLS.
grant execute on function public.is_org_member(uuid) to authenticated;
grant execute on function public.has_org_role(uuid, text[]) to authenticated;

-- Job claiming is worker-internal and must never be exposed to browser roles.
revoke all on function public.claim_next_job(text, integer, text[]) from public;
revoke all on function public.claim_next_job(text, integer, text[]) from anon;
revoke all on function public.claim_next_job(text, integer, text[]) from authenticated;

-- Supabase's automatic public-schema RLS event-trigger helper runs through the
-- event trigger itself; browser roles do not need direct RPC execution rights.
do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    revoke all on function public.rls_auto_enable() from public;
    revoke all on function public.rls_auto_enable() from anon;
    revoke all on function public.rls_auto_enable() from authenticated;
  end if;
end;
$$;
