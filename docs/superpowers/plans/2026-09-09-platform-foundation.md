# PAK Platform Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first production-grade foundation of PAK Marketing Automation with tenant-safe Supabase primitives, durable job orchestration, provider contracts, media boundaries, module shell, tests, and CI without implementing production-complete business modules yet.

**Architecture:** Use a single Next.js application for the web/control plane, Supabase for Auth/Postgres/Storage, and Postgres-backed job leasing for durable orchestration. Keep domain boundaries explicit, server-only secrets isolated, and video generation behind provider contracts so external GPU workers and LTX can be introduced without coupling the UI or content modules to provider internals.

**Tech Stack:** Next.js, TypeScript, Tailwind CSS, Supabase, Zod, Vitest, Testing Library, Playwright, GitHub Actions, PostgreSQL SQL migrations.

**Spec:** `docs/superpowers/specs/2026-09-09-pak-marketing-automation-design.md`

## Global Constraints

- PAK is completely separate from Aurexis, Lovable, and any Lovable-attached Supabase project.
- Never write implementation directly to `main`; implementation branch is `feat/platform-foundation`.
- Supabase Auth is the identity provider; database RLS is the final tenant authorization boundary.
- All tenant-owned data must be organization-scoped or reachable only through an organization-scoped parent.
- Provider/API secrets must remain server-only.
- Durable job states are `QUEUED`, `PROCESSING`, `COMPLETED`, with `FAILED`, `RETRYING`, `CANCELLED` lifecycle states.
- LTX is the primary video provider but all generation access goes through a provider-neutral contract.
- 90–180 second videos are scene-based; final render may begin only after required scenes succeed.
- No unnecessary message broker, microservice split, or production GPU integration in the foundation phase.
- TDD is mandatory for domain logic and authorization-sensitive behavior.
- Verification must include typecheck, lint, unit/integration tests, applicable E2E tests, and release self-review.

---

## File Map

### Application and tooling
- `package.json` — scripts and dependency manifest.
- `tsconfig.json` — strict TypeScript configuration.
- `next.config.ts` — Next.js configuration.
- `postcss.config.mjs` — Tailwind/PostCSS wiring.
- `eslint.config.mjs` — lint configuration.
- `vitest.config.ts` — unit/integration test configuration.
- `playwright.config.ts` — E2E configuration.
- `.env.example` — documented public/server environment contract without secrets.
- `.gitignore` — environment/build/worktree exclusions.
- `src/app/layout.tsx` — root layout.
- `src/app/page.tsx` — dashboard landing shell.
- `src/app/globals.css` — Tailwind globals.

### Shared infrastructure
- `src/lib/env/schema.ts` — Zod environment schema.
- `src/lib/env/server.ts` — server-only validated environment accessor.
- `src/lib/env/public.ts` — browser-safe environment accessor.
- `src/lib/supabase/browser.ts` — browser Supabase client factory.
- `src/lib/supabase/server.ts` — server Supabase client factory.
- `src/lib/logging/logger.ts` — structured logging interface with redaction hooks.
- `src/lib/errors/app-error.ts` — normalized application error primitives.

### Auth / organization / RBAC
- `src/modules/auth/roles.ts` — canonical role constants and permission mapping.
- `src/modules/auth/authorization.ts` — pure authorization checks.
- `src/modules/auth/authorization.test.ts` — role/permission TDD coverage.
- `src/modules/organizations/types.ts` — organization and membership domain types.
- `src/modules/organizations/service.ts` — server-side organization membership lookup boundary.

### Jobs
- `src/modules/jobs/types.ts` — job state/type contracts.
- `src/modules/jobs/state-machine.ts` — legal transition logic.
- `src/modules/jobs/state-machine.test.ts` — state transition tests.
- `src/modules/jobs/repository.ts` — persistence boundary interface for job operations.
- `src/modules/jobs/claim.ts` — worker claim/lease contract used by server-side executors.

### Providers / scenes
- `src/modules/video/providers/types.ts` — provider-neutral request/status/result/error contracts.
- `src/modules/video/providers/provider.ts` — provider interface.
- `src/modules/video/providers/fake-provider.ts` — deterministic test provider.
- `src/modules/video/providers/fake-provider.test.ts` — provider contract tests.
- `src/modules/video/scenes/types.ts` — scene and continuity metadata contracts.
- `src/modules/video/scenes/readiness.ts` — final-render readiness rules.
- `src/modules/video/scenes/readiness.test.ts` — scene readiness tests.

