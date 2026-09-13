# PAK Marketing Automation — Master Technical Requirements Document (TRD)

**Document ID:** PAK-TRD-001  
**Version:** 1.2  
**Status:** Current baseline through Organization Profile / Brand Kit / Knowledge ingestion foundation

## 1. Architecture summary

PAK is a Next.js App Router / TypeScript application with Supabase providing PostgreSQL, Auth, RLS, Storage, Vault, Edge Functions and scheduled database/HTTP execution. Browser and normal Next.js application code never own provider credentials or service-role capability.

Security-critical tenancy, organization identity, Knowledge approval/source integrity and paid-provider spend rules are enforced at server/database boundaries, not by browser state alone. Authoritative Organization Profile, Brand Kit and Knowledge are resolved server-side through a shared generation-context boundary. Uploaded document binaries remain private Media Library assets; ingestion metadata and extracted text remain organization-scoped in PostgreSQL; successful extraction creates reviewable DRAFT Knowledge only. Long-running provider work is represented by durable jobs and domain-specific attempt records.

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
- **TRD-TECH-013** Node-compatible extraction libraries may parse bounded PDF/DOCX/PPTX/TXT payloads; OCR and spreadsheet ingestion are outside the current ingestion slice.

## 3. Application boundaries

- **TRD-ARC-001** UI routes live under `src/app` and do not directly embed provider secrets.
- **TRD-ARC-002** Domain modules live under `src/modules/<domain>` and expose typed interfaces.
- **TRD-ARC-003** Supabase client construction is split into browser/session/server/admin or equivalent privileged boundaries.
- **TRD-ARC-004** `server-only` guards modules that can access service-role, authoritative organization generation context or provider secrets.
- **TRD-ARC-005** External provider SDKs/payloads are wrapped behind internal provider-neutral interfaces.
- **TRD-ARC-006** Long-running work is represented by durable database jobs rather than one HTTP request lifetime.
- **TRD-ARC-007** Browser-triggered paid-provider work sends identifiers only; authoritative prompt/model/configuration is reconstructed from approved persisted state.
- **TRD-ARC-008** Edge Functions that disable gateway JWT verification must implement explicit equivalent/stronger authentication in function code and are limited to internal worker/webhook use cases that cannot carry a user JWT.
- **TRD-ARC-009** Browser generation requests carry organization ID, selected Knowledge IDs and bounded task context only; authoritative Profile/Brand/Knowledge content is reloaded server-side.
- **TRD-ARC-010** Brand Kit persists safe Media Library UUID references only; signed URLs and storage object paths remain request-scoped transport details.
- **TRD-ARC-011** Knowledge file ingestion accepts an existing private Media Library DOCUMENT asset ID; URL ingestion passes through a server-only SSRF safety boundary before fetch/extraction.

## 4. Authentication and authorization

- **TRD-AUTH-001** Supabase Auth is identity source.
- **TRD-AUTH-002** Organization memberships map users to `OWNER | ADMIN | EDITOR | REVIEWER | ANALYST`.
- **TRD-AUTH-003** Browser/server requests using user sessions are constrained by RLS.
- **TRD-AUTH-004** Application permission checks improve UX but do not replace database authorization.
- **TRD-AUTH-005** SECURITY DEFINER functions are explicitly revoked from `public`/`anon` unless required by an authenticated workflow and are granted only to the narrow role that needs execution; callable functions perform their own actor/tenant/role/integrity checks.
- **TRD-AUTH-006** Worker/admin capabilities cannot be invoked by normal browser roles.
- **TRD-AUTH-007** Privileged internal Edge-to-Edge execution uses an environment/Vault-held credential and constant-time comparison when a user JWT is unavailable.
- **TRD-AUTH-008** OWNER/ADMIN may mutate Organization Profile, Brand Kit and Core Knowledge state; EDITOR may manage normal Knowledge and ingestion but cannot create or toggle Core state; REVIEWER/ANALYST are read-only for these surfaces.
- **TRD-AUTH-009** Database table privileges are least-privilege in addition to RLS. Feature tables must revoke inherited broad `anon`/`authenticated` grants before granting only required operations; provenance tables expose authenticated SELECT only.
- **TRD-AUTH-010** Core Knowledge authorization is enforced for both INSERT and UPDATE so direct Data API writes cannot bypass UI role restrictions.

## 5. Multi-tenancy

