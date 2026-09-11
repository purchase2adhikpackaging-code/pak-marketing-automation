# Phase 7 — Video Generation Provider Design

## Status
Approved implementation direction under the frozen PAK PRD/TRD and delegated CTO authority. Phase 7 follows Phase 6’s provider-neutral handoff contract and must not weaken tenant, RBAC, secret, job, or media boundaries.

## Goal
Generate real per-shot video from an APPROVED, current Phase 6 Scene Plan through a provider-neutral durable-job pipeline, using LTX as the first production adapter, while keeping provider credentials server-side, persisting provider execution identity, importing completed output into PAK-controlled organization storage, and mapping failures into bounded retry semantics.

## Governing requirements

### Product
- PRD-VID-004 — provider-neutral video integration; LTX is an adapter, not a domain dependency.
- PRD-VID-005 — final rendering/assembly may depend only on successful required generation and QA/readiness.
- PRD-VID-006 — provider failures use durable retryable jobs and explicit terminal failure.
- PRD-VID-007 — generated media is organization-scoped and traceable to generation lineage.

### Integration
- INT-VID-001 — domain code cannot depend on LTX-specific status strings.
- INT-VID-002 — video generation is durable-job based.
- INT-VID-003 — provider job IDs are persisted.
- INT-VID-004 — generated media is imported into organization-scoped media storage.
- INT-VID-005 — rate limits/transient errors use bounded retry.

### Phase 6 boundary
- Only `APPROVED` scene-plan versions may cross the handoff boundary.
- Canonical narration remains authoritative; the video provider may not rewrite approved words.
- Scene = narrative unit; shot = provider generation unit.
- Approved plans remain immutable.

## Current LTX contract snapshot — verified 2026-09-11
Official source: https://docs.ltx.io

- Production integration uses asynchronous V2 jobs.
- Submit text-to-video: `POST https://api.ltx.io/v2/text-to-video`.
- Authentication: `Authorization: Bearer <API_KEY>`.
- Submit returns a provider job `id`; status polling is `GET /v2/text-to-video/{id}`.
- Provider statuses are `pending`, `processing`, `completed`, `failed`; these are adapter-only values and must be normalized before reaching domain code.
- Completed output is exposed as `result.video_url`.
- Terminal job status and output URLs are retained for only 24 hours; successful output must therefore be imported immediately into PAK-controlled storage.
- Recommended polling interval is approximately five seconds.
- Retryable provider failures include async queue/rate-limit errors, server errors, service unavailable, overload, and transport failures. 429 `Retry-After` must be honored when present; otherwise bounded exponential backoff with jitter applies.
- Current production model family is LTX-2.3. Legacy `ltx-2-fast` / `ltx-2-pro` are removed and must never be emitted.
- `ltx-2-3-pro` supports 1080p/1440p/4K at 24/25/48/50 FPS for 6, 8, or 10 seconds.
- `ltx-2-3-fast` supports longer 1080p/24/25 FPS generations up to 20 seconds, but Phase 7 defaults final generation to Pro.
- Text-to-video generative aspect ratios are 16:9 and 9:16. Provider-specific geometry restrictions remain adapter concerns.

## Architectural choice

### Chosen approach: authenticated Supabase Edge execution + durable Postgres jobs

Provider calls execute in a new authenticated Supabase Edge Function, not in the browser and not in the Next.js/Vercel runtime. This matches the current Integration Vault production boundary used by `generate-content`: the Edge Function authenticates the user, checks organization membership/role, reads the organization’s LTX secret through the vault’s privileged database path, and performs provider I/O without exposing the secret.

The durable `jobs` table remains the generic job authority. Phase 7 adds a provider-execution lineage table instead of overloading generic job JSON with provider-specific lifecycle state. Provider-specific raw payloads are minimized and kept server-side; domain-facing state remains normalized.

### Alternatives rejected

1. **Call LTX directly from Next.js server actions.** Rejected because the production vault explicitly routes provider execution through authenticated Supabase Edge Functions and Vercel must not become a second secret-execution boundary.
2. **Store provider state only inside `jobs.result_payload`.** Rejected because provider job IDs, polling state, requested/effective generation parameters, and imported asset lineage need queryable, constrained records for recovery and audit.
3. **Generate an entire narrative scene in one LTX request.** Rejected because Phase 6 established shot as the generation unit; scene-level generation would collapse shot-level continuity, retries, replacement, and media lineage.

