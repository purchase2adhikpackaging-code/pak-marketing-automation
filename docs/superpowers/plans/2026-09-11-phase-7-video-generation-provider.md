# Phase 7 Video Generation Provider Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate real, durable, provider-neutral video assets from APPROVED Phase 6 shots using LTX as the first production adapter, with tenant-safe job lineage, bounded retries, secure vault credential use, and immediate import into PAK-controlled media storage.

**Architecture:** Keep the existing `VideoProvider` contract as the domain boundary. Add `video_generation_attempts` for queryable provider execution lineage, use generic `jobs` as durable scheduling authority, execute provider calls inside an authenticated Supabase Edge Function, and import terminal provider output immediately into organization-scoped storage/media rows. Next.js only authorizes/enqueues and displays normalized job/media state; it never receives LTX credentials.

**Tech Stack:** Next.js 16 / TypeScript, Vitest, Playwright, Supabase Postgres/RLS/Storage/Edge Functions, existing Integration Vault, LTX async V2 API.

**Spec:** `docs/superpowers/specs/2026-09-11-phase-7-video-generation-provider-design.md`

## Global Constraints

- Provider domain state must remain independent of LTX-specific status strings.
- LTX model IDs must use current LTX-2.3 identifiers only: `ltx-2-3-pro` and optionally `ltx-2-3-fast`; legacy `ltx-2-*` IDs are forbidden.
- Default final-generation profile is `ltx-2-3-pro`, 24 FPS, 1080p, provider audio disabled.
- LTX text-to-video generation supports only 16:9 and 9:16; 1:1 and 4:5 fail preflight non-retryably.
- Provider output URL is ephemeral and must never be the durable media identity.
- No LTX secret may enter Next.js runtime, browser state, `jobs`, `video_generation_attempts`, logs, or analytics.
- Only APPROVED, current Phase 6 plan shots may enqueue provider generation.
- Every database mutation remains organization-scoped and protected by RLS/parent-org integrity.
- Retry policy is bounded to four expensive generation attempts; ordinary status polling does not increment generation attempts.
- Completed output must be imported to PAK storage before marking the durable job COMPLETED.
- No Lovable use.

---

### Task 1: Provider-Neutral Generation Contract Hardening

**Files:**
- Modify: `src/modules/video/providers/types.ts`
- Modify: `src/modules/video/providers/provider.ts`
- Modify: `src/modules/video/providers/fake-provider.ts`
- Modify: `src/modules/video/providers/fake-provider.test.ts`
- Create: `src/modules/video/providers/capabilities.test.ts`

**Interfaces:**
- Consumes: existing `VideoProvider` abstraction.
- Produces: provider-neutral request/result/error types supporting shot IDs, optional camera intent, audio policy, and normalized capability failures without LTX-specific statuses.

- [ ] **Step 1: Write failing contract tests**

Add tests asserting:
```ts
const request: VideoGenerationRequest = {
  organizationId: "11111111-1111-4111-8111-111111111111",
  sceneId: "22222222-2222-4222-8222-222222222222",
  shotId: "33333333-3333-4333-8333-333333333333",
  prompt: "Approved master visual prompt",
  durationSeconds: 7,
  aspectRatio: "16:9",
  continuity: {},
  cameraMotion: "slow push",
  generateAudio: false,
  idempotencyKey: "plan:shot:profile",
};
expect(request.generateAudio).toBe(false);
expect(request.shotId).toMatch(/[0-9a-f-]+/i);
```
Also assert fake provider returns normalized `QUEUED/PROCESSING/COMPLETED/FAILED/CANCELLED` only.

- [ ] **Step 2: Run focused tests and verify RED**

Run:
```bash
npm run test:run -- src/modules/video/providers/fake-provider.test.ts src/modules/video/providers/capabilities.test.ts
```
Expected: FAIL because `shotId`, `cameraMotion`, and `generateAudio` are not yet in the request type/behavior.

- [ ] **Step 3: Implement minimal provider-neutral extensions**

Extend `VideoGenerationRequest` with:
```ts
shotId: string;
cameraMotion?: string;
generateAudio: boolean;
```
Do not add LTX model IDs, LTX statuses, endpoint URLs, or LTX response shapes to the domain type.

- [ ] **Step 4: Run focused tests and typecheck**

Run:
```bash
npm run test:run -- src/modules/video/providers/fake-provider.test.ts src/modules/video/providers/capabilities.test.ts
npm run typecheck
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/video/providers
git commit -m "feat(video): harden provider-neutral generation contract"
```

