# PAK Marketing Automation — Master Technical Requirements Document (TRD)

**Document ID:** PAK-TRD-001  
**Version:** 1.0  
**Status:** Baseline for review

## 1. Architecture summary

PAK is a Next.js/TypeScript application deployed on a Next.js-compatible host, with Supabase providing PostgreSQL, Auth and database authorization. AI and media providers are accessed only from server-side modules through provider-neutral contracts. Security-critical tenancy and integrity rules are enforced in PostgreSQL/RLS, not only in application code.

## 2. Technology baseline

- **TRD-TECH-001** Next.js App Router + TypeScript.
- **TRD-TECH-002** React 19-compatible client/server component model.
- **TRD-TECH-003** Supabase Auth + PostgreSQL + RLS.
- **TRD-TECH-004** Zod for server-boundary validation.
- **TRD-TECH-005** Vitest + Testing Library for unit/component tests.
- **TRD-TECH-006** Playwright for browser E2E.
- **TRD-TECH-007** GitHub Actions for required CI gates.
- **TRD-TECH-008** Vercel or equivalent Next.js-compatible deployment platform for staging/production.

## 3. Application boundaries

- **TRD-ARC-001** UI routes live under `src/app` and do not directly embed provider secrets.
- **TRD-ARC-002** Domain modules live under `src/modules/<domain>` and expose typed interfaces.
- **TRD-ARC-003** Supabase client construction is split into browser/session/server/admin boundaries.
- **TRD-ARC-004** `server-only` must guard modules that can access service-role or provider secrets.
- **TRD-ARC-005** External provider SDKs are wrapped behind internal provider-neutral interfaces.
- **TRD-ARC-006** Long-running work must be represented by durable database jobs rather than relying on one HTTP request lifetime.

## 4. Authentication and authorization

- **TRD-AUTH-001** Supabase Auth is identity source.
- **TRD-AUTH-002** Organization memberships map users to `OWNER | ADMIN | EDITOR | REVIEWER | ANALYST`.
- **TRD-AUTH-003** Browser/server requests using user sessions are constrained by RLS.
- **TRD-AUTH-004** Application permission checks improve UX but do not replace database authorization.
- **TRD-AUTH-005** Security-definer functions are explicitly revoked from `public`/`anon` unless required by authenticated RLS.
- **TRD-AUTH-006** Worker/admin capabilities cannot be invoked by normal browser roles.

## 5. Multi-tenancy

- **TRD-TEN-001** Every tenant-owned root table contains `organization_id`.
- **TRD-TEN-002** Child resources that omit direct organization ownership must be reachable only through organization-scoped parents with integrity enforcement.
- **TRD-TEN-003** Cross-organization reads and mutations are denied by RLS and validated in live probes for security-sensitive features.
- **TRD-TEN-004** Organization ownership columns on immutable-history/knowledge entities cannot be moved between organizations after creation.

## 6. Integration Vault architecture

- **TRD-SEC-001** Provider credentials are persisted only through server-side authenticated actions or RPCs.
- **TRD-SEC-002** Raw secret values are encrypted before durable storage using a server-held encryption root secret or Supabase-supported vault primitive.
- **TRD-SEC-003** Browser roles have no SQL policy allowing raw encrypted/plain secret retrieval.
- **TRD-SEC-004** Read APIs return metadata only: provider, configuration status, masked identifier, timestamps, actor and health state.
- **TRD-SEC-005** Secret replacement writes a new ciphertext/version and invalidates cached provider clients.
- **TRD-SEC-006** Secret deletion removes or cryptographically renders the value unusable and records audit metadata.
- **TRD-SEC-007** Provider secrets must not be logged, serialized to client components, placed in URLs, analytics, error payloads or browser storage.
- **TRD-SEC-008** OpenAI integration resolution order for organization-scoped generation is: configured Integration Vault credential; deployment bootstrap key only if explicitly enabled for that environment.
- **TRD-SEC-009** Service-role credentials remain deployment/bootstrap secrets and are never user-configurable through the Integration Vault.

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

## 10. Durable jobs

- **TRD-JOB-001** Job states are `QUEUED`, `PROCESSING`, `COMPLETED`, `FAILED`, `RETRYING`, `CANCELLED`.
- **TRD-JOB-002** Claim uses row locking/`SKIP LOCKED` semantics and lease ownership.
- **TRD-JOB-003** Job records include organization, type, payload reference, attempt count, idempotency key, failure metadata and timestamps.
- **TRD-JOB-004** Retry policy distinguishes transient provider/network failures from terminal validation/auth errors.
- **TRD-JOB-005** Publish/render operations must be idempotent at the domain boundary.