### Media
- `src/modules/media/types.ts` — media metadata contracts.
- `src/modules/media/storage-path.ts` — tenant-safe storage path generation.
- `src/modules/media/storage-path.test.ts` — storage path validation tests.

### Navigation shell
- `src/components/app-shell/app-shell.tsx` — global application shell.
- `src/components/app-shell/navigation.ts` — approved module navigation registry.
- `src/components/app-shell/navigation.test.ts` — completeness/uniqueness tests.
- `src/app/(app)/dashboard/page.tsx`
- `src/app/(app)/content-studio/page.tsx`
- `src/app/(app)/ai-representative/page.tsx`
- `src/app/(app)/campus-locations/page.tsx`
- `src/app/(app)/podcast/page.tsx`
- `src/app/(app)/manual-generation/page.tsx`
- `src/app/(app)/student-testimonials/page.tsx`
- `src/app/(app)/media-library/page.tsx`
- `src/app/(app)/knowledge-base/page.tsx`
- `src/app/(app)/content-calendar/page.tsx`
- `src/app/(app)/approval-center/page.tsx`
- `src/app/(app)/publishing/page.tsx`
- `src/app/(app)/analytics/page.tsx`
- `src/app/(app)/settings/page.tsx`

### Supabase migrations
- `supabase/migrations/202609090001_foundation_extensions.sql` — UUID/extensions/helpers.
- `supabase/migrations/202609090002_organizations_memberships.sql` — organizations, memberships, indexes, RLS helpers/policies.
- `supabase/migrations/202609090003_jobs.sql` — durable jobs, legal state constraints, claim function, RLS.
- `supabase/migrations/202609090004_media.sql` — media metadata and storage-related RLS primitives.
- `supabase/migrations/202609090005_video_scenes.sql` — scene persistence, continuity JSON, retries, QA state, RLS.

### Tests and CI
- `tests/rls/foundation-rls.sql` — SQL assertions for cross-org denial and same-org access.
- `tests/e2e/navigation.spec.ts` — critical shell navigation smoke test.
- `.github/workflows/ci.yml` — lint/typecheck/test/build/E2E baseline.

---

### Task 1: Bootstrap the Next.js Foundation

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `next.config.ts`
- Create: `postcss.config.mjs`
- Create: `eslint.config.mjs`
- Create: `vitest.config.ts`
- Create: `playwright.config.ts`
- Create: `.gitignore`
- Create: `.env.example`
- Create: `src/app/layout.tsx`
- Create: `src/app/page.tsx`
- Create: `src/app/globals.css`

**Interfaces:**
- Consumes: none.
- Produces: a bootable strict-TypeScript Next.js/Tailwind application with standard scripts `dev`, `build`, `start`, `lint`, `typecheck`, `test`, `test:run`, `test:e2e`.

- [ ] **Step 1: Create package metadata and scripts**

Use a package manifest equivalent to:

```json
{
  "name": "pak-marketing-automation",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint .",
    "typecheck": "tsc --noEmit",
    "test": "vitest",
    "test:run": "vitest run",
    "test:e2e": "playwright test"
  },
  "dependencies": {
    "@supabase/ssr": "^0.7.0",
    "@supabase/supabase-js": "^2.57.0",
    "next": "^15.5.0",
    "react": "^19.1.0",
    "react-dom": "^19.1.0",
    "zod": "^4.1.0"
  },
  "devDependencies": {
    "@eslint/eslintrc": "^3.3.0",
    "@playwright/test": "^1.55.0",
    "@testing-library/jest-dom": "^6.8.0",
    "@testing-library/react": "^16.3.0",
    "@types/node": "^22.18.0",
    "@types/react": "^19.1.0",
    "@types/react-dom": "^19.1.0",
    "eslint": "^9.35.0",
    "eslint-config-next": "^15.5.0",
    "jsdom": "^26.1.0",
    "tailwindcss": "^4.1.0",
    "typescript": "^5.9.0",
    "vitest": "^3.2.0"
  }
}
```

- [ ] **Step 2: Add strict TypeScript and framework configuration**

