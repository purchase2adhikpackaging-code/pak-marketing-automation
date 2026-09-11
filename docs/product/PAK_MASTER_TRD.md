# PAK Marketing Automation — Master Technical Requirements Document (TRD)

**Document ID:** PAK-TRD-001  
**Version:** 1.1  
**Status:** Current baseline after Phase 7

## 1. Architecture summary

PAK is a Next.js App Router / TypeScript application with Supabase providing PostgreSQL, Auth, RLS, Storage, Vault, Edge Functions and scheduled database/HTTP execution. Browser and normal Next.js application code never own provider credentials or service-role capability.

Security-critical tenancy, approval/source integrity and paid-provider spend rules are enforced at server/database boundaries, not by browser state alone. Long-running provider work is represented by durable jobs and domain-specific attempt records. Phase 6 introduced versioned Scene Planning; Phase 7 introduced production LTX shot generation, reconciliation and generated-media import.

## 2. Technology baseline

- **TRD-TECH-001** Next.js App Router + TypeScript.
- **TRD-TECH-002** React 19-compatible client/server component model.
- **TRD-TECH-003** Supabase Auth + PostgreSQL + RLS.
- **TRD-TECH-004** Supabase Storage for private media objects.
- **TRD-TECH-005** Supabase Vault for durable provider secret values.
- **TRD-TECH-006** Supabase Edge Functions for privileged provider execution where secrets/service-role access are required.
- **TRD-TECH-007** `pg_cron` + `pg_net` for unattended scheduled dispatch where appropriate.
- **TRD-TECH-008** Zod for server-boundary validation.
- **TRD-TECH-009** Vitest + Testing Library for unit/component tests.
- **TRD-TECH-010** Playwright for browser E2E.
- **TRD-TECH-011** GitHub Actions for required CI gates.
- **TRD-TECH-012** Vercel or equivalent Next.js-compatible deployment platform for hosted web application delivery.

## 3. Application boundaries

- **TRD-ARC-001** UI routes live under `src/app` and never embed raw provider secrets.
- **TRD-ARC-002** Domain modules live under `src/modules/<domain>` and expose typed interfaces.
- **TRD-ARC-003** Supabase client construction is split into browser/session/server/privileged boundaries.
- **TRD-ARC-004** `server-only` guards modules that can access privileged server capability.
- **TRD-ARC-005** External provider SDK/API payloads are wrapped behind internal provider-neutral interfaces.
- **TRD-ARC-006** Long-running work is represented by durable database jobs rather than relying on a single browser request lifetime.
- **TRD-ARC-007** Browser-triggered paid-provider work sends identifiers only. Authoritative prompt/model/configuration is reconstructed server/database-side from approved domain state.
- **TRD-ARC-008** Supabase Edge Functions that disable gateway JWT verification must implement an explicit equivalent or stronger authentication boundary in function code; this exception is permitted only for internal worker/webhook patterns that cannot carry a user JWT.

## 4. Authentication and authorization

- **TRD-AUTH-001** Supabase Auth is the identity source.
- **TRD-AUTH-002** Organization memberships map users to `OWNER | ADMIN | EDITOR | REVIEWER | ANALYST`.
- **TRD-AUTH-003** Browser/server requests using user sessions are constrained by RLS.
- **TRD-AUTH-004** Application permission checks improve UX but do not replace database authorization.
- **TRD-AUTH-005** SECURITY DEFINER functions are explicitly revoked from `public`/`anon` and granted only to the narrow role that requires them.
- **TRD-AUTH-006** Worker/admin capabilities cannot be invoked by normal browser roles.
- **TRD-AUTH-007** Privileged internal Edge-to-Edge execution uses an environment/Vault-held credential and constant-time token comparison where a user JWT is not available.

## 5. Multi-tenancy

- **TRD-TEN-001** Every tenant-owned root table contains `organization_id`.
- **TRD-TEN-002** Child resources are reachable only through organization-scoped parents and parent-organization integrity checks.
- **TRD-TEN-003** Cross-organization reads and mutations are denied by RLS and validated with negative tests/live probes for security-sensitive features.
- **TRD-TEN-004** Organization ownership columns on immutable/history/provenance entities cannot be moved between organizations after creation.
- **TRD-TEN-005** Storage object paths for generated media begin with the owning organization identifier and are reconciled to same-org database rows.

## 6. Integration Vault architecture

Current implementation uses:

`integration_connections` → `integration_secrets` metadata/reference row → Supabase Vault secret value

plus immutable `integration_audit_events` and the authenticated `integration-vault` Edge Function.

- **TRD-SEC-001** Provider credentials are written only through authenticated server/Edge actions and narrowly scoped privileged RPCs.
- **TRD-SEC-002** Raw secret values are stored in Supabase Vault; `integration_secrets` stores non-plaintext secret metadata/reference (`vault_secret_id`) and migration compatibility fields.
- **TRD-SEC-003** Browser roles have no SQL policy allowing raw secret retrieval.
- **TRD-SEC-004** Read APIs return safe metadata only: provider, configuration status, masked identifier, timestamps, actor and health state.
- **TRD-SEC-005** Secret replacement rotates the Vault value and increments connection secret version without returning the new value.
- **TRD-SEC-006** Secret deletion removes the Vault value/reference and records audit metadata.
- **TRD-SEC-007** Provider secrets are not logged, serialized to client components, placed in URLs, analytics or browser storage.
- **TRD-SEC-008** Organization-scoped provider resolution uses the configured Integration Vault credential; deployment bootstrap credentials may be used only when explicitly enabled by environment policy.
- **TRD-SEC-009** Service-role credentials remain deployment/runtime infrastructure secrets and are never user-configurable through Settings.
- **TRD-SEC-010** Connection testing returns normalized health only. When possible, tests avoid billable provider operations; LTX uses an authenticated read-only nonexistent-job lookup rather than submitting a render.

## 7. AI text generation

- **TRD-AI-001** Use an internal `TextGenerationProvider` interface.
- **TRD-AI-002** OpenAI adapter and organization credential resolution are server-side.
- **TRD-AI-003** CI uses deterministic fake providers and consumes zero live AI credits.
- **TRD-AI-004** Runtime model selection is configuration-driven and not coupled to content persistence.
- **TRD-AI-005** Grounding context is server-composed from approved sources and bounded before provider invocation.
- **TRD-AI-006** Provider errors are normalized to safe domain errors.
- **TRD-AI-007** Provider/model metadata is persisted where required for audit/debugging.

## 8. Knowledge grounding

- **TRD-KB-001** Client submits Knowledge UUID list only.
- **TRD-KB-002** Server loads same-org records using the authenticated session.
- **TRD-KB-003** Only ACTIVE records proceed.
- **TRD-KB-004** Generation context uses deterministic ordering matching submitted IDs.
- **TRD-KB-005** Immutable snapshots capture exact revision/title/content/source metadata at generation time.
- **TRD-KB-006** Snapshot writes are privileged backend operations only after authenticated server-side resolution.
- **TRD-KB-007** Snapshot rows expose authenticated same-org SELECT but no authenticated INSERT/UPDATE/DELETE.

## 9. Content artifacts

- **TRD-CONT-001** `content_items` is the content workflow parent.
- **TRD-CONT-002** `content_script_artifacts` stores current canonical/translation artifacts.
- **TRD-CONT-003** Unique `(content_item_id, language)` and one-source invariants are database-enforced.
- **TRD-CONT-004** Translation `source_revision` records canonical revision used.
- **TRD-CONT-005** Source regeneration and stale translation transitions are compare-and-set/idempotent where concurrent completions are possible.
- **TRD-CONT-006** Scene Planning handoff identifies the persisted artifact; authoritative script/revision is reloaded server-side.

## 10. Scene Planning architecture

The current Scene Planning model supersedes `video_scenes` as the authoritative planning domain.

Canonical hierarchy:

`content_script_artifacts` → `video_projects` → `visual_bibles` → `scene_plan_versions` → `scene_plan_scenes` → `scene_plan_shots`

with `scene_plan_qc_findings` as deterministic review/QC state.

- **TRD-SCENE-001** A `video_project` is organization-scoped and source-bound to a script artifact/revision/integrity hash.
- **TRD-SCENE-002** Visual Bible state is versioned and project-scoped.
- **TRD-SCENE-003** Scene Plan versions are copy-on-write. Approved versions are immutable except permitted lifecycle metadata transitions such as stale/superseded.
- **TRD-SCENE-004** Canonical narration remains authoritative. Scene/shot narration spans reference exact source character ranges and planner/provider output may not silently rewrite it.
- **TRD-SCENE-005** Manual edits/reordering invalidate stale QC and return the plan to a QC-required state.
- **TRD-SCENE-006** Granular scene/shot replan postconditions prevent unintended mutation outside the requested scope and protect human-modified shots unless explicit replacement is authorized.
- **TRD-SCENE-007** Deterministic QC validates source freshness, contiguous ordering, narration coverage, duration relationships, references and generation requirements before approval.
- **TRD-SCENE-008** Scene Planning itself does not call video providers; it produces an immutable provider-neutral approved-shot handoff.

