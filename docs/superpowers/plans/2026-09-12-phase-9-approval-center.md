# Phase 9 Approval Center Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a tenant-safe product-wide Approval Center for exact content-artifact revisions and media-asset identities, with immutable decision history, automatic supersession, role-gated review actions, and a stable current-approval predicate for Phase 10 Publishing.

**Architecture:** Add a focused `src/modules/approval` domain backed by two organization-scoped tables: mutable `approval_requests` workflow envelopes and append-only `approval_events`. Browser/server clients submit only target IDs plus bounded review context; authenticated SECURITY DEFINER RPCs resolve authoritative target state, create exact snapshots/fingerprints, enforce roles, and mutate request state atomically with audit events. Content/media changes supersede stale approvals at the database layer. Scene Planning remains a separate domain approval authority and is surfaced only as a linked review workload.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript 5.9, Zod 4, Supabase Auth/Postgres/RLS/RPC, existing Media Library signed-preview Edge Function, Vitest, Testing Library, Playwright, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-09-12-phase-9-approval-center-design.md`

## Global Constraints

- Never touch Lovable.
- Keep Scene Planning approval lifecycle authoritative; do not create generic approval rows for `scene_plan_versions`.
- Supported generic target types are exactly `CONTENT_ARTIFACT` and `MEDIA_ASSET`.
- Submission roles: OWNER/ADMIN/EDITOR. Decision roles: OWNER/ADMIN/REVIEWER.
- ANALYST has no generic Approval Center queue access in Phase 9.
- Browser-supplied revision, checksum, script text, storage paths, approval flags, or snapshots are never authoritative.
- `publication_intent` is immutable bounded review context only; it never grants publishing authority.
- `approval_events` is immutable even against accidental privileged UPDATE/DELETE.
- User-callable SECURITY DEFINER functions must use fixed `search_path = public`, check `auth.uid()`, validate same-org membership/role, revoke EXECUTE from `public`/`anon`, and grant only to `authenticated`.
- Applied migrations are never rewritten; corrections are forward migrations.
- Phase 9 requires exact-head CI plus live Supabase migration/RLS/role/currentness/advisor verification before merge.
- No paid provider calls are required for Phase 9 acceptance.

---

## File Structure

### New files

- `src/modules/approval/types.ts` — domain types for target/state/event/decision/read models.
- `src/modules/approval/schema.ts` — Zod input contracts and bounded publication-intent/comment rules.
- `src/modules/approval/state-machine.ts` — pure decision/status helpers.
- `src/modules/approval/schema.test.ts` — input/state contract unit tests.
- `src/modules/approval/state-machine.test.ts` — transition/comment rule unit tests.
- `src/modules/approval/schema-sql.test.ts` — migration DDL/RLS/grant/immutability source assertions.
- `src/modules/approval/workflow-sql.test.ts` — submission/decision RPC source assertions.
- `src/modules/approval/supersession-sql.test.ts` — supersession/current-approval predicate source assertions.
- `src/modules/approval/read-model.ts` — row normalization and queue/detail view models.
- `src/modules/approval/read-model.test.ts` — safe row mapping tests.
- `src/modules/approval/repository.ts` — same-org queue/detail/event/provenance/domain-review reads.
- `src/modules/approval/repository.test.ts` — repository query/error mapping tests where practical.
- `supabase/migrations/202609120009_approval_center_schema.sql` — tables, indexes, immutable guards, RLS/grants.
- `supabase/migrations/202609120010_approval_center_workflow.sql` — authoritative submit/decision RPCs.
- `supabase/migrations/202609120011_approval_center_supersession.sql` — content/media supersession triggers and approval predicate.
- `src/app/(app)/approval-center/actions.ts` — authenticated submit/decide/list/detail/media-preview server actions.
- `src/app/(app)/approval-center/actions.test.ts` — role/input/safe-error action tests.
- `src/app/(app)/approval-center/approval-center-client.tsx` — queue filters/cards/domain-review affordance.
- `src/app/(app)/approval-center/approval-center-client.test.tsx` — queue/filter/render tests.
- `src/app/(app)/approval-center/[requestId]/page.tsx` — request detail server route.
- `src/app/(app)/approval-center/[requestId]/approval-review-client.tsx` — exact snapshot/history/decision UI.
- `src/app/(app)/approval-center/[requestId]/approval-review-client.test.tsx` — detail/action UI tests.
- `tests/e2e/approval-center.spec.ts` — operational Approval Center E2E.

### Modified files

- `src/app/(app)/approval-center/page.tsx` — replace readiness shell with operational queue.
- `src/components/app-shell/module-readiness.ts` — remove `/approval-center` from future-readiness route union/config.
- `src/components/app-shell/b3-route-readiness.test.ts` — stop treating Approval Center as future route.
- `src/app/(app)/content-studio/multilingual-content-panel.tsx` — add review submission entry point for eligible generated artifacts.
- `src/app/(app)/content-studio/multilingual-content-panel.test.tsx` — submission affordance tests.
- `src/app/(app)/media-library/media-detail.tsx` and/or `media-library-client.tsx` — add review submission entry point for eligible active checksum-bearing media.
- matching Media Library component test — submission affordance tests.
- `tests/e2e/module-readiness.spec.ts` — remove Approval Center from Planned matrix.
- `tests/e2e/track-b-release.spec.ts` — assert Approval Center is operational, not future readiness.
- `docs/product/PAK_BACKEND_SCHEMA.md` — move approval entities from planned to implemented logical model after live verification.
- `docs/product/PAK_DEVELOPMENT_ROADMAP.md` — mark Phase 9 IMPLEMENTED only after all release gates pass.
- `docs/product/PAK_TRACEABILITY_MATRIX.md` — map PRD-APR/UX-APR to concrete schema/UI/tests/runtime evidence.
- `docs/product/PAK_MASTER_PRD.md` / `PAK_UI_UX_SPEC.md` current-maturity lines — synchronize only after implementation is verified.

---

## Task 1 — Approval Domain Contracts and Pure State Machine

**Files:**
- Create: `src/modules/approval/types.ts`
- Create: `src/modules/approval/schema.ts`
- Create: `src/modules/approval/schema.test.ts`
- Create: `src/modules/approval/state-machine.ts`
- Create: `src/modules/approval/state-machine.test.ts`

- [ ] **Step 1: Write failing schema/state tests first.**

Tests must assert:
- target type accepts only `CONTENT_ARTIFACT | MEDIA_ASSET`;
- decision accepts only `APPROVE | REQUEST_CHANGES | REJECT`;
- publication intent is an object with bounded serialized size and rejects arrays/primitives;
- decision comments are trimmed, maximum 2000 chars;
- request-changes/reject require at least one non-whitespace character;
- approve permits empty/omitted comment;
- only PENDING requests are decisionable;
- decision maps to APPROVED / CHANGES_REQUESTED / REJECTED.

Run:

```bash
npm run test:run -- src/modules/approval/schema.test.ts src/modules/approval/state-machine.test.ts
```

Expected RED: modules do not exist yet.

- [ ] **Step 2: Implement minimum domain contracts.**

Use these public shapes:

```ts
export type ApprovalTargetType = "CONTENT_ARTIFACT" | "MEDIA_ASSET";
export type ApprovalStatus = "PENDING" | "CHANGES_REQUESTED" | "APPROVED" | "REJECTED" | "SUPERSEDED";
export type ApprovalEventType = "SUBMITTED" | "APPROVED" | "CHANGES_REQUESTED" | "REJECTED" | "SUPERSEDED";
export type ApprovalDecision = "APPROVE" | "REQUEST_CHANGES" | "REJECT";