Set `strict: true`, `noUncheckedIndexedAccess: true`, `exactOptionalPropertyTypes: true`, and path alias `@/* -> ./src/*` in `tsconfig.json`. Configure `next.config.ts` with no secret values and enable React strict mode.

- [ ] **Step 3: Add minimal app shell files**

Create a root layout and landing page that render static PAK Marketing Automation branding only; no auth assumptions yet.

- [ ] **Step 4: Install dependencies and verify bootstrap**

Run:

```bash
npm install
npm run typecheck
npm run lint
npm run build
```

Expected: all commands exit 0.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json tsconfig.json next.config.ts postcss.config.mjs eslint.config.mjs vitest.config.ts playwright.config.ts .gitignore .env.example src/app
git commit -m "feat: bootstrap PAK platform foundation"
```

---

### Task 2: Environment Boundary and Supabase Client Factories

**Files:**
- Create: `src/lib/env/schema.ts`
- Create: `src/lib/env/server.ts`
- Create: `src/lib/env/public.ts`
- Create: `src/lib/env/schema.test.ts`
- Create: `src/lib/supabase/browser.ts`
- Create: `src/lib/supabase/server.ts`
- Modify: `.env.example`

**Interfaces:**
- Consumes: Zod, `@supabase/ssr`, environment variables.
- Produces: `parsePublicEnv(input)`, `parseServerEnv(input)`, `getPublicEnv()`, `getServerEnv()`, `createBrowserSupabaseClient()`, `createServerSupabaseClient()`.

- [ ] **Step 1: Write failing environment-schema tests**

Tests must verify:

```ts
expect(() => parsePublicEnv({})).toThrow();
expect(() => parseServerEnv({ NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co", NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon" })).toThrow();
expect(parsePublicEnv(validPublic)).toEqual(validPublic);
```

`parseServerEnv` must require `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`, and `LTX_WORKER_SHARED_SECRET` while `parsePublicEnv` must never expose them.

- [ ] **Step 2: Run the targeted tests and verify failure**

```bash
npm run test:run -- src/lib/env/schema.test.ts
```

Expected: FAIL because parsers do not exist.

- [ ] **Step 3: Implement environment schemas and accessors**

Define exact public keys:

```ts
type PublicEnv = {
  NEXT_PUBLIC_SUPABASE_URL: string;
  NEXT_PUBLIC_SUPABASE_ANON_KEY: string;
};
```

Define exact server-only additions:

```ts
type ServerEnv = PublicEnv & {
  SUPABASE_SERVICE_ROLE_KEY: string;
  OPENAI_API_KEY: string;
  LTX_WORKER_SHARED_SECRET: string;
};
```

- [ ] **Step 4: Implement browser/server Supabase factories**

`browser.ts` may consume public environment only. `server.ts` must be marked `import "server-only"` and create a cookie-aware server client without exporting service-role credentials.

- [ ] **Step 5: Run tests/typecheck**

```bash
npm run test:run -- src/lib/env/schema.test.ts
npm run typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/env src/lib/supabase .env.example
git commit -m "feat: enforce server and public environment boundaries"
```

---

### Task 3: Define RBAC and Pure Authorization Rules

**Files:**
- Create: `src/modules/auth/roles.ts`
- Create: `src/modules/auth/authorization.ts`
- Create: `src/modules/auth/authorization.test.ts`

**Interfaces:**
- Consumes: canonical roles and permission names.
- Produces: `AppRole`, `Permission`, `ROLE_PERMISSIONS`, `can(role, permission): boolean`.

- [ ] **Step 1: Write failing authorization tests**

Use canonical roles:

```ts
type AppRole = "OWNER" | "ADMIN" | "EDITOR" | "REVIEWER" | "ANALYST";
```

Use initial permissions:

```ts
type Permission =
  | "settings:manage"
  | "members:manage"
  | "content:create"
  | "content:edit"
  | "content:approve"
  | "publishing:manage"
  | "analytics:view";