### Task 2: LTX Adapter With Current V2 Contract

**Files:**
- Create: `src/modules/video/providers/ltx/types.ts`
- Create: `src/modules/video/providers/ltx/capabilities.ts`
- Create: `src/modules/video/providers/ltx/adapter.ts`
- Create: `src/modules/video/providers/ltx/adapter.test.ts`
- Create: `src/modules/video/providers/ltx/error-mapping.ts`
- Create: `src/modules/video/providers/ltx/error-mapping.test.ts`

**Interfaces:**
- Consumes: `VideoProvider`, `VideoGenerationRequest`, injected API key/fetch implementation.
- Produces: `LtxVideoProvider` implementing submit/status/result normalization without exposing LTX-specific states outside the adapter.

- [ ] **Step 1: Write failing duration/aspect/model mapping tests**

Cover:
```ts
expect(normalizeLtxDuration(5)).toBe(6);
expect(normalizeLtxDuration(7)).toBe(8);
expect(normalizeLtxDuration(9)).toBe(10);
expect(() => normalizeLtxDuration(3)).toThrow(/duration/i);
expect(() => normalizeLtxDuration(13)).toThrow(/duration/i);
expect(resolveLtxResolution("16:9")).toBe("1920x1080");
expect(resolveLtxResolution("9:16")).toBe("1080x1920");
expect(() => resolveLtxResolution("1:1")).toThrow(/UNSUPPORTED_ASPECT_RATIO/);
```

- [ ] **Step 2: Verify RED**

Run:
```bash
npm run test:run -- src/modules/video/providers/ltx/adapter.test.ts
```
Expected: FAIL because adapter modules do not exist.

- [ ] **Step 3: Implement LTX request mapping**

Submit body must be equivalent to:
```ts
{
  prompt: request.prompt,
  model: "ltx-2-3-pro",
  duration: effectiveDuration,
  resolution: effectiveResolution,
  fps: 24,
  generate_audio: false,
  ...(mappedCameraMotion ? { camera_motion: mappedCameraMotion } : {}),
}
```
Use endpoint `https://api.ltx.io/v2/text-to-video` only inside adapter composition. Authorization is bearer API key injected at construction.

- [ ] **Step 4: Write RED status/error tests**

Assert:
- `pending` -> `QUEUED`
- `processing` -> `PROCESSING`
- `completed` -> `COMPLETED`
- `failed` -> `FAILED`
- HTTP 429 `rate_limit_error` -> retryable true
- 500/503/529 -> retryable true
- 400/401/402/404/422 -> retryable false
- legacy model IDs never appear in adapter source.

- [ ] **Step 5: Implement status/result/error normalization**

Implement exact normalized error codes such as:
```ts
LTX_INVALID_REQUEST
LTX_AUTHENTICATION
LTX_INSUFFICIENT_FUNDS
LTX_NOT_FOUND
LTX_CONTENT_FILTERED
LTX_RATE_LIMITED
LTX_API_ERROR
LTX_SERVICE_UNAVAILABLE
LTX_OVERLOADED
LTX_RESPONSE_INVALID
```
Provider raw payload may be returned from adapter for immediate diagnostic handling but is not persisted by orchestration.

- [ ] **Step 6: Run focused tests + typecheck**

```bash
npm run test:run -- src/modules/video/providers/ltx
npm run typecheck
```
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/modules/video/providers/ltx
 git commit -m "feat(video): add LTX 2.3 async provider adapter"