## Domain model

### `video_generation_attempts`
One row represents one provider submission attempt for one immutable approved shot snapshot.

Fields:
- `id uuid primary key`
- `organization_id uuid not null`
- `job_id uuid not null references jobs(id)`
- `scene_plan_version_id uuid not null references scene_plan_versions(id)`
- `scene_id uuid not null references scene_plan_scenes(id)`
- `shot_id uuid not null references scene_plan_shots(id)`
- `provider text not null` — normalized provider identifier (`LTX` initially)
- `provider_job_id text` — nullable until successful provider submission
- `provider_endpoint text not null` — internal enum-like value such as `TEXT_TO_VIDEO`, not a URL
- `state text not null` — normalized attempt state: `QUEUED | SUBMITTED | PROCESSING | COMPLETED | FAILED | CANCELLED`
- `requested_duration_seconds numeric`
- `effective_duration_seconds integer`
- `requested_aspect_ratio text`
- `effective_resolution text`
- `provider_model text`
- `provider_progress numeric nullable`
- `retryable boolean not null default false`
- `provider_error_code text nullable`
- `provider_error_message text nullable`
- `provider_submitted_at timestamptz nullable`
- `provider_completed_at timestamptz nullable`
- `media_asset_id uuid nullable references media_assets(id)`
- timestamps

Constraints:
- organization must match job, plan, scene, shot, and media lineage.
- `provider_job_id` must be unique per provider when non-null.
- COMPLETED requires `media_asset_id`.
- provider response URL must never be the durable media identity.
- no API key, Authorization header, or decrypted secret may be persisted.

### Generic `jobs`
Use job type `VIDEO_SHOT_GENERATION` and resource type `SCENE_PLAN_SHOT`.

`input_payload` contains only immutable provider-neutral execution input:
- plan version ID
- scene ID
- shot ID
- source integrity hash
- master visual prompt
- requested duration
- requested aspect ratio
- camera-motion intent
- continuity snapshot
- `generateAudio` flag

It must not contain secrets or mutable live Scene Planning fields that can drift after enqueue.

`result_payload` contains normalized completion metadata only:
- attempt ID
- media asset ID
- effective duration/resolution/model

`failure_metadata` contains normalized code/message/retryability; raw provider response bodies are not persisted by default.

## Provider-neutral adapter contract
The existing `VideoProvider` interface remains the public domain boundary. Phase 7 may extend request/result types only with provider-neutral fields required by all adapters.

Adapter responsibilities:
- load no credentials itself; credential is injected by the Edge execution composition root.
- map domain request -> provider request.
- map provider response/status/error -> normalized domain types.
- validate provider capability at adapter boundary.
- never leak provider-specific status strings beyond the adapter.

### LTX adapter mapping

Default final-render profile:
- model: `ltx-2-3-pro`
- resolution: `1920x1080` for 16:9, `1080x1920` for 9:16
- fps: `24`
- `generate_audio`: false by default because canonical narration is authoritative and provider-generated speech must not replace it.

Prompt mapping:
- use the Phase 6 shot `masterVisualPrompt` as the primary prompt.
- append concise continuity/camera constraints only from the approved immutable handoff snapshot.
- never ask LTX to synthesize narration/dialogue text.

Duration normalization for Pro:
- allowed provider durations: `6 | 8 | 10` seconds.
- choose the nearest supported duration to the approved shot duration; exact half-step ties round upward.
- reject a shot if requested duration is below 4 seconds or above 12 seconds rather than silently creating a materially different shot.
- persist requested and effective durations separately.
- Phase 8 assembly may trim/pad the generated asset against exact editorial timing; Phase 7 does not rewrite the approved scene plan.

Aspect ratio:
- 16:9 -> 1920x1080.
- 9:16 -> 1080x1920.
- 1:1 and 4:5 are valid Phase 6 domain ratios but unsupported by LTX text-to-video generation. The LTX adapter returns a non-retryable `UNSUPPORTED_ASPECT_RATIO` preflight failure. Reframe support is intentionally deferred unless Phase 8 requires it.

## Execution workflow