- **TRD-TEN-001** Every tenant-owned root table contains `organization_id`.
- **TRD-TEN-002** Child resources that omit direct organization ownership are reachable only through organization-scoped parents with integrity enforcement.
- **TRD-TEN-003** Cross-organization reads and mutations are denied by RLS and validated in live probes for security-sensitive features.
- **TRD-TEN-004** Organization ownership columns on immutable-history/Knowledge entities cannot move between organizations after creation.
- **TRD-TEN-005** Generated-media storage paths are organization-prefixed and reconciled to same-org database rows.
- **TRD-TEN-006** Brand asset assignment validates referenced `media_assets.organization_id`, ACTIVE state and image type/MIME before persistence.
- **TRD-TEN-007** Knowledge FILE source lineage validates same-org ACTIVE DOCUMENT `media_assets`; cross-org IDs are rejected without requiring tenant-existence disclosure.

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
- **TRD-AI-005** Grounding context is server-composed from authoritative Profile, Brand Kit, approved Knowledge and bounded task context before provider call.
- **TRD-AI-006** Provider errors are normalized to safe domain errors.
- **TRD-AI-007** Provider/model metadata is persisted for generated artifacts where required for audit/debugging.
- **TRD-AI-008** Shared generation context order is deterministic: Profile → Brand Kit → ACTIVE Core Knowledge → selected ACTIVE Knowledge → task context.
- **TRD-AI-009** Duplicate selected Knowledge IDs collapse preserving first occurrence; a Core source explicitly selected is represented once.
- **TRD-AI-010** Exact Profile revision, Brand Kit revision and Knowledge snapshots used for successful generation are persisted atomically before the source artifact is exposed as successful.

## 8. Knowledge grounding and ingestion

- **TRD-KB-001** Client submits Knowledge UUID list only.
- **TRD-KB-002** Server loads same-org records using authenticated session/RLS-backed repository access.
- **TRD-KB-003** Only ACTIVE records proceed into grounding.
- **TRD-KB-004** Explicit selected Knowledge preserves request order after duplicate collapse.
- **TRD-KB-005** Immutable snapshots capture exact record revision/title/content/source metadata at generation time.
- **TRD-KB-006** Provenance snapshots are written only through the guarded atomic generation-provenance RPC after authenticated server-side resolution.
- **TRD-KB-007** Snapshot rows expose authenticated SELECT to same-org members but no direct authenticated INSERT/UPDATE/DELETE privileges.
- **TRD-KB-008** ACTIVE `is_core=true` Knowledge is server-selected automatically and deterministically for every relevant generation.
- **TRD-KB-009** Cross-org, missing or non-ACTIVE explicit Knowledge IDs cannot become grounding and fail safely before provider invocation.
- **TRD-KB-010** `knowledge_documents` models FILE/URL source lineage with `PENDING | PROCESSING | EXTRACTED | FAILED` extraction state and immutable source identity.
- **TRD-KB-011** Successful PDF/DOCX/PPTX/TXT/URL extraction finalizes document lineage and resulting Knowledge creation in one guarded transaction, and resulting Knowledge status is always DRAFT.
- **TRD-KB-012** `knowledge_records.knowledge_document_id` and document revision linkage preserve ingestion provenance; ingestion never silently activates Knowledge.
- **TRD-KB-013** URL safety allows only HTTP/HTTPS public destinations and rejects loopback, private, link-local, cloud-metadata, unsafe DNS/address outcomes and unsafe redirects.
- **TRD-KB-014** Extracted content and source payloads have explicit size bounds and sanitized error mapping; raw provider/network/SQL errors do not reach browser UI.

## 9. Content artifacts

- **TRD-CONT-001** `content_items` is workflow parent.
- **TRD-CONT-002** `content_script_artifacts` stores current canonical/translation artifacts.
- **TRD-CONT-003** Unique `(content_item_id, language)` and partial unique one-source invariant are database-enforced.
- **TRD-CONT-004** Translation `source_revision` records canonical revision used.
- **TRD-CONT-005** Source regeneration and stale translation transitions are compare-and-set/idempotent where concurrent completions are possible.
- **TRD-CONT-006** Scene Planning handoff identifies a persisted artifact; authoritative script/revision is reloaded server-side.
- **TRD-CONT-007** `content_item_identity_provenance` stores exact organization Profile/Brand Kit revision for a generated content item; existing `content_item_knowledge_sources` stores exact Knowledge snapshots.
- **TRD-CONT-008** Identity and Knowledge provenance are persisted atomically; revision mismatch or changed Knowledge snapshot fails closed rather than recording mixed provenance.

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
- **TRD-SCENE-009** Workflow and granular replan actions resolve current Brand Kit server-side. Brand palette/typography/logo treatment act as institutional defaults when the Visual Bible does not explicitly override creative presentation.
- **TRD-SCENE-010** Official primary logo asset identity is carried separately as institutional authority and cannot be replaced/redrawn/substituted by Visual Bible project styling.