```

### Task 3: Provider Execution Lineage Schema + RLS

**Files:**
- Create: `supabase/migrations/202609110008_video_generation_attempts.sql`
- Create: `src/modules/video/generation/schema-sql.test.ts`
- Create: `src/modules/video/generation/types.ts`

**Interfaces:**
- Consumes: `jobs`, `scene_plan_versions`, `scene_plan_scenes`, `scene_plan_shots`, `media_assets`, organization membership helpers.
- Produces: `video_generation_attempts` and tenant/RBAC constraints.

- [ ] **Step 1: Write failing SQL contract tests**

Assert migration contains:
```sql
create table if not exists public.video_generation_attempts
```
and constraints for organization/job/plan/scene/shot/provider job/media lineage, RLS enabled, authenticated member SELECT, editor mutation policy or invoker RPC-only mutation, and no secret/token/API-key columns.

- [ ] **Step 2: Verify RED**

```bash
npm run test:run -- src/modules/video/generation/schema-sql.test.ts
```
Expected: FAIL because migration does not exist.

- [ ] **Step 3: Implement migration**

Use normalized state check:
```sql
check (state in ('QUEUED','SUBMITTING','SUBMITTED','PROCESSING','IMPORT_PENDING','COMPLETED','FAILED','CANCELLED','SUBMISSION_UNKNOWN'))
```
Create unique partial index:
```sql
create unique index ... on public.video_generation_attempts(provider, provider_job_id)
where provider_job_id is not null;
```
Create indexes for every FK and org/state polling path.

Add parent-org trigger verifying every linked parent belongs to `new.organization_id` and that scene/shot belong to the stated plan lineage.

- [ ] **Step 4: Add TypeScript normalized attempt type**

`VideoGenerationAttempt` mirrors only safe normalized columns; it must not contain API key or signed output URL.

- [ ] **Step 5: Run SQL tests + typecheck**

```bash
npm run test:run -- src/modules/video/generation/schema-sql.test.ts
npm run typecheck
```
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/202609110008_video_generation_attempts.sql src/modules/video/generation
git commit -m "feat(video): add generation attempt lineage schema"
```

### Task 4: Atomic Enqueue and Attempt Repository

**Files:**
- Create: `supabase/migrations/202609110009_video_generation_enqueue.sql`
- Create: `src/modules/video/generation/repository.ts`
- Create: `src/modules/video/generation/repository.test.ts`
- Create: `src/modules/video/generation/enqueue.ts`
- Create: `src/modules/video/generation/enqueue.test.ts`

**Interfaces:**
- Consumes: approved Phase 6 shot snapshot, generic jobs table.
- Produces: idempotent `enqueueVideoShotGeneration()` returning `{ jobId, attemptId, reused }`.

- [ ] **Step 1: Write RED enqueue tests**

Test:
- rejects non-APPROVED plan.
- rejects stale source.
- rejects blocker findings.
- creates job type `VIDEO_SHOT_GENERATION`, resource type `SCENE_PLAN_SHOT`.
- same org/plan/shot/profile returns same queued job via idempotency key.
- job input is immutable snapshot and contains no credentials.

- [ ] **Step 2: Verify RED**

```bash
npm run test:run -- src/modules/video/generation/enqueue.test.ts src/modules/video/generation/repository.test.ts
```
Expected: FAIL.

- [ ] **Step 3: Implement atomic enqueue RPC**

Create invoker function `enqueue_video_shot_generation(...)` that:
- requires `auth.uid()` and OWNER/ADMIN/EDITOR role.
- verifies plan status APPROVED and current source integrity.
- verifies shot belongs to plan/organization.
- upserts/reuses by organization-scoped job idempotency key.
- creates attempt only when a new job is created.

- [ ] **Step 4: Implement repository/service wrapper**

Use authenticated `createServerSupabaseClient()` only; no admin client/service-role key.

- [ ] **Step 5: Run focused tests + typecheck**

```bash
npm run test:run -- src/modules/video/generation/enqueue.test.ts src/modules/video/generation/repository.test.ts
npm run typecheck
```
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/202609110009_video_generation_enqueue.sql src/modules/video/generation
git commit -m "feat(video): add idempotent approved-shot enqueue"
```

### Task 5: Secure LTX Edge Function

**Files:**
- Create: `supabase/functions/video-generation/index.ts`
- Create: `src/modules/video/generation/edge-source-security.test.ts`
- Modify: `src/modules/integrations/edge-client.ts`
- Modify: `src/modules/integrations/edge-client.test.ts`

**Interfaces:**
- Consumes: authenticated access token, organization/job/attempt IDs, Integration Vault `LTX/API_KEY`.
- Produces: safe normalized submit/reconcile responses with no secrets/provider URLs returned to browser-facing code.

- [ ] **Step 1: Write RED source-security tests**

Assert Edge Function source:
- reads `SUPABASE_SERVICE_ROLE_KEY` only inside Edge Function runtime.
- validates bearer user for user-triggered operations.
- verifies organization membership/role before mutation.
- reads `read_integration_vault_secret` for provider `LTX`, secret `API_KEY`.
- never returns `apiKey`, Authorization headers, or raw LTX signed video URL.
- contains current LTX V2 endpoint and `ltx-2-3-pro`, not legacy model IDs.

- [ ] **Step 2: Verify RED**

```bash
npm run test:run -- src/modules/video/generation/edge-source-security.test.ts
```
Expected: FAIL.

- [ ] **Step 3: Implement `submit` operation**

Request body:
```ts
type RequestBody = {
  operation: "submit" | "reconcile";
  organizationId: string;
  jobId: string;
  attemptId: string;
};
```
The Edge Function loads immutable DB input itself; it does not trust prompt/model/duration supplied by the caller.

- [ ] **Step 4: Implement `reconcile` operation**

Use saved provider job ID to poll. Normalize provider status. On completion invoke the import pipeline from Task 7. On failure persist safe normalized failure metadata.

- [ ] **Step 5: Add server-only Edge client function**

```ts
export function invokeVideoGeneration<T>(body: unknown): Promise<T> {
  return invokeEdgeFunction<T>("video-generation", body, productionDependencies());
}
```

- [ ] **Step 6: Run focused security tests + typecheck**

```bash
npm run test:run -- src/modules/video/generation/edge-source-security.test.ts src/modules/integrations/edge-client.test.ts
npm run typecheck
```
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add supabase/functions/video-generation src/modules/video/generation/edge-source-security.test.ts src/modules/integrations/edge-client.ts src/modules/integrations/edge-client.test.ts
git commit -m "feat(video): add secure provider execution edge function"
```