export type SubmitApprovalInput = {
  organizationId: string;
  targetType: ApprovalTargetType;
  targetId: string;
  publicationIntent?: Record<string, unknown>;
};

export type DecideApprovalInput = {
  organizationId: string;
  requestId: string;
  decision: ApprovalDecision;
  comment?: string;
};
```

`state-machine.ts` exposes a small pure helper such as:

```ts
export function decisionStatus(decision: ApprovalDecision): Extract<ApprovalStatus,
  "APPROVED" | "CHANGES_REQUESTED" | "REJECTED">;

export function canDecideApproval(status: ApprovalStatus): boolean;
```

- [ ] **Step 3: Run focused tests GREEN.**

```bash
npm run test:run -- src/modules/approval/schema.test.ts src/modules/approval/state-machine.test.ts
```

Expected: all focused tests pass.

- [ ] **Step 4: Commit Task 1.**

```bash
git add src/modules/approval

git commit -m "feat: define approval center domain contracts"
```

---

## Task 2 — Approval Tables, RLS, Grants, and Immutable Event Guard

**Files:**
- Create: `src/modules/approval/schema-sql.test.ts`
- Create: `supabase/migrations/202609120009_approval_center_schema.sql`

- [ ] **Step 1: Write RED SQL source-security tests.**

Assert the migration contains:
- `approval_requests` and `approval_events` organization-scoped tables;
- exact target/status/event CHECK constraints;
- unique `(organization_id, target_type, target_fingerprint)`;
- content-vs-media revision/checksum shape constraint;
- `target_snapshot` and `publication_intent` JSON object checks;
- RLS enabled on both tables;
- same-org SELECT policy limited to OWNER/ADMIN/EDITOR/REVIEWER;
- `anon` has no privileges;
- `authenticated` has SELECT only, no direct INSERT/UPDATE/DELETE;
- immutable trigger on `approval_events` that raises on UPDATE/DELETE;
- indexes for queue `(organization_id,status,requested_at desc,id)` and event history `(approval_request_id,created_at,id)`.

Run:

```bash
npm run test:run -- src/modules/approval/schema-sql.test.ts
```

Expected RED: migration is absent.

- [ ] **Step 2: Implement migration 009.**

Critical table shape:

```sql
create table public.approval_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  target_type text not null check (target_type in ('CONTENT_ARTIFACT','MEDIA_ASSET')),
  target_id uuid not null,
  target_revision integer,
  target_checksum text,
  target_fingerprint text not null,
  target_snapshot jsonb not null,
  publication_intent jsonb not null default '{}'::jsonb,
  status text not null default 'PENDING' check (status in ('PENDING','CHANGES_REQUESTED','APPROVED','REJECTED','SUPERSEDED')),
  requested_by uuid references auth.users(id) on delete set null,
  requested_at timestamptz not null default now(),
  decided_by uuid references auth.users(id) on delete set null,
  decided_at timestamptz,
  superseded_at timestamptz,
  superseded_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, target_type, target_fingerprint)
);
```

Add CHECKs for identity shape and JSON object types. Create `approval_events` per spec. Implement `approval_events_immutable()` trigger before UPDATE/DELETE.

RLS SELECT policy should use existing organization-membership conventions and role filter. Do not create browser mutation policies.

- [ ] **Step 3: Run focused SQL test GREEN.**

```bash
npm run test:run -- src/modules/approval/schema-sql.test.ts
```

- [ ] **Step 4: Commit Task 2.**

```bash
git add src/modules/approval/schema-sql.test.ts supabase/migrations/202609120009_approval_center_schema.sql