## 11. Durable jobs

- **TRD-JOB-001** Job states are `QUEUED`, `PROCESSING`, `COMPLETED`, `FAILED`, `RETRYING`, `CANCELLED`.
- **TRD-JOB-002** Claim uses row locking/`SKIP LOCKED` semantics and lease ownership.
- **TRD-JOB-003** Job records include organization, type, payload reference, attempt count, idempotency key, failure metadata and timestamps.
- **TRD-JOB-004** Retry policy distinguishes transient provider/network failures from terminal validation/auth errors.
- **TRD-JOB-005** Publish/render operations must be idempotent at the domain boundary.
- **TRD-JOB-006** Normal browser roles cannot directly claim worker jobs or create provider-attempt lineage for paid generation.
- **TRD-JOB-007** A privileged unattended dispatcher may lease due work in bounded batches and release leases after execution.

## 12. Media and video

The original TRD-VID IDs keep their original semantic meaning; later execution rules are appended as new IDs.

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
- **TRD-MEDIA-002** Generated video uses private organization-scoped storage and deterministic object paths.
- **TRD-MEDIA-003** Generated media lineage is linked through `generating_job_id` and generation attempt/job metadata; legacy `media_assets.scene_id` is not forced into a Scene Planning FK.
- **TRD-MEDIA-004** Media import finalization is idempotent by `(organization_id, storage_path)` and may complete only an `IMPORT_PENDING` attempt.
- **TRD-MEDIA-005** Media Library provides organization-scoped catalogue/detail/preview/upload/archive/delete boundaries and a private `media-library` bucket.
- **TRD-MEDIA-006** Brand Kit assets reuse same-org ACTIVE IMAGE `media_assets`; Knowledge FILE sources reuse same-org ACTIVE DOCUMENT `media_assets`.
- **TRD-MEDIA-007** Signed read/write URLs are short-lived transport. Brand Kit and Knowledge business records persist asset UUIDs/canonical safe URL lineage, not signed URLs or raw browser-supplied object paths.

## 14. Publishing integrations

- **TRD-PUB-001** Meta publishing uses server-side Integration Vault credentials.
- **TRD-PUB-002** OAuth/token refresh, where supported, occurs server-side.
- **TRD-PUB-003** Webhooks validate signatures before accepting provider events.
- **TRD-PUB-004** Publish attempts persist idempotency/reference/provider response metadata without raw credentials.
- **TRD-PUB-005** Channel adapters normalize provider-specific errors/statuses.

**Current maturity:** retained baseline requirements; implementation is governed by its own release slice.

## 15. API/server action rules

- **TRD-API-001** Validate all untrusted inputs with Zod or equivalent typed schema at server boundary.
- **TRD-API-002** Resolve actor and organization membership server-side.
- **TRD-API-003** Re-read authoritative database records instead of trusting browser-submitted business state.
- **TRD-API-004** Return serializable safe error objects; no raw exception propagation to client.
- **TRD-API-005** Mutations requiring privileged DB bypass first complete authorization using the user-scoped boundary, then use narrowly scoped privileged persistence.
- **TRD-API-006** Internal dispatcher operations accept no browser-controlled provider payload and revalidate job/attempt/tenant lineage before provider spend.
- **TRD-API-007** Organization-generation callers use the shared server-only resolver rather than independently rebuilding Profile/Brand/Core/selected Knowledge composition.
- **TRD-API-008** File/URL ingestion action success is not equivalent to approval; the server returns a DRAFT Knowledge record and the UI must preserve explicit activation as a separate action.

## 16. Database migration discipline

- **TRD-DB-001** Migrations are append-only after application to a shared database; corrections use new forward migrations.
- **TRD-DB-002** A fresh database applies repository migrations sequentially without manual reordering.
- **TRD-DB-003** DDL changes use Supabase migration tooling, not ad hoc production SQL, except transactional/read-only verification probes.
- **TRD-DB-004** Every new tenant table enables RLS before release.
- **TRD-DB-005** Security-sensitive triggers/functions explicitly set safe `search_path` and privilege grants.
- **TRD-DB-006** Production migration deployment is verified against live migration history before release claims; already-applied migrations are never blindly reapplied.
- **TRD-DB-007** New exposed tables explicitly revoke inherited broad Data API ACLs and grant only the operations required by the RLS-backed browser workflow.
- **TRD-DB-008** Live-discovered defects are fixed with new forward migrations and regression tests. Applied migrations are not rewritten to hide rollout history.