## 11. Durable jobs

- **TRD-JOB-001** Core job states are `QUEUED`, `PROCESSING`, `COMPLETED`, `FAILED`, `RETRYING`, `CANCELLED`.
- **TRD-JOB-002** Worker claim uses row locking/`SKIP LOCKED` semantics and lease ownership.
- **TRD-JOB-003** Job records include organization, type/resource, input/result payload, attempt count, max attempts, idempotency key, retry policy, failure metadata and timestamps.
- **TRD-JOB-004** Retry policy distinguishes transient provider/network failures from terminal validation/auth/content errors.
- **TRD-JOB-005** Publish/render operations are idempotent at the domain boundary.
- **TRD-JOB-006** Normal browser roles cannot directly claim worker jobs or create provider-attempt lineage for paid generation.
- **TRD-JOB-007** A privileged unattended dispatcher may lease due work in bounded batches and release leases after execution.

## 12. Video generation provider architecture

- **TRD-VID-001** `media_assets` is provider-agnostic and organization-scoped.
- **TRD-VID-002** `video_scenes` remains a legacy/foundation entity; new Scene Planning uses normalized project/visual-bible/version/scene/shot tables.
- **TRD-VID-003** Media and video migrations apply cleanly from an empty database in repository order.
- **TRD-VID-004** Provider adapters expose submit/status/result/error contracts independent of LTX-specific payload structure.
- **TRD-VID-005** Per-shot provider execution uses durable `VIDEO_SHOT_GENERATION` jobs plus `video_generation_attempts` lineage.
- **TRD-VID-006** Authenticated enqueue is the sole browser-accessible paid-generation creation boundary. It revalidates role, tenant, plan approval, source freshness, QC blockers, shot lineage and supported generation parameters.
- **TRD-VID-007** Browser clients submit organization/plan/shot identifiers only; provider prompt/model/configuration are reconstructed from approved persisted data.
- **TRD-VID-008** `video_generation_attempts` records provider/model/job ID, normalized state, attempt number, timing, error/retryability, prompt hash and optional imported media link without storing provider credentials.
- **TRD-VID-009** Retry is bounded to four attempts with current backoff eligibility of 5/15/45 seconds. `SUBMISSION_UNKNOWN` is not automatically retried.
- **TRD-VID-010** LTX completion moves to `IMPORT_PENDING`; provider result bytes are downloaded/validated/checksummed and uploaded to private PAK storage before job completion.
- **TRD-VID-011** Provider result URLs are ephemeral transport data and are not persisted as durable media identity.
- **TRD-VID-012** Unattended submit/reconcile/retry is performed by Edge workers using a Vault-held internal dispatcher credential and scheduled `pg_cron`/`pg_net` dispatch.
- **TRD-VID-013** Final video assembly is a separate future durable job from per-shot generation and must validate component/readiness state before render.

## 13. Media architecture

- **TRD-MEDIA-001** `media_assets` stores provider-agnostic metadata and a private storage path.
- **TRD-MEDIA-002** Generated Phase 7 video uses the private `generated-media` bucket and deterministic organization-prefixed object paths.
- **TRD-MEDIA-003** Generated media lineage is linked through `generating_job_id` and video-generation attempt/job metadata. The legacy `media_assets.scene_id` field is not used to force a Scene Planning FK.
- **TRD-MEDIA-004** Media import finalization is idempotent by `(organization_id, storage_path)` and may only complete an `IMPORT_PENDING` attempt.
- **TRD-MEDIA-005** Full operator Media Library upload/catalogue/preview/delete workflows remain Phase 8 work.

## 14. Publishing integrations

- **TRD-PUB-001** Meta publishing uses server-side Integration Vault credentials.
- **TRD-PUB-002** OAuth/token refresh, where supported, occurs server-side.
- **TRD-PUB-003** Webhooks validate signatures before accepting provider events.
- **TRD-PUB-004** Publish attempts persist idempotency/reference/provider response metadata without raw credentials.
- **TRD-PUB-005** Channel adapters normalize provider-specific errors/statuses.