### A. Enqueue generation
1. User selects an APPROVED current plan/shot.
2. Server action authenticates user and verifies OWNER/ADMIN/EDITOR role.
3. Server loads approved plan + shot through organization-scoped queries.
4. Server builds Phase 6 immutable handoff package and verifies no blocker/source-stale condition.
5. Server derives an idempotency key from organization + plan version + shot ID + generation profile.
6. Insert/reuse `jobs` row in `QUEUED` state.
7. Insert/reuse `video_generation_attempts` row in `QUEUED` state.
8. Invoke authenticated Edge Function operation `process` for that job.

### B. Submit provider job
1. Edge Function validates JWT and membership.
2. Edge Function validates job/attempt tenant ownership and current job state.
3. Resolve LTX connection status and read `LTX/API_KEY` through the Integration Vault server-side secret function.
4. Normalize/validate duration, aspect ratio, model, resolution, and prompt.
5. POST LTX async V2 request.
6. Persist `provider_job_id`, `SUBMITTED`, effective parameters, and timestamps transactionally.
7. Persist generic job state as `PROCESSING`.

### C. Reconcile provider job
Reconciliation is idempotent and may be invoked repeatedly.

1. Claim or lock the target attempt to prevent concurrent reconciliation.
2. GET LTX job status.
3. Map `pending`/`processing` -> normalized PROCESSING.
4. Map `failed` -> normalized failure and retryability.
5. On retryable failure and remaining generic-job attempts, schedule bounded retry state.
6. On terminal non-retryable failure or exhausted attempts, mark job and attempt FAILED.
7. On `completed`, immediately download `result.video_url` before its 24-hour expiry.
8. Validate HTTP success, MIME type `video/*`, bounded content size, and non-empty payload.
9. Upload bytes to organization-scoped Supabase Storage under a deterministic generated-media path.
10. Insert `media_assets` with `source='GENERATED'`, `asset_type='VIDEO'`, job/shot lineage, MIME type, duration and checksum where available.
11. Link `video_generation_attempts.media_asset_id`.
12. Mark attempt and generic job COMPLETED atomically.

## Durable retry policy

Generic job policy for `VIDEO_SHOT_GENERATION`:
- max attempts: 4.
- retryable: transport failure, HTTP 429 rate/concurrency limit, HTTP 500/503/529, provider failed payload classified retryable.
- non-retryable: 400 invalid request, 401 authentication failure, 402 insufficient funds, 404 expired/not found provider job, 422 content filtered, capability/preflight validation.
- exponential base delays: 5s, 15s, 45s plus jitter, unless provider `Retry-After` is longer.
- retry creates a new provider attempt row after a failed submission/generation attempt; it must not overwrite the old provider job lineage.

A poll that merely observes `pending` or `processing` does not consume a retry attempt.

## Worker/orchestration model
Phase 7 does not introduce a permanently running server. The Edge Function supports explicit idempotent operations:
- `submit` — submit a queued attempt.
- `reconcile` — poll/import one submitted attempt.

The Next.js server action may call these operations for immediate UX progress, while the durable database state remains recoverable. A scheduled/background reconciler can be added using existing platform scheduling only when required for unattended completion; provider correctness must not depend on an open browser session.

Before Phase 7 release, unattended reconciliation must have a production trigger. Preferred implementation is a scheduled Supabase invocation/cron-safe dispatcher that claims due PROCESSING video jobs and calls the same reconciliation core. No browser polling loop is an execution authority.

## Storage and media lineage

Generated provider URLs are ephemeral transport inputs only.

Storage path shape:
`{organizationId}/generated-video/{planVersionId}-{shotId}-{attemptId}.mp4`

Storage object and `media_assets` row must be created under the same organization. Access remains governed through existing organization membership and storage policy conventions.

The first production slice imports MP4/video output only. Thumbnail extraction and final scene/final-video assembly belong to Phase 8.

## Secret handling
- LTX key is stored as Integration Vault provider `LTX`, secret name `API_KEY`.
- No LTX secret in `NEXT_PUBLIC_*`, Next.js server environment, job payloads, provider-attempt rows, logs, error messages, browser state, or analytics.
- Edge Function uses the existing privileged vault read function after authenticating user/worker context and verifying tenant ownership.
- Connection state `NOT_CONFIGURED`, `DISABLED`, or `INVALID` blocks submission before provider spend.

## RBAC and tenant isolation

