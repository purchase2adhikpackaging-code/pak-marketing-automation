# Phase 10 — Meta Publishing Design

**Project:** PAK Marketing Automation  
**Phase:** 10 — Publishing Foundation + Meta  
**Status:** Draft for written-spec review  
**Base commit:** `abb49a96693367c1bbb12cf9a11488600c355eb4`  
**Branch:** `phase-10/meta-publishing`  
**Date:** 2026-09-12

## 1. Purpose

Phase 10 turns approved PAK content and final PAK-owned media into an operational external publishing workflow, beginning with Facebook Page video publishing and preserving an adapter boundary for Instagram professional-account publishing.

The design must preserve all existing PAK invariants: organization isolation, role-based authorization, Approval Center currentness, Integration Vault secret isolation, durable jobs, idempotency, reconciliation, normalized provider errors and evidence-based release.

The target product flow after Phase 10 is:

`PAK media/content -> current approval -> publication target -> durable publish job -> Meta adapter -> external publication -> reconciliation/status history`

Phase 11 will add calendar-native delayed scheduling. Phase 10 implements publish-now plus the durable publication model required by Phase 11.

## 2. Governing requirements

### Product

- **PRD-PUB-001** Initial architecture supports Meta properties and remains extensible to other channels.
- **PRD-PUB-002** Provider/channel credentials are stored through Integration Vault.
- **PRD-PUB-003** Publishing is durable-job based with idempotency.
- **PRD-PUB-004** Record provider publication ID, timestamps, status and normalized error metadata.
- **PRD-PUB-005** Failed publish may be retried without duplicate posts where provider semantics permit.
- **PRD-PUB-006** Browser clients never receive raw provider secrets.

### Technical

- **TRD-PUB-001** Meta publishing uses server-side Integration Vault credentials.
- **TRD-PUB-002** OAuth/token refresh, where supported, occurs server-side.
- **TRD-PUB-003** Webhooks validate signatures before accepting provider events.
- **TRD-PUB-004** Publish attempts persist idempotency/reference/provider response metadata without raw credentials.
- **TRD-PUB-005** Channel adapters normalize provider-specific errors/statuses.

### Meta integration

- **INT-META-001** App secret/access tokens are write-only in browser UX.
- **INT-META-002** Connection validation occurs server-side.
- **INT-META-003** Expired/revoked token transitions provider health to INVALID.
- **INT-META-004** Webhook requests are signature-validated before mutation.
- **INT-META-005** Publishing stores external publication identifiers/status, never access tokens.
- **INT-META-006** Multiple page/account targets are non-secret publication targets linked to provider connection(s).
- **INT-META-007** Token refresh/rotation is server-side and audited.

### UX

- **UX-PUB-001** Channel cards show configured channels and health without secrets.
- **UX-PUB-002** Publish workflow selects eligible approved content/media, target, preview and submit.
- **UX-PUB-003** Attempt status shows durable state, safe external reference, timestamp and safe retry.

## 3. Scope

### In scope

1. Meta connection support in existing Integration Vault.
2. Multiple organization-scoped Facebook Page publication targets under one Meta connection.
3. Facebook Page video publishing as the first live publication capability.
4. Provider-neutral publishing adapter contract suitable for later Instagram support.
5. Approval-gated publish-now workflow for exact media identity/checksum.
6. Durable publish jobs and immutable/append-oriented attempt lineage.
7. Idempotency and reconciliation that prevent speculative duplicate posting.
8. Safe provider health/error handling and connection validation.
9. Publishing UI replacing the current readiness surface.
10. Runtime verification with fake provider in CI and controlled live Meta smoke only when valid PAK Meta credentials/permissions are present.

### Out of scope

- Content Calendar date/time scheduling UI and timezone workflow (Phase 11).
- Analytics/insights ingestion (Phase 12).
- WhatsApp publishing.
- General-purpose social inbox/comments/messages.
- Paid ads/boosting.
- Arbitrary user-defined HTTP publishing providers.
- Instagram live execution in the first Phase 10 release slice; the contract must support it without schema redesign.

## 4. Architectural decision

Use a provider-neutral publishing domain backed by organization-scoped `publication_targets`, `publication_attempts` and existing durable `jobs`.

The browser submits identifiers and operator-authored caption metadata only. It never submits trusted approval state, media checksum, storage path, provider access token, page token or provider payload.

The authoritative enqueue boundary reloads current media, approval and target state, computes an idempotency key, and creates one durable `META_PUBLISH` job. A privileged worker resolves the Meta credential from Vault, obtains a short-lived signed URL or byte stream for the private PAK video, maps the request through a Meta adapter, persists the external reference and reconciles provider state.

This design separates four responsibilities:

1. **PAK domain eligibility** — tenant, role, active media, current approval.
2. **Target configuration** — non-secret page/account identity linked to a Meta connection.
3. **Provider execution** — Meta-specific transport/payload/status handling behind an adapter.
4. **Durable workflow state** — jobs + publication attempts, independent of HTTP request lifetime.

## 5. Supported publication source

The initial release publishes `MEDIA_ASSET` video targets only.

Eligibility:

- same organization;
- `media_assets.status = ACTIVE`;
- media type is video;
- durable private storage identity exists;
- stable checksum exists;
- exact media asset/checksum is currently approved through Phase 9 `is_target_currently_approved(...)`;
- active Meta publication target exists;
- actor has publishing permission.

No browser-supplied checksum, storage path, approval flag or target ownership is trusted.

Text/caption is a publication-level field, not a replacement for the approved media identity. Phase 10 may accept a bounded operator caption because external post copy can differ from the video binary while still requiring the exact approved media asset. A future stricter policy may additionally require an approved content artifact; the schema must allow `source_content_artifact_id` without requiring it for the first Facebook video slice.

## 6. Authorization

### Configure Meta connection/targets

- OWNER/ADMIN only.
- Secret save/replace/remove follows existing Integration Vault rules.
- Non-secret publication target management is OWNER/ADMIN.

### Publish

- OWNER/ADMIN/EDITOR may enqueue an eligible approved publication.
- REVIEWER/ANALYST cannot publish.
- Browser cannot directly insert/claim/update `META_PUBLISH` jobs or publication-attempt execution state.
- Worker/service-role paths are inaccessible to normal browser roles.

## 7. Meta connection model

Reuse `integration_connections` provider `META` plus Vault-backed `integration_secrets`.

### Secret fields

Initial supported secret names:

- `ACCESS_TOKEN` — required for first release.
- `APP_SECRET` — optional until webhook verification or a validation flow requires it; once configured it remains write-only.

Secrets are never returned after save.

### Non-secret config

Connection config may contain safe identifiers such as:

- `app_id`
- `business_id`
- provider Graph API version/profile metadata

Target-specific IDs belong in `publication_targets`, not inside secret payloads.

### Health

Connection validation is server-side and returns only normalized state:

`NOT_CONFIGURED | CONFIGURED | INVALID | DISABLED`

Expired/revoked/insufficient-permission credentials mark health INVALID with a safe error code; provider raw token/error payload is never exposed to browser UI.

## 8. Data model

### 8.1 `publication_targets`

Purpose: one organization-owned external channel/account target.

Logical fields:

- `id uuid PK`
- `organization_id uuid NOT NULL FK organizations`
- `integration_connection_id uuid NOT NULL FK integration_connections`
- `provider text NOT NULL CHECK META`
- `channel text NOT NULL CHECK FACEBOOK_PAGE|INSTAGRAM_ACCOUNT`
- `external_target_id text NOT NULL`
- `display_name text NOT NULL`
- `status text NOT NULL CHECK ACTIVE|DISABLED|INVALID`
- `safe_metadata jsonb NOT NULL DEFAULT '{}'`
- `created_by uuid NULL`
- `updated_by uuid NULL`
- `created_at timestamptz NOT NULL`
- `updated_at timestamptz NOT NULL`

Constraints:

- target organization must equal connection organization;
- unique `(organization_id, provider, channel, external_target_id)`;
- target IDs/config are non-secret but remain organization-scoped;
- authenticated browser mutation is only through authorized server/RPC boundaries.

### 8.2 `publication_attempts`

Purpose: append-oriented execution lineage for an external publication.

Logical fields:

- `id uuid PK`
- `organization_id uuid NOT NULL`
- `job_id uuid NOT NULL FK jobs`
- `publication_target_id uuid NOT NULL`
- `media_asset_id uuid NOT NULL`
- `media_checksum text NOT NULL`
- `source_content_artifact_id uuid NULL`
- `caption text NOT NULL DEFAULT ''`
- `attempt_number integer NOT NULL`
- `state text NOT NULL CHECK QUEUED|SUBMITTING|SUBMITTED|PROCESSING|PUBLISHED|FAILED|SUBMISSION_UNKNOWN|CANCELLED`
- `idempotency_key text NOT NULL`
- `provider_publication_id text NULL`
- `provider_container_id text NULL`
- `provider_request_id text NULL`
- `normalized_error_code text NULL`
- `normalized_error_message text NULL`
- `retryable boolean NOT NULL DEFAULT false`
- `submitted_at timestamptz NULL`
- `published_at timestamptz NULL`
- `last_reconciled_at timestamptz NULL`
- `created_at timestamptz NOT NULL`
- `updated_at timestamptz NOT NULL`

Rules:

- attempt captures exact media checksum used for submission;
- access tokens, signed media URLs and raw provider bodies are never persisted;
- provider IDs are safe execution lineage;
- attempt history is not overwritten to fabricate a new retry; safe retry creates the next attempt number;
- unique attempt number per job;
- deterministic idempotency key binds organization + target + media identity + normalized caption/publication intent.

## 9. Durable job model

Use existing `jobs` with:

- `job_type = META_PUBLISH`
- `resource_type = MEDIA_ASSET`
- `resource_id = media_asset_id`
- deterministic `idempotency_key`
- bounded attempt policy

Browser-accessible enqueue RPC/server action is the only way normal users can create a `META_PUBLISH` job.

Duplicate enqueue with the same authoritative publication identity returns the existing active/completed publication rather than creating a second post.

## 10. Provider-neutral adapter

Conceptual contract:

```ts
export interface PublishingProvider {
  validateConnection(input: ProviderConnectionValidationInput): Promise<ProviderConnectionHealth>;
  submit(input: PublicationSubmission): Promise<PublicationSubmissionResult>;
  getStatus(input: PublicationStatusRequest): Promise<PublicationStatusResult>;
}
```

Domain inputs contain normalized publication intent. Meta-specific endpoint paths, upload/container semantics, Graph versioning, response fields and errors remain inside the Meta adapter.

The adapter must distinguish:

- confirmed submission with external ID;
- still processing;
- confirmed published;
- terminal failure;
- ambiguous `SUBMISSION_UNKNOWN` where retry could create a duplicate.

## 11. State machine

Initial flow:

`QUEUED -> SUBMITTING -> SUBMITTED|PROCESSING -> PUBLISHED`

Failure paths:

- `SUBMITTING -> FAILED` when provider definitively rejects before publication creation.
- `SUBMITTING -> SUBMISSION_UNKNOWN` when the transport outcome is ambiguous after request transmission.
- `SUBMITTED|PROCESSING -> FAILED` for provider terminal failure.

`SUBMISSION_UNKNOWN` is not automatically resubmitted. The worker must reconcile using persisted provider identifiers when available; otherwise surface an operator-safe blocked state to avoid duplicate public posts.

Safe transient failures may create a new attempt only when duplicate publication can be ruled out.

## 12. Enqueue workflow

1. Browser submits organization ID, media asset ID, publication target ID and bounded caption.
2. Server authenticates actor and resolves membership/role.
3. Server reloads target and Meta connection under organization authorization.
4. Server reloads media asset and exact checksum/storage identity.
5. Server verifies media ACTIVE/video/eligible.
6. Server calls current approval predicate for exact `MEDIA_ASSET` checksum.
7. Server validates target ACTIVE and connection health not DISABLED/INVALID.
8. Server normalizes caption and computes deterministic idempotency key.
9. Existing equivalent active/completed job is returned if present.
10. Otherwise create `META_PUBLISH` job + attempt 1 atomically.

## 13. Worker workflow

1. Privileged dispatcher claims due `META_PUBLISH` jobs using lease/`SKIP LOCKED` semantics.
2. Worker reloads job, attempt, target, media, approval and connection state.
3. Worker refuses execution if approval/media/target/connection became invalid before external side effect.
4. Worker resolves Meta secret from Vault server-side.
5. Worker obtains private PAK media through a short-lived signed URL or trusted server-side byte stream.
6. Meta adapter submits the publication.
7. Worker persists only safe provider IDs/state/timestamps.
8. If provider processing is asynchronous, reconciliation continues unattended.
9. On confirmed publication, attempt and job become completed/PUBLISHED.
10. Lease is released after each execution cycle.

## 14. Dispatcher

Prefer the existing unattended worker pattern already proven in PAK:

- `pg_cron` + `pg_net`
- internal Edge dispatcher authenticated with a Vault-held secret
- bounded batch claim
- service-role RPC behind the dispatcher only

Phase 10 may use a new `publishing-dispatcher` Edge Function or a narrowly generalized provider-job dispatcher only if that generalization is smaller and clearer than duplicating infrastructure. Browser roles never receive the dispatcher token.

## 15. Webhooks

Webhook support is included only where it materially improves Meta state reconciliation.

Any Meta webhook endpoint must:

- validate provider signature before business parsing;
- derive organization/target from stored external target IDs, not caller-supplied org claims;
- use provider event ID or deterministic dedupe key;
- acknowledge promptly after durable acceptance;
- queue slow work;
- never log secrets/raw tokens.

If Facebook Page video publishing can be reliably reconciled by polling for the initial release, webhook mutation may remain dormant while signature-ready infrastructure is implemented and tested.

## 16. Publishing UI

### `/publishing`

Replace readiness page with an operational workspace.

#### Channel health

Show:

- Meta configured/not configured/invalid/disabled;
- publication targets and channel type;
- safe last-verified metadata;
- no secret values.

#### Publish form

Fields:

- eligible approved video media asset;
- active Facebook Page target;
- caption;
- normalized preview;
- `Publish now`.

Do not show inactive/unapproved media as silently selectable. If a media asset is blocked, show the reason.

#### Status/history

Show:

- queued/submitting/processing/published/failed/submission-unknown;
- target;
- media identity;
- timestamp;
- safe external publication reference where available;
- normalized remediation/retry action only when backend says retry is safe.

Responsive/mobile behavior follows existing shell requirements.

## 17. Settings UI

Settings -> Integrations adds operational Meta management using existing Integration Vault patterns:

- App ID (non-secret where used)
- access token write-only
- optional App Secret write-only
- Save/Replace/Remove/Test/Enable/Disable for OWNER/ADMIN
- publication-target discovery/configuration flow that persists only selected safe target IDs/names

No stored token is prefilled or returned.

## 18. Error normalization

Normalize provider failures into stable categories including:

- `AUTH_INVALID`
- `PERMISSION_DENIED`
- `RATE_LIMITED`
- `TRANSIENT_PROVIDER`
- `INVALID_REQUEST`
- `NOT_FOUND`
- `CONFLICT`
- `CONTENT_FILTERED`
- `SUBMISSION_UNKNOWN`
- `UNKNOWN_PROVIDER_ERROR`

Raw Meta error bodies/tokens never reach client state.

## 19. Security and RLS

- Every publication target and attempt is organization-scoped.
- RLS enabled before release.
- Same-org read only for authorized operational roles.
- Direct authenticated write to execution state is revoked.
- SECURITY DEFINER functions pin `search_path`, revoke `public/anon`, validate `auth.uid()`, membership and role.
- Service-role functions are not granted to authenticated browser roles.
- Integration Vault remains the only durable secret source.
- Signed media URLs are short-lived and never persisted in publication rows.
- Cross-org target/media IDs fail before any provider secret resolution or external side effect.

## 20. Idempotency and duplicate prevention

The release must prove:

1. repeated browser submit for identical authoritative intent does not create multiple active jobs;
2. worker retry after pre-submit transient failure cannot create duplicate attempts/jobs unexpectedly;
3. confirmed provider publication ID is reused for reconciliation;
4. ambiguous transport after possible provider creation becomes `SUBMISSION_UNKNOWN`, not blind resubmit;
5. job completion is conditional on confirmed provider publication state, not merely a 2xx transport response.

## 21. Testing strategy

### Unit/TDD

- publication schemas/state machine;
- idempotency key normalization;
- approval eligibility;
- Meta adapter payload/error mapping with deterministic fake transport;
- duplicate-submit protection;
- submission-unknown behavior;
- retry qualification;
- secret redaction.

### Database/security

- schema/constraint tests;
- RLS role matrix;
- direct browser execution-state mutation blocked;
- cross-org target/media rejection;
- authenticated enqueue role checks;
- service-role claim privileges only;
- current approval predicate enforced at enqueue and execution.

### UI

- Settings Meta secret fields remain write-only;
- target configuration;
- Publishing channel health;
- eligible-media selection;
- publish-now pending/success/failure/submission-unknown states;
- retry shown only when safe.

### E2E

Use deterministic fake provider for CI. Verify end-to-end:

`approved media -> target -> enqueue -> worker/fake provider -> published state`

Also verify unapproved media cannot publish and duplicate submit does not create duplicate external fake publications.

### Live acceptance

A controlled real Facebook Page video smoke is required before claiming Meta provider acceptance, but only when a valid organization Meta token/page/permissions are available. If external credentials are absent, engineering may be released as `external acceptance pending`; the smoke must never be fabricated.

## 22. Release gates

Phase 10 is complete only when:

1. design + implementation plan are committed;
2. TDD/unit/integration tests pass;
3. typecheck and lint pass;
4. production Next.js build passes;
5. Playwright publishing journey passes;
6. Supabase migrations are live and migration history verified;
7. RLS/function ACL/security probes pass;
8. Supabase security/performance advisors are reviewed;
9. required Edge worker/dispatcher functions are deployed;
10. unattended empty/controlled worker dispatch is runtime-verified;
11. preview/staging Vercel deployment is READY;
12. exact-head CI is green;
13. live Meta smoke passes when valid credentials are present, otherwise explicitly remains external acceptance pending;
14. no Lovable dependency or changes are introduced.

## 23. Phase 11 handoff

Phase 10 must leave authoritative publication records ready for scheduling without redesign.

Phase 11 will add:

- `scheduled_for timestamptz` / timezone-safe scheduling authority as required by final implementation design;
- reschedule/cancel workflow;
- Content Calendar projection;
- dispatcher due-time filtering.

The Phase 10 publish-now path must therefore avoid encoding immediate execution assumptions into the provider adapter or publication identity.