```

Tests must assert OWNER has every permission, REVIEWER can approve but cannot manage settings, and ANALYST can view analytics but cannot create content.

- [ ] **Step 2: Verify tests fail**

```bash
npm run test:run -- src/modules/auth/authorization.test.ts
```

- [ ] **Step 3: Implement the minimal permission matrix**

`can()` must be a pure deterministic function and default to deny for any unsupported role/permission pair.

- [ ] **Step 4: Verify tests pass**

```bash
npm run test:run -- src/modules/auth/authorization.test.ts
npm run typecheck
```

- [ ] **Step 5: Commit**

```bash
git add src/modules/auth
git commit -m "feat: add PAK RBAC permission primitives"
```

---

### Task 4: Add Organization and Membership Schema with Strict RLS

**Files:**
- Create: `supabase/migrations/202609090001_foundation_extensions.sql`
- Create: `supabase/migrations/202609090002_organizations_memberships.sql`
- Create: `src/modules/organizations/types.ts`
- Create: `src/modules/organizations/service.ts`
- Create: `tests/rls/foundation-rls.sql`

**Interfaces:**
- Consumes: Supabase `auth.uid()`.
- Produces: `organizations`, `organization_memberships`, helper functions `is_org_member(uuid)`, `has_org_role(uuid,text[])`, and RLS policies that deny cross-org access.

- [ ] **Step 1: Write the SQL RLS assertions first**

`tests/rls/foundation-rls.sql` must encode these expectations:

```sql
-- authenticated user A can select own membership and own organization
-- authenticated user A cannot select organization B without membership
-- ADMIN/OWNER can read organization memberships within their org
-- ordinary member cannot insert arbitrary membership records
```

The test file should use transaction-scoped `set local role authenticated;` and request JWT claim simulation appropriate to Supabase local testing.

- [ ] **Step 2: Create the organization schema migration**

Required tables:

```sql
organizations(
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
)
```

```sql
organization_memberships(
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('OWNER','ADMIN','EDITOR','REVIEWER','ANALYST')),
  created_at timestamptz not null default now(),
  unique (organization_id, user_id)
)
```

Enable RLS on both tables. Use SECURITY DEFINER helper functions with an explicit safe `search_path` and no dynamic SQL.

- [ ] **Step 3: Add TypeScript organization types/service boundary**

Define:

```ts
export type OrganizationMembership = {
  organizationId: string;
  userId: string;
  role: AppRole;
};
```

`service.ts` must be server-only and provide `requireMembership(organizationId: string)` returning the current authenticated membership or throwing a normalized authorization error.

- [ ] **Step 4: Validate SQL and TypeScript**

Run local Supabase migration reset when Supabase CLI is available:

```bash
supabase db reset
psql "$LOCAL_DB_URL" -f tests/rls/foundation-rls.sql
npm run typecheck
```

Expected: SQL assertions pass and TypeScript exits 0. If the runtime lacks Supabase CLI, CI must still retain the SQL test file and this limitation must be documented in verification output rather than silently skipped.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/202609090001_foundation_extensions.sql supabase/migrations/202609090002_organizations_memberships.sql src/modules/organizations tests/rls/foundation-rls.sql
git commit -m "feat: add tenant organizations and strict membership RLS"
```

---

### Task 5: Implement Durable Job State Machine and Persistence Contract

**Files:**
- Create: `src/modules/jobs/types.ts`
- Create: `src/modules/jobs/state-machine.ts`
- Create: `src/modules/jobs/state-machine.test.ts`
- Create: `src/modules/jobs/repository.ts`
- Create: `src/modules/jobs/claim.ts`
- Create: `supabase/migrations/202609090003_jobs.sql`
- Modify: `tests/rls/foundation-rls.sql`

**Interfaces:**
- Consumes: organization ID, actor/worker identity.
- Produces: `JobState`, `canTransition(from,to)`, `assertJobTransition(from,to)`, `JobRepository`, and database RPC `claim_next_job(worker_id text, lease_seconds integer)`.

- [ ] **Step 1: Write failing job transition tests**

Canonical state type:

```ts
export type JobState =
  | "QUEUED"
  | "PROCESSING"
  | "COMPLETED"
  | "FAILED"
  | "RETRYING"
  | "CANCELLED";
```

Required allowed transitions:

```text
QUEUED -> PROCESSING | CANCELLED
PROCESSING -> COMPLETED | FAILED | RETRYING | CANCELLED
RETRYING -> QUEUED | PROCESSING | FAILED | CANCELLED
FAILED -> RETRYING | CANCELLED
COMPLETED -> none
CANCELLED -> none
```

Tests must reject `QUEUED -> COMPLETED`, `COMPLETED -> PROCESSING`, and `CANCELLED -> QUEUED`.