## 17. Error handling and observability

- **TRD-OBS-001** Domain errors use stable codes such as VALIDATION_ERROR, UNAUTHORIZED, FORBIDDEN, NOT_FOUND, CONFLICT, PROVIDER_ERROR, INTERNAL_ERROR.
- **TRD-OBS-002** Logs contain correlation IDs/job IDs/provider request IDs where available.
- **TRD-OBS-003** Secrets and sensitive credentials are redacted by construction, not after logging.
- **TRD-OBS-004** Runtime dashboards distinguish application, provider, database and job failures.
- **TRD-OBS-005** Provider-specific raw error bodies are not passed directly to browser UI.
- **TRD-OBS-006** Cross-tenant object rejection may intentionally return a non-disclosing “not found/unavailable” class instead of revealing existence in another organization.

## 18. Deployment environments

- **TRD-DEP-001** `main` deploys to staging first until production promotion is explicitly approved by environment governance.
- **TRD-DEP-002** Preview/staging use dedicated PAK Supabase project(s) only.
- **TRD-DEP-003** Aurexis/Lovable systems are prohibited deployment dependencies for PAK.
- **TRD-DEP-004** Required bootstrap environment variables include Supabase URL/anon key and server-only service-role key where legacy/server infrastructure requires it; organization provider keys live in Integration Vault. Browser feature flows in this identity/ingestion slice use authenticated RLS/RPC boundaries and do not introduce new client secrets.
- **TRD-DEP-005** Deployment must pass production build before promotion.
- **TRD-DEP-006** External hosting quota/rate-limit failures are recorded as infrastructure blockers and must not be misreported as application build/test failures.

## 19. Testing gates

- **TRD-TEST-001** Every feature/bugfix starts with a failing test when behavior is testable.
- **TRD-TEST-002** CI requires typecheck, lint, unit/integration, production build, worker/container gates where applicable and Playwright E2E.
- **TRD-TEST-003** RLS/security-sensitive changes require structural SQL assertions plus live Supabase probes before merge.
- **TRD-TEST-004** External AI/media provider CI paths use deterministic fakes; live provider smoke tests are manual/controlled and never required for every CI run.
- **TRD-TEST-005** Merge claims require evidence from the exact PR head.
- **TRD-TEST-006** A paid-provider feature may be infrastructure-release-ready without a paid smoke only when credentials/credits are unavailable and deferred operational acceptance is explicitly documented rather than falsely claimed.
- **TRD-TEST-007** Profile/Brand/Knowledge browser E2E uses a strict development-only double gate; normal E2E auth bypass alone cannot activate synthetic identity fixtures, and production mode cannot activate them.
- **TRD-TEST-008** Live authorization verification uses reversible/rollback-only synthetic fixtures and confirms zero residual fixture rows after proof.

## 20. Performance requirements

- **TRD-PERF-001** Database list APIs page results and use indexed organization/status/search filters.
- **TRD-PERF-002** Avoid loading full Knowledge record content into browser selectors when metadata is sufficient.
- **TRD-PERF-003** Expensive generation/render/publishing does not hold browser request connections for provider-scale durations when a durable job can represent progress.
- **TRD-PERF-004** Large context/media payloads have explicit size limits before provider invocation.
- **TRD-PERF-005** Unattended dispatch uses bounded batches and leases to prevent concurrent duplicate processing.
- **TRD-PERF-006** RLS policies that compare audit actor IDs should use initplan-safe `(select auth.uid())` form when semantically equivalent, avoiding per-row reevaluation at scale.

## 21. Security acceptance

A feature touching credentials, authorization, organization ownership, immutable history, authoritative organization identity, Knowledge ingestion, paid provider spend or external publishing cannot be release-ready until its database RLS/policy/table-ACL/function-privilege model and server/Edge boundary have both been reviewed and exercised with negative tests.

Organization identity/Knowledge acceptance additionally requires proof that EDITOR cannot mutate Profile/Brand/Core state, REVIEWER remains read-only, cross-org Brand/document IDs fail, ingestion stays DRAFT, signed URLs/raw object paths do not persist as Brand identity, and provenance writes are atomic and immutable.

Provider-spend workflows additionally require proof that a normal authenticated browser cannot directly create provider attempts, bypass approved source/QC state, retrieve secrets or invoke internal worker capability.