### Task 6: Retry and Reconciliation State Machine

**Files:**
- Create: `src/modules/video/generation/retry-policy.ts`
- Create: `src/modules/video/generation/retry-policy.test.ts`
- Create: `src/modules/video/generation/state-machine.ts`
- Create: `src/modules/video/generation/state-machine.test.ts`
- Create: `supabase/migrations/202609110010_video_generation_reconciliation.sql`

**Interfaces:**
- Consumes: normalized provider failures/states.
- Produces: bounded retry decisions and atomic DB transitions.

- [ ] **Step 1: Write RED retry tests**

Expected policy:
```ts
expect(classifyRetry({ code: "LTX_RATE_LIMITED", retryable: true }, 1)).toMatchObject({ retry: true });
expect(classifyRetry({ code: "LTX_CONTENT_FILTERED", retryable: false }, 1)).toEqual({ retry: false });
expect(classifyRetry({ code: "LTX_API_ERROR", retryable: true }, 4)).toEqual({ retry: false });
```
Backoff sequence before jitter: 5s, 15s, 45s.

- [ ] **Step 2: Verify RED**

```bash
npm run test:run -- src/modules/video/generation/retry-policy.test.ts src/modules/video/generation/state-machine.test.ts
```
Expected: FAIL.

- [ ] **Step 3: Implement state machine and retry policy**

Prevent illegal transitions including COMPLETED -> PROCESSING and FAILED terminal attempts -> same provider-job resubmission.

- [ ] **Step 4: Implement reconciliation RPCs**

Add invoker/worker-safe atomic functions for:
- claim attempt for submit/reconcile.
- record submitted provider ID.
- record normalized processing state.
- record import-pending state.
- mark failed/retrying/completed.

- [ ] **Step 5: Run focused tests + SQL contract checks**

```bash
npm run test:run -- src/modules/video/generation
npm run typecheck
```
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/modules/video/generation supabase/migrations/202609110010_video_generation_reconciliation.sql
git commit -m "feat(video): add durable reconciliation and retry state machine"
```

### Task 7: Provider Output Import Into PAK Media Storage

**Files:**
- Create: `src/modules/video/generation/media-import.ts`
- Create: `src/modules/video/generation/media-import.test.ts`
- Modify: `src/modules/media/storage-path.ts`
- Modify: `src/modules/media/storage-path.test.ts`
- Create: `supabase/migrations/202609110011_generated_video_media_import.sql`
- Modify: `supabase/functions/video-generation/index.ts`

**Interfaces:**
- Consumes: completed LTX result URL inside Edge runtime.
- Produces: PAK-owned storage object + `media_assets` row + completed attempt/job linkage.

- [ ] **Step 1: Write RED deterministic import tests**

Assert storage path:
```ts
buildGeneratedVideoStoragePath(orgId, planId, shotId, attemptId)
// -> `${orgId}/generated-video/${planId}-${shotId}-${attemptId}.mp4`
```
Test repeated import uses same path and does not create a second media row.

- [ ] **Step 2: Verify RED**

```bash
npm run test:run -- src/modules/video/generation/media-import.test.ts src/modules/media/storage-path.test.ts
```
Expected: FAIL.

- [ ] **Step 3: Implement download validation**

Require:
- HTTP 2xx.
- `content-type` starts `video/`.
- body non-empty.
- bounded maximum bytes constant.
- no provider URL persisted/logged.

- [ ] **Step 4: Implement storage/media atomic linkage**

Upload deterministic object; then RPC/upsert media row with:
```sql
asset_type = 'VIDEO'
source = 'GENERATED'
generating_job_id = <job>
scene_id = <scene>
```
Link attempt `media_asset_id` and mark job/attempt COMPLETED only after storage + DB lineage succeeds.

- [ ] **Step 5: Run tests + typecheck**

```bash
npm run test:run -- src/modules/video/generation/media-import.test.ts src/modules/media/storage-path.test.ts
npm run typecheck
```
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/modules/video/generation src/modules/media supabase/migrations/202609110011_generated_video_media_import.sql supabase/functions/video-generation/index.ts
git commit -m "feat(video): import provider output into PAK media storage"
```