- [ ] **Step 2: Run tests and verify failure**

```bash
npm run test:run -- src/modules/jobs/state-machine.test.ts
```

- [ ] **Step 3: Implement state-machine code**

`assertJobTransition` must throw `AppError` with code `INVALID_JOB_TRANSITION` for illegal transitions.

- [ ] **Step 4: Add jobs migration**

Required fields:

```sql
jobs(
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  job_type text not null,
  resource_type text,
  resource_id uuid,
  state text not null,
  attempt_count integer not null default 0,
  max_attempts integer not null default 3,
  input_payload jsonb not null default '{}'::jsonb,
  result_payload jsonb,
  error_payload jsonb,
  idempotency_key text,
  parent_job_id uuid references jobs(id) on delete set null,
  leased_by text,
  lease_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz
)
```

Add a partial unique index on `(organization_id, idempotency_key)` when `idempotency_key is not null`.

`claim_next_job` must use `FOR UPDATE SKIP LOCKED`, select only claimable `QUEUED`/eligible retry work, atomically mark it `PROCESSING`, set lease metadata, and increment `attempt_count`.

Enable RLS so tenant users can read jobs for their organizations but cannot directly bypass controlled server-side mutation rules.

- [ ] **Step 5: Define TypeScript repository boundary**

```ts
export interface JobRepository {
  enqueue(input: EnqueueJobInput): Promise<JobRecord>;
  getById(id: string): Promise<JobRecord | null>;
  transition(id: string, next: JobState, patch?: JobTransitionPatch): Promise<JobRecord>;
}
```

`claim.ts` defines a server-only `claimNextJob(workerId: string, leaseSeconds: number)` boundary and validates `leaseSeconds` in the range 15–3600.

- [ ] **Step 6: Run tests/SQL verification**

```bash
npm run test:run -- src/modules/jobs/state-machine.test.ts
npm run typecheck
```

Plus Supabase reset/RLS SQL assertions where CLI is available.

- [ ] **Step 7: Commit**

```bash
git add src/modules/jobs supabase/migrations/202609090003_jobs.sql tests/rls/foundation-rls.sql
git commit -m "feat: add durable Postgres job orchestration primitives"
```

---

### Task 6: Add Structured Error and Logging Conventions

**Files:**
- Create: `src/lib/errors/app-error.ts`
- Create: `src/lib/errors/app-error.test.ts`
- Create: `src/lib/logging/logger.ts`
- Create: `src/lib/logging/logger.test.ts`

**Interfaces:**
- Consumes: arbitrary error metadata.
- Produces: `AppError`, `toAppError(error)`, `redactLogContext(context)`, `logger.info/error/warn`.

- [ ] **Step 1: Write failing redaction/error tests**

Tests must verify keys matching `/secret|token|authorization|api[_-]?key|service[_-]?role/i` are replaced with `[REDACTED]`, nested objects are redacted recursively, and `toAppError(new Error("x"))` returns a stable internal error code without exposing stack data in serialized public metadata.

- [ ] **Step 2: Run targeted tests and verify failure**

```bash
npm run test:run -- src/lib/errors/app-error.test.ts src/lib/logging/logger.test.ts
```

- [ ] **Step 3: Implement normalized errors and structured logger**

`AppError` fields:

```ts
code: string;
message: string;
status: number;
retryable: boolean;
details?: Record<string, unknown>;
```

Logger output should be JSON-serializable and accept a correlation ID without binding to an external logging vendor.

- [ ] **Step 4: Verify**

```bash
npm run test:run -- src/lib/errors/app-error.test.ts src/lib/logging/logger.test.ts
npm run typecheck
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/errors src/lib/logging
git commit -m "feat: add structured errors and secret-safe logging"
```

---

### Task 7: Define Provider-Neutral Video Generation Contract

**Files:**
- Create: `src/modules/video/providers/types.ts`
- Create: `src/modules/video/providers/provider.ts`
- Create: `src/modules/video/providers/fake-provider.ts`
- Create: `src/modules/video/providers/fake-provider.test.ts`

**Interfaces:**
- Consumes: normalized generation requests.
- Produces: `VideoGenerationProvider` and deterministic `FakeVideoGenerationProvider` used by tests and future orchestration.

- [ ] **Step 1: Write provider contract tests**