git commit -m "feat: add approval center ledger schema"
```

---

## Task 3 — Authoritative Submission and Decision RPCs

**Files:**
- Create: `src/modules/approval/workflow-sql.test.ts`
- Create: `supabase/migrations/202609120010_approval_center_workflow.sql`

- [ ] **Step 1: Write RED workflow SQL tests.**

Assert `submit_approval_request(...)`:
- SECURITY DEFINER, fixed search path;
- obtains `auth.uid()` and rejects unauthenticated calls;
- allows only OWNER/ADMIN/EDITOR same-org memberships;
- accepts target type + target ID + publication intent, not revision/checksum/snapshot;
- resolves `CONTENT_ARTIFACT` from `content_script_artifacts` and parent content under same org;
- requires GENERATED + nonempty script;
- resolves `MEDIA_ASSET` from `media_assets` under same org;
- requires ACTIVE + nonempty checksum;
- constructs fingerprint server-side;
- inserts or returns existing exact fingerprint idempotently;
- appends `SUBMITTED` event only for a newly created request.

Assert `decide_approval_request(...)`:
- auth + same-org OWNER/ADMIN/REVIEWER;
- locks request `FOR UPDATE`;
- allows only PENDING;
- requires comment for REQUEST_CHANGES/REJECT;
- revalidates exact artifact revision/status or media checksum/status;
- stale target path marks SUPERSEDED + immutable event and does not approve;
- valid decision updates request and appends exactly one event atomically;
- browser cannot supply target snapshot/currentness.

Assert grants are revoked from `public`/`anon` and only `authenticated` executes both functions.

- [ ] **Step 2: Implement migration 010.**

RPC signatures should remain narrow:

```sql
public.submit_approval_request(
  _organization_id uuid,
  _target_type text,
  _target_id uuid,
  _publication_intent jsonb default '{}'::jsonb
) returns uuid
```

```sql
public.decide_approval_request(
  _organization_id uuid,
  _approval_request_id uuid,
  _decision text,
  _comment text default null
) returns table (
  approval_request_id uuid,
  status text,
  stale_target boolean
)
```

For content snapshot, include safe exact fields from `content_script_artifacts` plus parent content topic/context. For media snapshot, include only safe metadata required by review; storage identity may be persisted as review metadata but is not returned as a raw signed credential.

Use deterministic SHA-256 via `digest(..., 'sha256')` if `pgcrypto` is available from foundation; encode as `sha256:<hex>`.

- [ ] **Step 3: Run focused tests GREEN.**

```bash
npm run test:run -- src/modules/approval/workflow-sql.test.ts
```

- [ ] **Step 4: Commit Task 3.**

```bash
git add src/modules/approval/workflow-sql.test.ts supabase/migrations/202609120010_approval_center_workflow.sql

