# PAK Marketing Automation — Master Technical Requirements Document (TRD)

**Document ID:** PAK-TRD-001  
**Version:** 1.1  
**Status:** Current baseline after Phase 7

## 1. Architecture summary

PAK is a Next.js App Router / TypeScript application with Supabase providing PostgreSQL, Auth, RLS, Storage, Vault, Edge Functions and scheduled database/HTTP execution. Browser and normal Next.js application code never own provider credentials or service-role capability.

Security-critical tenancy, approval/source integrity and paid-provider spend rules are enforced at server/database boundaries, not by browser state alone. Long-running provider work is represented by durable jobs and domain-specific attempt records. Phase 6 introduced versioned Scene Planning; Phase 7 introduced production LTX shot generation, reconciliation and generated-media import.

Existing requirement IDs retain their original meaning; additions introduced after the original baseline use new IDs.

## 2. Technology baseline

- **TRD-TECH-001** Next.js App Router + TypeScript.
- **TRD-TECH-002** React 19-compatible client/server component model.
- **TRD-TECH-003** Supabase Auth + PostgreSQL + RLS.
- **TRD-TECH-004** Zod for server-boundary validation.
- **TRD-TECH-005** Vitest + Testing Library for unit/component tests.
- **TRD-TECH-006** Playwright for browser E2E.
- **TRD-TECH-007** GitHub Actions for required CI gates.
- **TRD-TECH-008** Vercel or equivalent Next.js-compatible deployment platform for staging/production.
- **TRD-TECH-009** Supabase Storage for private media objects.
- **TRD-TECH-010** Supabase Vault for durable provider secret values.
- **TRD-TECH-011** Supabase Edge Functions for privileged provider execution where secrets/service-role access are required.
- **TRD-TECH-012** `pg_cron` + `pg_net` for unattended scheduled dispatch where appropriate.

## 3. Application boundaries

- **TRD-ARC-001** UI routes live under `src/app` and do not directly embed provider secrets.
- **TRD-ARC-002** Domain modules live under `src/modules/<domain>` and expose typed interfaces.
- **TRD-ARC-003** Supabase client construction is split into browser/session/server/admin or equivalent privileged boundaries.
- **TRD-ARC-004** `server-only` guards modules that can access service-role or provider secrets.
- **TRD-ARC-005** External provider SDKs/payloads are wrapped behind internal provider-neutral interfaces.
- **TRD-ARC-006** Long-running work is represented by durable database jobs rather than one HTTP request lifetime.
- **TRD-ARC-007** Browser-triggered paid-provider work sends identifiers only; authoritative prompt/model/configuration is reconstructed from approved persisted state.
- **TRD-ARC-008** Edge Functions that disable gateway JWT verification must implement explicit equivalent/stronger authentication in function code and are limited to internal worker/webhook use cases that cannot carry a user JWT.

## 4. Authentication and authorization

- **TRD-AUTH-001** Supabase Auth is identity source.
- **TRD-AUTH-002** Organization memberships map users to `OWNER | ADMIN | EDITOR | REVIEWER | ANALYST`.
- **TRD-AUTH-003** Browser/server requests using user sessions are constrained by RLS.
- **TRD-AUTH-004** Application permission checks improve UX but do not replace database authorization.
- **TRD-AUTH-005** SECURITY DEFINER functions are explicitly revoked from `public`/`anon` unless required by authenticated RLS and are granted only to the narrow role that needs execution.
- **TRD-AUTH-006** Worker/admin capabilities cannot be invoked by normal browser roles.
- **TRD-AUTH-007** Privileged internal Edge-to-Edge execution uses an environment/Vault-held credential and constant-time comparison when a user JWT is unavailable.

## 5. Multi-tenancy

- **TRD-TEN-001** Every tenant-owned root table contains `organization_id`.
- **TRD-TEN-002** Child resources that omit direct organization ownership are reachable only through organization-scoped parents with integrity enforcement.
- **TRD-TEN-003** Cross-organization reads and mutations are denied by RLS and validated in live probes for security-sensitive features.
- **TRD-TEN-004** Organization ownership columns on immutable-history/Knowledge entities cannot move between organizations after creation.
- **TRD-TEN-005** Generated-media storage paths are organization-prefixed and reconciled to same-org database rows.

## 6. Integration Vault architecture

Current implementation uses:

`integration_connections` → `integration_secrets` metadata/reference row → Supabase Vault secret value