OWNER/ADMIN/EDITOR:
- enqueue generation
- retry failed generation
- cancel where provider/API permits
- view jobs and media

REVIEWER/ANALYST:
- read status/media where normal organization membership permits
- cannot enqueue/retry/cancel or mutate provider attempts

Database policies must always scope by `organization_id`; parent-org integrity triggers prevent cross-tenant job/plan/shot/media linkage.

## Idempotency and concurrency
- Enqueue uses unique organization-scoped idempotency key.
- Provider submission is protected against duplicate concurrent submission by row locking/state transition.
- Reconciliation is safe to run repeatedly.
- Media import uses deterministic storage path and a uniqueness check so a repeated completed poll cannot create duplicate media assets.
- Provider job ID is unique per provider.

## Failure and recovery scenarios
- **Edge invocation interrupted after LTX accepts job but before DB save:** the submission operation records a client-generated idempotency marker in local job state; because LTX submit API does not document an idempotency header, the implementation must minimize this ambiguity with transaction/state locking and explicit `SUBMITTING` state or equivalent. Automatic blind resubmission after an unknown outcome is prohibited; mark `SUBMISSION_UNKNOWN` for operator-safe reconciliation/retry.
- **LTX output URL expires before import:** attempt fails non-retryably with `PROVIDER_RESULT_EXPIRED`; user may start a new generation attempt.
- **Storage upload fails after successful provider completion:** keep provider attempt PROCESSING/IMPORT_PENDING and retry import while provider URL remains valid; do not resubmit the expensive provider generation.
- **DB write fails after storage upload:** deterministic storage path makes retry safe; upsert/link media row without duplicate provider generation.
- **Source/plan becomes stale after enqueue:** approved snapshot is immutable, but generation should stop before provider submission if plan is no longer eligible/current. Once provider spend has started, preserve lineage and finish/import; do not silently relink to a newer plan.

## Observability
Persist safe operational metadata:
- job/attempt IDs
- organization ID
- provider name/model
- normalized state
- provider job ID
- timings
- retry count/reason
- effective generation parameters
- media asset ID

Never log bearer tokens, vault secret values, full Authorization headers, or provider output signed/query URLs.

## UI scope
Phase 7 adds generation controls/status to the approved Scene Planning view without redesigning the workspace.

For an APPROVED current plan:
- `Generate video` per shot.
- status badge: Queued / Generating / Importing / Completed / Failed.
- completed asset preview/link using PAK storage.
- failed item exposes safe error category and retry action when allowed.

For non-approved/stale plans, no generation action appears.

## Testing strategy

### Unit
- LTX request mapping and capability validation.
- duration normalization.
- provider status normalization.
- retry classification/backoff.
- no secret/raw-provider leakage in persisted payloads.
- approved/current plan gate.
- idempotent enqueue/reconcile/import behavior.

### SQL/RLS
- tenant-scoped provider attempts.
- cross-tenant parent linkage rejected.
- reviewer/analyst mutation rejected.
- COMPLETED requires media asset.
- provider job uniqueness.
- no provider secret columns.

### Edge
- JWT required.
- membership/role enforced.
- vault credential resolved only server-side.
- LTX 401/402/422 are terminal; 429/500/503/529 retryable.
- malformed provider payload rejected safely.

### E2E
- approved shot shows generation action.
- non-approved plan does not.
- fake-provider job progresses to completed media.
- retryable fake failure transitions through retry and succeeds.
- terminal failure surfaces without duplicate media.

### Live staging
- configure LTX key through Integration Vault.
- submit one low-cost approved shot.
- verify persisted provider job ID and normalized state.
- verify completed provider URL is imported into PAK storage before expiry.
- verify Media Asset lineage and no secret exposure.

## Release gates
Phase 7 may merge only when:
1. typecheck, lint, unit, production build, and Playwright are green on exact head;
2. all Phase 7 migrations are applied successfully to PAK Supabase staging/current environment and RLS/security advisors reviewed;
3. Edge Function deploys with JWT verification enabled;
4. fake-provider end-to-end retry/import path passes;
5. one real LTX staging shot passes when an LTX API key/credits are configured;
6. no provider secret appears in client bundle, job payload, DB rows, logs, or errors;
7. current Vercel deployment blocker is treated independently from provider correctness—GitHub/Vercel Hobby build-rate exhaustion must not drive architectural compromises.