git commit -m "feat: add authoritative approval workflow RPCs"
```

---

## Task 4 — Automatic Supersession and Current-Approval Predicate

**Files:**
- Create: `src/modules/approval/supersession-sql.test.ts`
- Create: `supabase/migrations/202609120011_approval_center_supersession.sql`

- [ ] **Step 1: Write RED supersession tests.**

Assert:
- content trigger fires on revision/status/script eligibility change;
- media trigger fires on status/checksum identity change;
- matching PENDING/CHANGES_REQUESTED/APPROVED requests become SUPERSEDED;
- REJECTED history is not rewritten;
- each transition records one SYSTEM SUPERSEDED event;
- helper is idempotent and does not duplicate events on repeated updates;
- `is_target_currently_approved(...)` verifies same org, current target eligibility, exact requested revision/checksum and APPROVED request status;
- predicate is not directly callable by anon and has an intentional execution grant suitable for authenticated future Publishing/server use.

Run RED:

```bash
npm run test:run -- src/modules/approval/supersession-sql.test.ts
```

- [ ] **Step 2: Implement migration 011.**

Use one internal SECURITY DEFINER helper to supersede matching requests safely, then attach thin triggers to `content_script_artifacts` and `media_assets`.

Predicate signature:

```sql
public.is_target_currently_approved(
  _organization_id uuid,
  _target_type text,
  _target_id uuid,
  _target_revision integer default null,
  _target_checksum text default null
) returns boolean
```

It must not trust a browser approval flag and must return false for mismatched/non-current identity.

- [ ] **Step 3: Run focused tests GREEN and commit.**

```bash
npm run test:run -- src/modules/approval/supersession-sql.test.ts

git add src/modules/approval/supersession-sql.test.ts supabase/migrations/202609120011_approval_center_supersession.sql

