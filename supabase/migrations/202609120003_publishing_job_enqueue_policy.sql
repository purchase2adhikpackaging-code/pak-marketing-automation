create policy publishing_jobs_insert_editor
on public.publishing_production_jobs
for insert
to authenticated
with check (
  public.has_org_role(organization_id, array['OWNER','ADMIN','EDITOR'])
  and exists (
    select 1
    from public.publishing_production_runs r
    where r.id = production_run_id
      and r.organization_id = organization_id
      and r.created_by = auth.uid()
      and r.status in ('QUEUED','RUNNING')
  )
);