Required request/result contracts:

```ts
export type VideoGenerationRequest = {
  organizationId: string;
  sceneId: string;
  prompt: string;
  durationSeconds: number;
  aspectRatio: "16:9" | "9:16" | "1:1";
  continuity: ContinuityMetadata;
};

export type ProviderSubmission = {
  providerJobId: string;
  status: "SUBMITTED" | "PROCESSING";
};

export type ProviderStatus =
  | { status: "SUBMITTED" | "PROCESSING" }
  | { status: "COMPLETED"; outputUrl: string }
  | { status: "FAILED"; error: ProviderError };
```

Tests must verify submit, status retrieval, result normalization, cancellation behavior, and that provider errors are expressed as normalized `ProviderError` rather than raw vendor exceptions.

- [ ] **Step 2: Run tests and verify failure**

```bash
npm run test:run -- src/modules/video/providers/fake-provider.test.ts
```

- [ ] **Step 3: Implement interface and fake provider**

```ts
export interface VideoGenerationProvider {
  readonly name: string;
  validateConfiguration(): Promise<void>;
  submit(request: VideoGenerationRequest): Promise<ProviderSubmission>;
  getStatus(providerJobId: string): Promise<ProviderStatus>;
  cancel(providerJobId: string): Promise<void>;
}
```

The fake provider must be deterministic and in-memory for tests only; production orchestration must not import it outside test/development wiring.

- [ ] **Step 4: Verify**

```bash
npm run test:run -- src/modules/video/providers/fake-provider.test.ts
npm run typecheck
```

- [ ] **Step 5: Commit**

```bash
git add src/modules/video/providers
git commit -m "feat: add provider-neutral video generation contract"
```

---

### Task 8: Add Scene, Continuity, and Final-Render Readiness Model

**Files:**
- Create: `src/modules/video/scenes/types.ts`
- Create: `src/modules/video/scenes/readiness.ts`
- Create: `src/modules/video/scenes/readiness.test.ts`
- Create: `supabase/migrations/202609090005_video_scenes.sql`
- Modify: `tests/rls/foundation-rls.sql`

**Interfaces:**
- Consumes: persisted scene states.
- Produces: `ContinuityMetadata`, `SceneGenerationState`, `isFinalRenderReady(scenes)`.

- [ ] **Step 1: Write failing readiness tests**

Define generation states:

```ts
export type SceneGenerationState =
  | "PENDING"
  | "QUEUED"
  | "GENERATING"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED";
```

`isFinalRenderReady` must return true only when there is at least one required scene and every required scene is `COMPLETED`. Optional failed/cancelled scenes must not block rendering; required failed/cancelled scenes must block.

- [ ] **Step 2: Verify failure**

```bash
npm run test:run -- src/modules/video/scenes/readiness.test.ts
```

- [ ] **Step 3: Implement scene/continuity types**

`ContinuityMetadata` fields:

```ts
characterIdentity?: string[];
wardrobe?: string[];
locationIdentity?: string[];
palette?: string[];
lighting?: string;
cameraLanguage?: string;
temporalSetting?: string;
objectContinuity?: string[];
precedingSceneContext?: string;
transitionType?: string;
```

- [ ] **Step 4: Add scene persistence migration**

Create `content_items` minimal parent table and `video_scenes` with organization ownership, `content_item_id`, sequence, required flag, script, visual prompt, target duration, aspect ratio, continuity JSONB, provider/model/config, generation state, retry count, provider output reference, QA state, failure metadata, timestamps.

Enable strict organization RLS. Add uniqueness on `(content_item_id, sequence_number)`.

- [ ] **Step 5: Verify tests and SQL**

```bash
npm run test:run -- src/modules/video/scenes/readiness.test.ts
npm run typecheck
```

Plus local Supabase reset/RLS tests where available.

- [ ] **Step 6: Commit**

```bash
git add src/modules/video/scenes supabase/migrations/202609090005_video_scenes.sql tests/rls/foundation-rls.sql
git commit -m "feat: add persistent scene and continuity foundation"
```

---

### Task 9: Add Tenant-Safe Media Domain and Storage Paths

**Files:**
- Create: `src/modules/media/types.ts`
- Create: `src/modules/media/storage-path.ts`
- Create: `src/modules/media/storage-path.test.ts`
- Create: `supabase/migrations/202609090004_media.sql`
- Modify: `tests/rls/foundation-rls.sql`