git commit -m "feat: supersede stale approvals automatically"
```

---

## Task 5 — Approval Read Model and Repository

**Files:**
- Create: `src/modules/approval/read-model.ts`
- Create: `src/modules/approval/read-model.test.ts`
- Create: `src/modules/approval/repository.ts`
- Create: `src/modules/approval/repository.test.ts`

- [ ] **Step 1: Write RED mapping/repository tests.**

Cover:
- snake_case DB row to camelCase safe queue item;
- target snapshot discriminated parsing for content/media;
- no signed URL/secret fields in queue read model;
- status filter normalization with default PENDING and max page size 50;
- detail returns request + ordered immutable events;
- content detail loads immutable Knowledge provenance from `content_item_knowledge_sources` by snapshotted content item ID;
- Scene Planning review workload is read-only count/query of `scene_plan_versions.status = 'REVIEW_REQUIRED'` for same org;
- repository errors map to `AppError` without SQL payloads.

- [ ] **Step 2: Implement read models and repository.**

Suggested public interface:

```ts
export interface ApprovalRepository {
  list(input: ApprovalListQuery): Promise<ApprovalListPage>;
  getDetail(organizationId: string, requestId: string): Promise<ApprovalDetail | null>;
  getEvents(organizationId: string, requestId: string): Promise<readonly ApprovalEvent[]>;
  getContentProvenance(organizationId: string, contentItemId: string): Promise<readonly ApprovalKnowledgeSource[]>;
  countScenePlanReviewRequired(organizationId: string): Promise<number>;
}
```

Use `createServerSupabaseClient()` and rely on RLS in addition to explicit organization filters.

- [ ] **Step 3: Run focused tests GREEN and commit.**

```bash
npm run test:run -- src/modules/approval/read-model.test.ts src/modules/approval/repository.test.ts

git add src/modules/approval

git commit -m "feat: add approval center read model"
```

---

## Task 6 — Server Actions and Role Boundary

**Files:**
- Create: `src/app/(app)/approval-center/actions.ts`
- Create: `src/app/(app)/approval-center/actions.test.ts`

- [ ] **Step 1: Write RED action tests.**

Use dependency injection like existing Media Library actions. Assert:
- unauthenticated submission/decision/list/detail fail safely;
- cross-org/no membership fail before RPC invocation;
- OWNER/ADMIN/EDITOR can submit, REVIEWER/ANALYST cannot;
- OWNER/ADMIN/REVIEWER can decide, EDITOR/ANALYST cannot;
- invalid comments/publication intent fail before RPC;
- RPC receives only IDs/decision/bounded context, never revision/checksum/snapshot;
- media preview action delegates to existing `invokeMediaLibrary({operation:'preview', ...})` only after same-org membership;
- unexpected errors return safe user text.

- [ ] **Step 2: Implement actions.**

Expose:

```ts
submitApprovalAction(input)
decideApprovalAction(input)
listApprovalRequestsAction(input)
loadApprovalDetailAction(input)
previewApprovalMediaAction(input)
```

Production dependencies may reuse `SupabaseScenePlanningRepository.getActorRole()` for organization role resolution, as Media Library does, while Approval Center owns its approval repository/RPC calls.

- [ ] **Step 3: Run focused tests GREEN and commit.**

```bash
npm run test:run -- 'src/app/(app)/approval-center/actions.test.ts'

git add 'src/app/(app)/approval-center/actions.ts' 'src/app/(app)/approval-center/actions.test.ts'

git commit -m "feat: add approval center server actions"
```

---

## Task 7 — Operational Approval Queue UI and Scene Planning Review Affordance

**Files:**
- Create: `src/app/(app)/approval-center/approval-center-client.tsx`
- Create: `src/app/(app)/approval-center/approval-center-client.test.tsx`
- Modify: `src/app/(app)/approval-center/page.tsx`
- Modify: `src/components/app-shell/module-readiness.ts`
- Modify: `src/components/app-shell/b3-route-readiness.test.ts`

- [ ] **Step 1: Write RED component/readiness tests.**

Assert:
- four primary tabs have exact labels Awaiting review / Changes requested / Approved / Rejected;
- SUPERSEDED is secondary/history filter;
- target-type filtering Content/Media is optional but if implemented must not alter status semantics;
- rows show target label, exact short revision/checksum identity, status, requester/time and decision metadata when present;
- Scene Planning review-required count renders as `Domain approval` and links to `/scene-planning`;
- `/approval-center` no longer exists in `B3ModuleRoute` future-readiness config.

- [ ] **Step 2: Implement page + client.**

The server page resolves organization/session context using existing app patterns and supplies an initial PENDING queue page plus scene review-required count. Client filters reload through server action rather than bypassing RLS.

- [ ] **Step 3: Run focused tests GREEN and commit.**

```bash
npm run test:run -- 'src/app/(app)/approval-center/approval-center-client.test.tsx' src/components/app-shell/b3-route-readiness.test.ts