plus immutable `integration_audit_events` and the authenticated `integration-vault` Edge Function.

- **TRD-SEC-001** Provider credentials are persisted only through server-side authenticated actions or RPCs.
- **TRD-SEC-002** Raw secret values are encrypted before durable storage using a server-held encryption root secret or Supabase-supported Vault primitive; the current implementation uses Supabase Vault.
- **TRD-SEC-003** Browser roles have no SQL policy allowing raw encrypted/plain secret retrieval.
- **TRD-SEC-004** Read APIs return metadata only: provider, configuration status, masked identifier, timestamps, actor and health state.
- **TRD-SEC-005** Secret replacement writes a new secret value/version and invalidates stale provider-client state where applicable.
- **TRD-SEC-006** Secret deletion removes or cryptographically renders the value unusable and records audit metadata.
- **TRD-SEC-007** Provider secrets must not be logged, serialized to client components, placed in URLs, analytics, error payloads or browser storage.
- **TRD-SEC-008** OpenAI organization generation resolves the configured Integration Vault credential first; deployment bootstrap key is used only if explicitly enabled for that environment.
- **TRD-SEC-009** Service-role credentials remain deployment/bootstrap secrets and are never user-configurable through Integration Vault.
- **TRD-SEC-010** Provider connection testing returns normalized health only and should avoid billable operations where possible; current LTX testing uses an authenticated read-only nonexistent-job lookup.

## 7. AI text generation

- **TRD-AI-001** Use an internal `TextGenerationProvider` interface.
- **TRD-AI-002** OpenAI adapter is server-only.
- **TRD-AI-003** CI uses deterministic fake provider and consumes zero live AI credits.
- **TRD-AI-004** Runtime model selection is configuration-driven and not coupled to content domain persistence.
- **TRD-AI-005** Grounding context is server-composed from approved sources and bounded before provider call.
- **TRD-AI-006** Provider errors are normalized to safe domain errors.
- **TRD-AI-007** Provider/model metadata is persisted for generated artifacts where required for audit/debugging.

## 8. Knowledge grounding

- **TRD-KB-001** Client submits UUID list only.
- **TRD-KB-002** Server loads same-org records using authenticated session.
- **TRD-KB-003** Only ACTIVE records proceed.
- **TRD-KB-004** Generation context uses deterministic ordering matching submitted IDs.
- **TRD-KB-005** Immutable snapshots capture exact record revision/title/content/source metadata at generation time.
- **TRD-KB-006** Snapshot writes are backend/admin-only after authenticated server-side resolution.
- **TRD-KB-007** Snapshot rows expose authenticated SELECT to same-org members but no authenticated INSERT/UPDATE/DELETE.

## 9. Content artifacts

- **TRD-CONT-001** `content_items` is workflow parent.
- **TRD-CONT-002** `content_script_artifacts` stores current canonical/translation artifacts.
- **TRD-CONT-003** Unique `(content_item_id, language)` and partial unique one-source invariant are database-enforced.
- **TRD-CONT-004** Translation `source_revision` records canonical revision used.
- **TRD-CONT-005** Source regeneration and stale translation transitions are compare-and-set/idempotent where concurrent completions are possible.
- **TRD-CONT-006** Scene Planning handoff identifies a persisted artifact; authoritative script/revision is reloaded server-side.

## 10. Scene Planning architecture

The current Scene Planning model supersedes `video_scenes` as the authoritative planning domain.

Canonical hierarchy:

`content_script_artifacts` → `video_projects` → `visual_bibles` → `scene_plan_versions` → `scene_plan_scenes` → `scene_plan_shots`

with `scene_plan_qc_findings` as deterministic QC/review state.

- **TRD-SCENE-001** A `video_project` is organization-scoped and source-bound to a script artifact/revision/integrity hash.
- **TRD-SCENE-002** Visual Bible state is versioned and project-scoped.
- **TRD-SCENE-003** Scene Plan versions are copy-on-write; approved versions are immutable except permitted lifecycle metadata transitions such as stale/superseded.
- **TRD-SCENE-004** Canonical narration remains authoritative; scene/shot narration spans reference exact source character ranges and planner/provider output may not silently rewrite it.
- **TRD-SCENE-005** Manual edits/reordering invalidate stale QC and return plan state to QC_REQUIRED.
- **TRD-SCENE-006** Granular scene/shot replan postconditions prevent mutation outside requested scope and protect human-modified shots unless explicit replacement is authorized.
- **TRD-SCENE-007** Deterministic QC validates source freshness, contiguous ordering, narration coverage, duration relationships, references and generation requirements before approval.
- **TRD-SCENE-008** Scene Planning itself does not call video providers; it produces a provider-neutral approved-shot handoff.