### Task 8: Scene Planning Generation Actions and Read Model

**Files:**
- Create: `src/app/(app)/scene-planning/video-generation-actions.ts`
- Create: `src/app/(app)/scene-planning/video-generation-actions.test.ts`
- Modify: `src/app/(app)/scene-planning/workspace-data.ts`
- Modify: `src/app/(app)/scene-planning/workspace-data.test.ts`

**Interfaces:**
- Consumes: approved plan/shot IDs and generation repository.
- Produces: server actions to enqueue/retry/reconcile plus safe per-shot generation status for UI.

- [ ] **Step 1: Write RED authorization/action tests**

Assert:
- unauthenticated denied.
- REVIEWER/ANALYST denied before enqueue/Edge invocation.
- OWNER/ADMIN/EDITOR allowed.
- non-approved/stale plan rejected.
- action sends IDs only; no prompt/API key from browser input.

- [ ] **Step 2: Verify RED**

```bash
npm run test:run -- src/app/(app)/scene-planning/video-generation-actions.test.ts
```
Expected: FAIL.

- [ ] **Step 3: Implement actions**

Actions:
```ts
enqueueShotVideoGenerationAction(input)
reconcileShotVideoGenerationAction(input)
retryShotVideoGenerationAction(input)
```
Use strict Zod UUID schemas and server-loaded context.

- [ ] **Step 4: Extend workspace read model**

Each shot exposes safe status:
```ts
videoGeneration?: {
  jobId: string;
  attemptId: string;
  state: "QUEUED" | "GENERATING" | "IMPORTING" | "COMPLETED" | "FAILED";
  mediaAssetId?: string;
  retryable?: boolean;
  errorCode?: string;
};
```

- [ ] **Step 5: Run tests + typecheck**

