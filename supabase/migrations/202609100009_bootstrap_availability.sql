create or replace function public.is_pak_bootstrap_available()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select not exists (select 1 from public.organizations);
$$;

revoke all on function public.is_pak_bootstrap_available() from public;
grant execute on function public.is_pak_bootstrap_available() to anon;
grant execute on function public.is_pak_bootstrap_available() to authenticated;