**Interfaces:**
- Consumes: organization ID, asset ID, original filename.
- Produces: `buildMediaStoragePath({ organizationId, assetId, filename })` and media metadata table/RLS.

- [ ] **Step 1: Write failing path tests**

Required behavior:

```ts
buildMediaStoragePath({
  organizationId: "11111111-1111-1111-1111-111111111111",
  assetId: "22222222-2222-2222-2222-222222222222",
  filename: "Campus Intro FINAL.mp4"
})
```

must return:

```text
org/11111111-1111-1111-1111-111111111111/media/22222222-2222-2222-2222-222222222222/campus-intro-final.mp4
```

Reject path traversal segments, empty filenames, and unsupported control characters.

- [ ] **Step 2: Verify failure**

```bash
npm run test:run -- src/modules/media/storage-path.test.ts
```

- [ ] **Step 3: Implement path builder and media types**

Define media origin enum values `UPLOAD`, `GENERATED`, `IMPORTED` and media status values `PENDING`, `READY`, `FAILED`, `ARCHIVED`.

- [ ] **Step 4: Add media migration**

`media_assets` must include organization ID, asset type, storage bucket/path, origin, MIME type, optional dimensions/duration, checksum, generating job ID, scene ID, status, timestamps. Add unique `(storage_bucket, storage_path)` and strict RLS.

- [ ] **Step 5: Verify**

```bash
npm run test:run -- src/modules/media/storage-path.test.ts
npm run typecheck
```

Plus local SQL assertions when available.

- [ ] **Step 6: Commit**

```bash
git add src/modules/media supabase/migrations/202609090004_media.sql tests/rls/foundation-rls.sql
git commit -m "feat: add tenant-safe media storage foundation"
```

---

### Task 10: Build the Approved Module Navigation Shell

**Files:**
- Create: `src/components/app-shell/navigation.ts`
- Create: `src/components/app-shell/navigation.test.ts`
- Create: `src/components/app-shell/app-shell.tsx`
- Modify: `src/app/layout.tsx`
- Create: fourteen route page files listed in the File Map.

**Interfaces:**
- Consumes: approved module registry.
- Produces: `APP_NAVIGATION`, `AppShell`, and routable module placeholders without business logic.

- [ ] **Step 1: Write failing navigation registry test**

Test that `APP_NAVIGATION` contains exactly these unique module IDs:

```ts
[
  "dashboard",
  "content-studio",
  "ai-representative",
  "campus-locations",
  "podcast",
  "manual-generation",
  "student-testimonials",
  "media-library",
  "knowledge-base",
  "content-calendar",
  "approval-center",
  "publishing",
  "analytics",
  "settings"
]
```

Each registry entry must have `id`, `label`, `href`.

- [ ] **Step 2: Run test and verify failure**

```bash
npm run test:run -- src/components/app-shell/navigation.test.ts
```

- [ ] **Step 3: Implement registry and shell**

The shell must render semantic navigation and a content area. Keep styling restrained and functional; this task is not the final design system.

- [ ] **Step 4: Add route placeholders**

Each route renders its module title and a concise `Foundation shell` status marker. Do not implement fake dashboards or fabricated data.

- [ ] **Step 5: Verify**

```bash
npm run test:run -- src/components/app-shell/navigation.test.ts
npm run typecheck
npm run build
```

- [ ] **Step 6: Commit**

```bash
git add src/components/app-shell src/app
git commit -m "feat: add approved PAK module application shell"
```

---

### Task 11: Add E2E Smoke Coverage for Navigation

**Files:**
- Create: `tests/e2e/navigation.spec.ts`
- Modify: `playwright.config.ts`

**Interfaces:**
- Consumes: running Next.js app and module shell.
- Produces: E2E verification that core routes render and navigation is usable.

- [ ] **Step 1: Write the E2E test**

Test must open `/dashboard`, assert `Dashboard`, navigate to `/content-studio`, assert `Content Studio`, then navigate to `/settings`, assert `Settings`.

- [ ] **Step 2: Run E2E and observe any failures**

```bash
npx playwright install --with-deps chromium
npm run test:e2e
```

- [ ] **Step 3: Fix only foundation-shell defects exposed by the test**