```bash
npm run test:run -- src/app/(app)/scene-planning/video-generation-actions.test.ts src/app/(app)/scene-planning/workspace-data.test.ts
npm run typecheck
```
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/app/(app)/scene-planning
git commit -m "feat(scene-planning): add shot video generation actions"
```

### Task 9: Approved-Shot Generation UI

**Files:**
- Modify: `src/app/(app)/scene-planning/scene-plan-editor.tsx`
- Modify: `src/app/(app)/scene-planning/scene-plan-editor.test.tsx`
- Modify: `src/app/(app)/scene-planning/scene-planning-workspace.tsx`
- Modify: `src/app/(app)/scene-planning/scene-planning-workspace.test.tsx`

**Interfaces:**
- Consumes: safe per-shot generation state and actions from Task 8.
- Produces: generate/retry/reconcile UI only for approved current plans.

- [ ] **Step 1: Write RED UI tests**

Test:
- APPROVED/current/editor shot displays `Generate video`.
- DRAFT/QC_REQUIRED/REVIEW_REQUIRED/STALE does not.
- REVIEWER/ANALYST cannot see mutation controls.
- COMPLETED shows PAK media status/link, not provider URL.
- FAILED retryable shows Retry; terminal failure does not.

- [ ] **Step 2: Verify RED**

```bash
npm run test:run -- src/app/(app)/scene-planning/scene-plan-editor.test.tsx src/app/(app)/scene-planning/scene-planning-workspace.test.tsx
```
Expected: FAIL.

- [ ] **Step 3: Implement minimal UI**

Reuse existing visual language/status chips. Do not redesign Scene Planning. No provider-specific LTX copy beyond optional safe provider metadata in technical detail.

- [ ] **Step 4: Run UI tests + typecheck**

```bash
npm run test:run -- src/app/(app)/scene-planning/scene-plan-editor.test.tsx src/app/(app)/scene-planning/scene-planning-workspace.test.tsx
npm run typecheck
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/(app)/scene-planning
git commit -m "feat(scene-planning): expose approved-shot generation controls"
```

### Task 10: Unattended Reconciliation Trigger

**Files:**
- Create: `supabase/functions/video-generation-dispatcher/index.ts`
- Create: `src/modules/video/generation/dispatcher-source-security.test.ts`
- Create: `supabase/migrations/202609110012_video_generation_dispatch.sql`

**Interfaces:**
- Consumes: due `PROCESSING`, `IMPORT_PENDING`, or retry-ready jobs.
- Produces: bounded batch dispatch into the same reconciliation logic used by user-triggered actions.

- [ ] **Step 1: Write RED dispatcher tests**

Assert dispatcher:
- processes bounded batch size.
- never accepts arbitrary organization/job payload from anonymous caller.
- uses internal protected invocation/DB claim path.
- leaves browser presence irrelevant to job completion.

- [ ] **Step 2: Verify RED**

```bash
npm run test:run -- src/modules/video/generation/dispatcher-source-security.test.ts
```
Expected: FAIL.

- [ ] **Step 3: Implement due-job claim query/RPC**

Claim only generation jobs whose next reconciliation/retry time is due, using `FOR UPDATE SKIP LOCKED` or equivalent atomic claim semantics.

- [ ] **Step 4: Implement dispatcher Edge Function**

Use a protected platform/internal invocation model; JWT verification remains enabled unless a platform-scheduled invocation mechanism requires a separately verified secret. Never expose an unauthenticated general-purpose generation endpoint.

- [ ] **Step 5: Run focused tests**

```bash
npm run test:run -- src/modules/video/generation/dispatcher-source-security.test.ts
npm run typecheck
```
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/video-generation-dispatcher supabase/migrations/202609110012_video_generation_dispatch.sql src/modules/video/generation/dispatcher-source-security.test.ts
git commit -m "feat(video): add unattended generation reconciler"
```

### Task 11: E2E, Live Supabase, Edge Deployment, and Real Provider Smoke

**Files:**
- Create: `tests/e2e/video-generation.spec.ts`
- Modify: `docs/product/PAK_DEVELOPMENT_ROADMAP.md`
- Modify: `docs/product/PAK_TRACEABILITY_MATRIX.md`

**Interfaces:**
- Consumes: completed Tasks 1–10.
- Produces: release evidence and Phase 7 closure.

- [ ] **Step 1: Add fake-provider E2E tests**

Cover approved-shot generate -> progress -> completed media, retryable failure -> retry -> complete, terminal failure -> no duplicate media, and non-approved plan hides generation controls.

- [ ] **Step 2: Run full local/CI gate**

```bash
npm run typecheck
npm run lint
npm run test:run
npm run build
npx playwright test
```
Expected: all green.

- [ ] **Step 3: Apply migrations 008–012 to connected PAK Supabase**

Apply in repository order. Stop on first error. Then verify:
- RLS enabled on `video_generation_attempts`.
- anonymous reads blocked.
- cross-tenant lineage mutation rejected.
- provider-attempt mutation restricted to authorized/server paths.
- no secret-bearing columns.

- [ ] **Step 4: Run Supabase security/performance advisors**

Resolve every Phase 7 finding before merge. Pre-existing findings from earlier phases must be documented separately rather than misreported as Phase 7 regressions.

- [ ] **Step 5: Deploy Edge Functions**

Deploy `video-generation` and dispatcher with JWT verification enabled according to their auth design. Verify source/deployed version hashes and exercise fake-provider path first.

- [ ] **Step 6: Real LTX staging smoke when credential is configured**

Generate one short approved 16:9 shot with `ltx-2-3-pro`; verify provider job ID, normalized lifecycle, immediate media import, and no secret exposure. If LTX API key/credits are not configured, Phase 7 code may remain release-candidate but cannot be claimed production-provider verified.

- [ ] **Step 7: Update roadmap/traceability only from evidence**

Mark Phase 7 IMPLEMENTED only after all required gates including real provider smoke are satisfied. Otherwise mark exact remaining external blocker.

- [ ] **Step 8: Final exact-head PR verification and merge**

Ensure no unresolved review threads, exact-head CI green, live DB/Edge verification recorded, and merge with expected head SHA.
