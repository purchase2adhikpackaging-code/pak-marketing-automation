alter table public.integration_audit_events
  drop constraint if exists integration_audit_events_type_check;

alter table public.integration_audit_events
  add constraint integration_audit_events_type_check
  check (
    event_type = any (
      array[
        'CREATED'::text,
        'UPDATED'::text,
        'SECRET_REPLACED'::text,
        'SECRET_REMOVED'::text,
        'TEST_SUCCEEDED'::text,
        'TEST_FAILED'::text,
        'DISABLED'::text,
        'ENABLED'::text,
        'PUBLISHING_GENERATION_DIAGNOSTIC'::text
      ]
    )
  );