Do not expand scope into business module implementation.

- [ ] **Step 4: Re-run E2E**

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add tests/e2e/navigation.spec.ts playwright.config.ts
git commit -m "test: add PAK foundation navigation E2E smoke coverage"
```

---

### Task 12: Add CI Quality Gates

**Files:**
- Create: `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: package scripts and tests from prior tasks.
- Produces: pull-request CI gates for install, lint, typecheck, unit tests, build, and Playwright smoke test.

- [ ] **Step 1: Create CI workflow**

Workflow triggers:

```yaml
on:
  pull_request:
  push:
    branches:
      - feat/platform-foundation
```

Use Node 22, `npm ci`, then:

```bash
npm run lint
npm run typecheck
npm run test:run
npm run build
npx playwright install --with-deps chromium
npm run test:e2e
```

The workflow must not contain any real PAK secrets. Foundation tests must rely on mocks/local-safe configuration unless a later integration workflow explicitly supplies protected secrets.

- [ ] **Step 2: Validate YAML and local scripts**

Run all locally executable quality commands and verify exit 0.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: add PAK platform foundation quality gates"
```

---

### Task 13: Foundation Verification and Release Review

**Files:**
- Modify only files required to fix verified defects found in this task.

**Interfaces:**
- Consumes: complete foundation branch.
- Produces: verified branch ready for PR review; no merge to `main` without completion gate.

- [ ] **Step 1: Run complete static/unit/build suite**

```bash
npm ci
npm run lint
npm run typecheck
npm run test:run
npm run build
```

Expected: all exit 0.

- [ ] **Step 2: Run applicable E2E suite**

```bash
npm run test:e2e
```

Expected: all tests pass.

- [ ] **Step 3: Verify migrations/RLS where local Supabase tooling is available**

```bash
supabase db reset
psql "$LOCAL_DB_URL" -f tests/rls/foundation-rls.sql
```

Expected: cross-org access assertions fail closed and allowed same-org assertions pass.

- [ ] **Step 4: Perform architecture regression review**

Explicitly verify:

```text
[ ] no Aurexis/Lovable references or credentials
[ ] no browser access to service-role/OpenAI/LTX worker secrets
[ ] all tenant-owned migration tables are RLS-enabled
[ ] job transitions match the approved canonical states
[ ] job claim uses concurrency-safe locking semantics
[ ] video provider is abstracted
[ ] required-scene readiness gates final rendering
[ ] module shell contains all 14 approved modules
[ ] no production-complete fake module behavior was introduced
```

- [ ] **Step 5: Review branch diff against main**

```bash
git diff --check main...feat/platform-foundation
git diff --stat main...feat/platform-foundation
git log --oneline main..feat/platform-foundation
```

Expected: no whitespace errors and only foundation-scope changes.

- [ ] **Step 6: Create pull request, but do not merge automatically**

PR title:

```text
feat: establish PAK marketing automation platform foundation
```

PR body must summarize architecture, migrations/RLS, jobs, provider contract, tests, verification evidence, and any tooling limitation encountered.

---

## Plan Self-Review

### Spec coverage

- Project separation: Tasks 1–13 global constraint and release review.
- Next.js/TypeScript/Tailwind: Task 1.
- Supabase Auth/Postgres/Storage boundaries: Tasks 2, 4, 9.
- Strict RLS/RBAC/org isolation: Tasks 3–5, 8–9, 13.
- Persistent job orchestration: Task 5.
- OpenAI/LTX secrets and provider abstraction: Tasks 2, 7.
- External GPU worker boundary: represented through server-only worker claim/provider contracts in Tasks 5 and 7; no unrestricted DB client is introduced.
- Scene continuity/retry/final render gating: Task 8.
- Media foundation: Task 9.
- Approved product modules: Task 10.
- Observability/error redaction: Task 6.
- Testing/E2E/CI: Tasks 1–13.
- Branch-first/release governance: global constraints and Task 13.

### Placeholder scan

No implementation step uses `TBD`, `TODO`, `implement later`, or unspecified "appropriate" behavior. Where a runtime dependency such as Supabase CLI may be unavailable, the plan requires explicit reporting rather than silent omission.

### Type consistency

Canonical roles, job states, provider request/status contracts, continuity metadata, and navigation IDs are defined once and reused consistently across dependent tasks.
