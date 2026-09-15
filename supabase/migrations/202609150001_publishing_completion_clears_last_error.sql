create or replace function public.complete_publishing_job(
  p_job_id uuid,
  p_worker_id text,
  p_qa_status text,
  p_pdf_artifact_path text,
  p_manifest_artifact_path text,
  p_provider_name text,
  p_provider_model text,
  p_knowledge_hashes jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() <> 'service_role' then
    raise exception 'service role required';
  end if;

  if nullif(trim(coalesce(p_qa_status, '')), '') <> 'QA_PASSED' then
    raise exception 'completion requires QA_PASSED';
  end if;

  update public.publishing_production_jobs
  set status = 'QA_PASSED',
      current_stage = 'QA_PASSED',
      qa_status = p_qa_status,
      pdf_artifact_path = p_pdf_artifact_path,
      manifest_artifact_path = p_manifest_artifact_path,
      provider_name = p_provider_name,
      provider_model = p_provider_model,
      knowledge_hashes = coalesce(p_knowledge_hashes, '{}'::jsonb),
      last_error = null,
      lease_owner = null,
      lease_expires_at = null,
      completed_at = now(),
      updated_at = now()
  where id = p_job_id
    and status = 'RUNNING'
    and lease_owner = p_worker_id;

  if not found then
    raise exception 'publishing job completion rejected';
  end if;
end;
$$;

revoke execute on function public.complete_publishing_job(
  uuid, text, text, text, text, text, text, jsonb
) from public;

grant execute on function public.complete_publishing_job(
  uuid, text, text, text, text, text, text, jsonb
) to service_role;