**Current maturity:** Requirements retained; implementation starts Phase 10.

## 15. API/server action rules

- **TRD-API-001** Validate untrusted inputs with Zod or equivalent typed schema at server/Edge boundaries.
- **TRD-API-002** Resolve actor and organization membership server-side.
- **TRD-API-003** Re-read authoritative database records instead of trusting browser-submitted business state.
- **TRD-API-004** Return serializable safe errors; never propagate raw provider/SQL/stack exceptions to clients.
- **TRD-API-005** Mutations requiring privileged bypass first validate authorization/domain state, then use a narrowly scoped privileged operation.
- **TRD-API-006** Internal dispatcher operations accept no browser-controlled provider payload and revalidate job/attempt/tenant lineage before provider spend.

## 16. Database migration discipline

- **TRD-DB-001** Shared migrations are append-only after application; corrections use forward migrations.
- **TRD-DB-002** A fresh database applies repository migrations sequentially without manual reordering.
- **TRD-DB-003** DDL changes use Supabase migration tooling, not ad hoc production SQL, except read-only/transactional verification probes.
- **TRD-DB-004** Every tenant table enables RLS before release.
- **TRD-DB-005** Security-sensitive triggers/functions explicitly set safe `search_path` and privilege grants.
- **TRD-DB-006** Production migration deployment is verified against live migration history before release claims.

## 17. Error handling and observability

- **TRD-OBS-001** Domain errors use stable normalized codes such as VALIDATION_ERROR, UNAUTHORIZED, FORBIDDEN, NOT_FOUND, CONFLICT, PROVIDER_ERROR and INTERNAL_ERROR.
- **TRD-OBS-002** Logs contain correlation/job/provider request IDs where available.
- **TRD-OBS-003** Secrets and sensitive credentials are redacted by construction.
- **TRD-OBS-004** Operational status distinguishes application, provider, database and job failures.
- **TRD-OBS-005** Provider-specific raw error bodies are not passed directly to browser UI.

## 18. Deployment environments

- **TRD-DEP-001** `main` is the protected product baseline; hosted promotion policy may stage before production according to environment governance.
- **TRD-DEP-002** PAK uses its dedicated Supabase project(s) only.
- **TRD-DEP-003** Aurexis/Lovable systems are prohibited dependencies for PAK.
- **TRD-DEP-004** Bootstrap environment variables include Supabase URL/anon key and server-only service-role key; organization provider credentials live in Integration Vault.
- **TRD-DEP-005** Deployment must pass production build before promotion.
- **TRD-DEP-006** External hosting quota/rate-limit failures are recorded as infrastructure blockers and must not be misreported as application test failures.

## 19. Testing gates

- **TRD-TEST-001** Every behavior change starts with a failing test when behavior is testable.
- **TRD-TEST-002** CI requires typecheck, lint, unit/integration, production build and applicable Playwright E2E.
- **TRD-TEST-003** RLS/security-sensitive changes require structural SQL assertions plus live Supabase probes before merge.
- **TRD-TEST-004** External AI/media provider CI paths use deterministic fakes; live provider smoke tests are controlled operational acceptance checks rather than mandatory paid CI.
- **TRD-TEST-005** Merge claims require evidence from the exact PR head.
- **TRD-TEST-006** A paid provider feature may be infrastructure-release-ready without a live paid smoke only when credentials/credits are unavailable, provided the deferred acceptance check is explicitly documented and not falsely claimed.

## 20. Performance requirements

- **TRD-PERF-001** Database list APIs page results and use indexed organization/status/search filters.
- **TRD-PERF-002** Avoid loading full Knowledge content into browser selectors when metadata is sufficient.
- **TRD-PERF-003** Expensive generation/render/publishing does not hold browser request connections for provider-scale durations when a durable job can represent progress.
- **TRD-PERF-004** Large context/media payloads have explicit size limits before provider invocation/import.
- **TRD-PERF-005** Unattended dispatch uses bounded batches and leases to prevent concurrent duplicate processing.

## 21. Security acceptance

A feature touching credentials, authorization, organization ownership, immutable history, paid provider spend or external publishing cannot be considered release-ready until both its database policy/privilege model and server/Edge boundary have been reviewed and exercised with negative tests.

For provider-spend workflows, security acceptance additionally requires proof that a normal authenticated browser cannot directly create provider attempts, bypass approved source/QC state, retrieve secrets or invoke internal worker capability.