## 11. Durable jobs

- **TRD-JOB-001** Job states are `QUEUED`, `PROCESSING`, `COMPLETED`, `FAILED`, `RETRYING`, `CANCELLED`.
- **TRD-JOB-002** Claim uses row locking/`SKIP LOCKED` semantics and lease ownership.
- **TRD-JOB-003** Job records include organization, type, payload reference, attempt count, idempotency key, failure metadata and timestamps.
- **TRD-JOB-004** Retry policy distinguishes transient provider/network failures from terminal validation/auth errors.
- **TRD-JOB-005** Publish/render operations must be idempotent at the domain boundary.
- **TRD-JOB-006** Normal browser roles cannot directly claim worker jobs or create provider-attempt lineage for paid generation.
- **TRD-JOB-007** A privileged unattended dispatcher may lease due work in bounded batches and release leases after execution.

## 12. Media and video

The original TRD-VID IDs keep their original semantic meaning; the post-Phase 7 execution rules are appended as new IDs.

- **TRD-VID-001** `media_assets` is provider-agnostic and organization-scoped.
- **TRD-VID-002** `video_scenes` is the original foundation linking early content planning to generated media; it is retained for compatibility, while current Scene Planning uses the normalized `video_projects` / Visual Bible / plan-version / scene / shot hierarchy.
- **TRD-VID-003** Media migration dependencies apply cleanly from an empty database in filename order.
- **TRD-VID-004** Provider adapters expose submit/status/result/error contracts independent of LTX-specific payload structure.
- **TRD-VID-005** Final assembly is a separate job from per-scene/per-shot generation.
- **TRD-VID-006** Final render readiness is false if there are zero required components or any required component is incomplete/failed.
- **TRD-VID-007** Current per-shot provider execution uses durable `VIDEO_SHOT_GENERATION` jobs plus `video_generation_attempts` lineage.
- **TRD-VID-008** Authenticated enqueue is the sole browser-accessible paid-generation creation boundary and revalidates role, tenant, plan approval, source freshness, QC blockers, shot lineage and supported parameters.
- **TRD-VID-009** Browser clients submit organization/plan/shot identifiers only; provider prompt/model/configuration are reconstructed from approved persisted data.
- **TRD-VID-010** `video_generation_attempts` records provider/model/job ID, normalized state, attempt number, timing, error/retryability, prompt hash and optional imported media link without storing credentials.
- **TRD-VID-011** Retry is bounded to four attempts with 5/15/45-second eligibility; `SUBMISSION_UNKNOWN` is not automatically retried.
- **TRD-VID-012** LTX completion moves to `IMPORT_PENDING`; result bytes are downloaded/validated/checksummed and uploaded to private PAK storage before completion.
- **TRD-VID-013** Provider result URLs are ephemeral transport data and are not persisted as durable media identity.
- **TRD-VID-014** Unattended submit/reconcile/retry uses Edge workers, a Vault-held internal dispatcher credential and scheduled `pg_cron`/`pg_net` dispatch.

## 13. Media architecture additions

- **TRD-MEDIA-001** `media_assets` stores provider-agnostic metadata and a private storage path.
- **TRD-MEDIA-002** Generated Phase 7 video uses the private `generated-media` bucket and deterministic organization-prefixed object paths.
- **TRD-MEDIA-003** Generated media lineage is linked through `generating_job_id` and generation attempt/job metadata; legacy `media_assets.scene_id` is not forced into a Scene Planning FK.
- **TRD-MEDIA-004** Media import finalization is idempotent by `(organization_id, storage_path)` and may complete only an `IMPORT_PENDING` attempt.
- **TRD-MEDIA-005** Full operator Media Library upload/catalogue/preview/delete workflows remain Phase 8 work.

## 14. Publishing integrations

- **TRD-PUB-001** Meta publishing uses server-side Integration Vault credentials.
- **TRD-PUB-002** OAuth/token refresh, where supported, occurs server-side.
- **TRD-PUB-003** Webhooks validate signatures before accepting provider events.
- **TRD-PUB-004** Publish attempts persist idempotency/reference/provider response metadata without raw credentials.
- **TRD-PUB-005** Channel adapters normalize provider-specific errors/statuses.