git add 'src/app/(app)/approval-center' src/components/app-shell/module-readiness.ts src/components/app-shell/b3-route-readiness.test.ts

git commit -m "feat: replace approval readiness shell with review queue"
```

---

## Task 8 — Exact Review Detail, Audit Timeline, Decisions, and Media Preview

**Files:**
- Create: `src/app/(app)/approval-center/[requestId]/page.tsx`
- Create: `src/app/(app)/approval-center/[requestId]/approval-review-client.tsx`
- Create: `src/app/(app)/approval-center/[requestId]/approval-review-client.test.tsx`

- [ ] **Step 1: Write RED detail tests.**

Content detail:
- renders exact snapshotted script, revision, language, source/translation status and source revision;
- renders Knowledge provenance entries from immutable existing snapshots;
- renders publication intent as non-authoritative review context;
- renders chronological event history.

Media detail:
- renders asset metadata/checksum and lineage;
- secure preview is user-triggered and never stores signed URL as durable state;
- preview errors are safe.

Actions:
- buttons shown only for decision-capable role on PENDING request;
- Request changes and Reject require comment;
- Approve comment optional;
- after action, authoritative refreshed status is rendered;
- SUPERSEDED requests have no decision buttons.

- [ ] **Step 2: Implement detail route/client and run GREEN.**

```bash
npm run test:run -- 'src/app/(app)/approval-center/[requestId]/approval-review-client.test.tsx'
```

- [ ] **Step 3: Commit Task 8.**

```bash
git add 'src/app/(app)/approval-center/[requestId]'

git commit -m "feat: add exact approval review workspace"
```

---

## Task 9 — Content Studio Submission Entry Point

**Files:**
- Modify: `src/app/(app)/content-studio/multilingual-content-panel.tsx`
- Modify: `src/app/(app)/content-studio/multilingual-content-panel.test.tsx`
- If needed, Modify: `src/app/(app)/content-studio/page.tsx`

- [ ] **Step 1: Add RED component tests.**

Assert:
- GENERATED artifact with nonempty script exposes `Submit for review` for OWNER/ADMIN/EDITOR;
- STALE/FAILED/PENDING/GENERATING artifacts do not expose eligible submission;
- REVIEWER/ANALYST do not get submit control;
- action sends only organizationId, `CONTENT_ARTIFACT`, artifact ID, and bounded review context;
- UI does not send revision/script text as authoritative request fields;
- idempotent existing exact request is surfaced as an existing review rather than duplicate error.

- [ ] **Step 2: Implement minimal integration, run GREEN, commit.**

```bash
npm run test:run -- 'src/app/(app)/content-studio/multilingual-content-panel.test.tsx'

git add 'src/app/(app)/content-studio/multilingual-content-panel.tsx' 'src/app/(app)/content-studio/multilingual-content-panel.test.tsx' 'src/app/(app)/content-studio/page.tsx'

git commit -m "feat: submit content artifacts for approval"
```

---

## Task 10 — Media Library Submission Entry Point

**Files:**
- Modify: `src/app/(app)/media-library/media-detail.tsx`
- Modify: `src/app/(app)/media-library/media-library-client.tsx` only if action plumbing is owned there
- Modify matching test file(s)

- [ ] **Step 1: Add RED media submission tests.**

Assert:
- only ACTIVE media with a checksum is review-eligible;
- OWNER/ADMIN/EDITOR see submission control;
- REVIEWER/ANALYST do not;
- action sends only org ID, `MEDIA_ASSET`, media ID and bounded publication intent;
- checksum/storage path are not trusted browser submission fields;
- archive/delete behavior from Phase 8 is unchanged.

- [ ] **Step 2: Implement minimal integration, run GREEN, commit.**

```bash
npm run test:run -- 'src/app/(app)/media-library/media-library-client.test.tsx'