## 11. Media and video

- **TRD-VID-001** `media_assets` is provider-agnostic and organization-scoped.
- **TRD-VID-002** `video_scenes` links content planning to generated media.
- **TRD-VID-003** Media migration dependencies must apply cleanly from an empty database in filename order.
- **TRD-VID-004** Provider adapters expose submit/status/result/error contracts independent of LTX-specific payload structure.
- **TRD-VID-005** Final assembly is a separate job from per-scene generation.
- **TRD-VID-006** Final render readiness is false if there are zero required scenes or any required scene is incomplete/failed.

## 12. Publishing integrations

- **TRD-PUB-001** Meta publishing uses server-side Integration Vault credentials.
- **TRD-PUB-002** OAuth/token refresh, where supported, occurs server-side.
- **TRD-PUB-003** Webhooks validate signatures before accepting provider events.
- **TRD-PUB-004** Publish attempts persist idempotency/reference/provider response metadata without raw credentials.
- **TRD-PUB-005** Channel adapters normalize provider-specific errors/statuses.

## 13. API/server action rules

- **TRD-API-001** Validate all untrusted inputs with Zod or equivalent typed schema at server boundary.
- **TRD-API-002** Resolve actor and organization membership server-side.
- **TRD-API-003** Re-read authoritative database records instead of trusting browser-submitted business state.
- **TRD-API-004** Return serializable safe error objects; no raw exception propagation to client.
- **TRD-API-005** Mutations requiring privileged DB bypass must first complete authorization using the user-scoped client, then use narrowly scoped admin persistence.

## 14. Database migration discipline

- **TRD-DB-001** Migrations are append-only after application to a shared database; corrections use new forward migrations.
- **TRD-DB-002** A fresh database must apply repository migrations sequentially without manual reordering.
- **TRD-DB-003** DDL changes use Supabase migration tooling, not ad hoc production SQL, except transactional verification probes.
- **TRD-DB-004** Every new tenant table enables RLS before release.
- **TRD-DB-005** Security-sensitive triggers/functions explicitly set safe `search_path` and privilege grants.

## 15. Error handling and observability

- **TRD-OBS-001** Domain errors use stable codes such as VALIDATION_ERROR, UNAUTHORIZED, FORBIDDEN, NOT_FOUND, CONFLICT, PROVIDER_ERROR, INTERNAL_ERROR.
- **TRD-OBS-002** Logs contain correlation IDs/job IDs/provider request IDs where available.
- **TRD-OBS-003** Secrets and sensitive credentials are redacted by construction, not after logging.
- **TRD-OBS-004** Runtime dashboards distinguish application, provider, database and job failures.

## 16. Deployment environments

- **TRD-DEP-001** `main` deploys to staging first until production promotion is explicitly approved.
- **TRD-DEP-002** Preview/staging use the dedicated PAK Supabase project only.
- **TRD-DEP-003** Aurexis/Lovable systems are prohibited deployment dependencies for PAK.
- **TRD-DEP-004** Required bootstrap environment variables include Supabase URL/anon key and server-only service-role key; provider keys should transition to Integration Vault.
- **TRD-DEP-005** Deployment must pass production build before promotion.

## 17. Testing gates

- **TRD-TEST-001** Every feature/bugfix starts with failing test when behavior is testable.
- **TRD-TEST-002** CI requires typecheck, lint, unit/integration, production build and applicable Playwright E2E.
- **TRD-TEST-003** RLS/security-sensitive changes require structural SQL assertions plus live Supabase probes before merge.
- **TRD-TEST-004** External AI/media provider CI paths use deterministic fakes; live provider smoke tests are manual/controlled and never required for every CI run.
- **TRD-TEST-005** Merge claims require evidence from the exact PR head.

## 18. Performance requirements

- **TRD-PERF-001** Database list APIs must page results and use indexed organization/status/search filters.
- **TRD-PERF-002** Avoid loading full Knowledge record content into browser selectors when metadata is sufficient.
- **TRD-PERF-003** Expensive generation/render/publishing must not hold browser request connections for provider-scale durations if a durable job can represent progress.
- **TRD-PERF-004** Large context/media payloads have explicit size limits before provider invocation.

## 19. Security acceptance

A feature touching credentials, authorization, organization ownership, immutable history or external publishing cannot be considered release-ready until its database policy/privilege model and server boundary have both been reviewed and exercised with negative tests.