**Current maturity:** retained baseline requirements; implementation starts Phase 10.

## 15. API/server action rules

- **TRD-API-001** Validate all untrusted inputs with Zod or equivalent typed schema at server boundary.
- **TRD-API-002** Resolve actor and organization membership server-side.
- **TRD-API-003** Re-read authoritative database records instead of trusting browser-submitted business state.
- **TRD-API-004** Return serializable safe error objects; no raw exception propagation to client.
- **TRD-API-005** Mutations requiring privileged DB bypass first complete authorization using the user-scoped boundary, then use narrowly scoped privileged persistence.
- **TRD-API-006** Internal dispatcher operations accept no browser-controlled provider payload and revalidate job/attempt/tenant lineage before provider spend.

## 16. Database migration discipline

- **TRD-DB-001** Migrations are append-only after application to a shared database; corrections use new forward migrations.
- **TRD-DB-002** A fresh database applies repository migrations sequentially without manual reordering.
- **TRD-DB-003** DDL changes use Supabase migration tooling, not ad hoc production SQL, except transactional/read-only verification probes.
- **TRD-DB-004** Every new tenant table enables RLS before release.
- **TRD-DB-005** Security-sensitive triggers/functions explicitly set safe `search_path` and privilege grants.
- **TRD-DB-006** Production migration deployment is verified against live migration history before release claims.

## 17. Error handling and observability

- **TRD-OBS-001** Domain errors use stable codes such as VALIDATION_ERROR, UNAUTHORIZED, FORBIDDEN, NOT_FOUND, CONFLICT, PROVIDER_ERROR, INTERNAL_ERROR.
- **TRD-OBS-002** Logs contain correlation IDs/job IDs/provider request IDs where available.
- **TRD-OBS-003** Secrets and sensitive credentials are redacted by construction, not after logging.
- **TRD-OBS-004** Runtime dashboards distinguish application, provider, database and job failures.
- **TRD-OBS-005** Provider-specific raw error bodies are not passed directly to browser UI.

## 18. Deployment environments

- **TRD-DEP-001** `main` deploys to staging first until production promotion is explicitly approved by environment governance.
- **TRD-DEP-002** Preview/staging use dedicated PAK Supabase project(s) only.
- **TRD-DEP-003** Aurexis/Lovable systems are prohibited deployment dependencies for PAK.
- **TRD-DEP-004** Required bootstrap environment variables include Supabase URL/anon key and server-only service-role key; organization provider keys live in Integration Vault.
- **TRD-DEP-005** Deployment must pass production build before promotion.
- **TRD-DEP-006** External hosting quota/rate-limit failures are recorded as infrastructure blockers and must not be misreported as application build/test failures.

## 19. Testing gates

- **TRD-TEST-001** Every feature/bugfix starts with a failing test when behavior is testable.
- **TRD-TEST-002** CI requires typecheck, lint, unit/integration, production build and applicable Playwright E2E.
- **TRD-TEST-003** RLS/security-sensitive changes require structural SQL assertions plus live Supabase probes before merge.
- **TRD-TEST-004** External AI/media provider CI paths use deterministic fakes; live provider smoke tests are manual/controlled and never required for every CI run.
- **TRD-TEST-005** Merge claims require evidence from the exact PR head.
- **TRD-TEST-006** A paid-provider feature may be infrastructure-release-ready without a paid smoke only when credentials/credits are unavailable and deferred operational acceptance is explicitly documented rather than falsely claimed.

## 20. Performance requirements

- **TRD-PERF-001** Database list APIs page results and use indexed organization/status/search filters.
- **TRD-PERF-002** Avoid loading full Knowledge record content into browser selectors when metadata is sufficient.
- **TRD-PERF-003** Expensive generation/render/publishing does not hold browser request connections for provider-scale durations when a durable job can represent progress.
- **TRD-PERF-004** Large context/media payloads have explicit size limits before provider invocation.
- **TRD-PERF-005** Unattended dispatch uses bounded batches and leases to prevent concurrent duplicate processing.

## 21. Security acceptance

A feature touching credentials, authorization, organization ownership, immutable history, paid provider spend or external publishing cannot be release-ready until its database policy/privilege model and server/Edge boundary have both been reviewed and exercised with negative tests.

Provider-spend workflows additionally require proof that a normal authenticated browser cannot directly create provider attempts, bypass approved source/QC state, retrieve secrets or invoke internal worker capability.