git add 'src/app/(app)/media-library'

git commit -m "feat: submit media assets for approval"
```

---

## Task 11 — Approval Center E2E and Readiness Regression Coverage

**Files:**
- Create: `tests/e2e/approval-center.spec.ts`
- Modify: `tests/e2e/module-readiness.spec.ts`
- Modify: `tests/e2e/track-b-release.spec.ts`

- [ ] **Step 1: Write RED E2E expectations.**

At minimum verify under the existing E2E bypass/runtime conventions:
- Approval Center route renders operational heading/queue controls, not `Planned` readiness page;
- primary status tabs visible;
- Scene Planning domain approval affordance visible;
- navigation still includes Approval Center in fixed order;
- future readiness tests no longer expect Approval Center as Planned.

Where fixture state supports it, cover request detail rendering and action validation without requiring provider spend.

- [ ] **Step 2: Make only E2E-fixture-safe UI adjustments needed for GREEN.**

Run:

```bash
npm run test:e2e -- tests/e2e/approval-center.spec.ts tests/e2e/module-readiness.spec.ts tests/e2e/track-b-release.spec.ts
```

- [ ] **Step 3: Commit Task 11.**

```bash
git add tests/e2e

git commit -m "test: cover approval center workflow"
```

---

## Task 12 — Full Local/CI Verification Before Live Database Rollout

- [ ] **Step 1: Run complete non-E2E verification.**

```bash
npm run typecheck
npm run lint
npm run test:run
npm run build
```

Expected: all GREEN.

- [ ] **Step 2: Run worker regressions even though Phase 9 does not change worker code.**

```bash
npm install --prefix workers/video-assembly
npm run typecheck --prefix workers/video-assembly
npm test --prefix workers/video-assembly
docker build -t pak-video-assembly-worker workers/video-assembly
docker run --rm --entrypoint node pak-video-assembly-worker dist/smoke.js
```

- [ ] **Step 3: Run full Playwright.**

```bash
npx playwright install --with-deps chromium
npm run test:e2e
```

- [ ] **Step 4: Fix only genuine regressions using TDD and rerun affected/full gates.**

- [ ] **Step 5: Push branch/open draft PR and require exact-head GitHub Actions GREEN.**

Do not apply production migrations while exact-head CI is failing.

---

## Task 13 — Live Supabase Rollout and Security/Currentness Proof

**Project:** existing PAK Supabase project; do not create a duplicate.

- [ ] **Step 1: Re-read current Supabase plugin skill and list existing remote migrations before DDL.**

- [ ] **Step 2: Apply migrations 009 → 010 → 011 in order through the migration API.**

Never use ad-hoc SQL Editor DDL unless required for a diagnosed blocker; migration history must stay authoritative.

- [ ] **Step 3: Verify live schema/grants/RLS.**

Query `pg_class`, `pg_policy`, `information_schema.role_table_grants`, `pg_proc`/`has_function_privilege` and confirm:
- RLS enabled on both tables;
- anon no access;
- authenticated SELECT only on tables;
- submit/decision function execution restricted as designed;
- event UPDATE/DELETE guard exists;
- function definitions use fixed search path/auth/role checks.

- [ ] **Step 4: Run controlled live role probes.**

Use existing memberships only; do not fabricate production tenants merely to satisfy a test. Prove as much as live membership availability allows:
- submitter role can submit eligible fixture target;
- decision role can approve/request changes/reject controlled fixture request;
- EDITOR decision denied;
- REVIEWER submission denied;
- ANALYST queue denied if an analyst membership exists;
- cross-org negative test only if two legitimate org contexts exist; otherwise document that live two-tenant probe is unavailable and retain static/RLS negative proof.

Use reversible/synthetic fixture records clearly tagged for Phase 9 and clean them after evidence is captured. Do not mutate real business content merely to force a test.

- [ ] **Step 5: Prove supersession/current approval live.**

For a controlled fixture content artifact or media asset:
1. submit exact identity;
2. approve it;
3. verify `is_target_currently_approved(...) = true`;
4. advance revision or replace/alter controlled eligibility through supported mutation;
5. verify old request becomes SUPERSEDED with one SYSTEM event;
6. verify predicate becomes false;
7. verify stale request cannot be approved.

- [ ] **Step 6: Clean all Phase 9 fixture rows/data and verify zero residue.**

- [ ] **Step 7: Run Supabase security + performance advisors.**

New Phase 9 security findings are release blockers. Performance INFO/WARN items are assessed and fixed when material; otherwise explicitly documented.

---

## Task 14 — Governance Synchronization and Final Release Gate

**Files:**
- Modify: `docs/product/PAK_BACKEND_SCHEMA.md`
- Modify: `docs/product/PAK_DEVELOPMENT_ROADMAP.md`
- Modify: `docs/product/PAK_TRACEABILITY_MATRIX.md`
- Modify maturity notes in `docs/product/PAK_MASTER_PRD.md` and `docs/product/PAK_UI_UX_SPEC.md` as needed.

- [ ] **Step 1: Update docs only after live acceptance.**

Roadmap Phase 9 becomes `IMPLEMENTED` only when:
- exact-head CI GREEN;
- migrations live and recorded;
- role/RLS/function probes pass;
- immutable audit/currentness/supersession live fixture passes;
- fixture cleanup verified;
- advisors reviewed.

- [ ] **Step 2: Record release evidence in PR checkpoint comment.**

Include:
- final head SHA;
- CI run/job IDs;
- remote migration versions/names;
- RLS/function privilege results;
- controlled live workflow evidence;
- supersession/predicate evidence;
- cleanup result;
- advisor status;
- statement that Scene Planning authority remained separate;
- statement that Lovable was untouched.

Do not include secrets, signed URLs, JWTs or private fixture content.

- [ ] **Step 3: Rerun full exact-head CI after governance-doc commits.**

Any documentation commit changes the exact release head; do not reuse old CI evidence.

- [ ] **Step 4: Run final code review / unresolved-thread check.**

No unresolved review threads; PR mergeable; exact head stable.

- [ ] **Step 5: Mark PR ready and merge only with expected-head safety.**

- [ ] **Step 6: Verify `main` merge commit and production Supabase state.**

Phase 9 is complete only after `main` contains the merge and live approval boundaries remain healthy.

---

## Acceptance Matrix

| Requirement | Evidence |
|---|---|
| PRD-APR-001 explicit review state | `approval_requests.status`, queue UI, DB constraints |
| PRD-APR-002 approve/reject/request changes | decision RPC + role/action tests + detail UI |
| PRD-APR-003 immutable events | `approval_events`, no auth mutation grants, immutable trigger, live probe |
| PRD-APR-004 publication prerequisite | `is_target_currently_approved(...)` exact-identity predicate |
| PRD-APR-005 revision invalidation | content/media supersession triggers + live currentness proof |
| UX-APR-001 queue | four primary tabs + superseded history |
| UX-APR-002 exact review | snapshot detail + provenance + media signed preview + publication intent |
| UX-APR-003 explicit actions/comments | UI/action/schema + immutable event history |
| UX-APR-004 Scene Planning integration | read-only Domain approval affordance; no generic Scene Plan mutation |
| Tenant isolation | RLS + same-org RPC checks + negative/static/live probes |
| RBAC | submit OWNER/ADMIN/EDITOR; decide OWNER/ADMIN/REVIEWER; ANALYST excluded |
| Regression safety | full CI incl. worker container smoke + Playwright |

## Final Definition of Done

Phase 9 is done when the Approval Center is operational in the app, exact content/media review decisions are durable and immutable, stale approvals automatically cease to authorize downstream use, Scene Planning retains its independent approval authority, the live PAK Supabase project passes Phase 9 security/currentness tests, governance docs match reality, exact-head CI is green, and the verified PR is merged into `main` without touching Lovable.
