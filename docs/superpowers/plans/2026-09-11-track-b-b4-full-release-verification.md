# Track B B4 — Full Route Verification and Release Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close Track B by proving all fourteen primary routes are truthful, connected, responsive, auth-protected, regression-safe, and ready for final production release without implementing any future roadmap domain.

**Architecture:** B4 is verification-first. It adds only the minimum test-harness hardening needed to prove the unauthenticated redirect separately from the existing CI-only authenticated-shell bypass, then adds cross-route desktop/mobile E2E coverage and final readiness evidence. No new application domain, database schema, provider integration, or production auth bypass is introduced.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Supabase Auth boundary, Vitest, Testing Library, Playwright Chromium, GitHub Actions, Vercel.

**Spec:** `docs/superpowers/specs/2026-09-10-track-b-production-readiness-design.md`

## Global Constraints

- Preserve the fixed fourteen-module navigation order.
- Do not implement Scene Planning, video providers, Approval backend, Meta publishing, analytics sync, podcast generation, AI Representative generation, testimonial consent storage, campus/location storage, or Manual Generation backend logic.
- Do not add fake/sample operational data or fake primary CTAs.
- Preserve all Track A/B2 RLS, RBAC, Vault, OpenAI, provenance, quota, and service-role trust boundaries.
- The browser must never receive a privileged Supabase client or plaintext integration secret.
- No Supabase migration is expected in B4.
- No Lovable changes or Lovable-attached Supabase access.
- All B4 behavior changes follow RED → GREEN TDD.
- Exact PR head must pass typecheck, lint with no new errors, Vitest, production build, and Playwright before merge.
- Final Track B release must be verified on the deployed commit; production route smoke is required after final production integration.

---

### Task 1: Prove the unauthenticated redirect without weakening production auth

**Files:**
- Create: `src/modules/auth/e2e-bypass.ts`
- Create: `src/modules/auth/e2e-bypass.test.ts`
- Create: `tests/e2e/auth-boundary.spec.ts`
- Modify: `src/app/(app)/layout.tsx`
- Modify: `playwright.config.ts`

**Interfaces:**
- Produces:
  ```ts
  export const E2E_AUTH_BYPASS_HEADER = "x-pak-e2e-auth-bypass";
  export function canBypassAuthForE2E(input: {
    nodeEnv: string | undefined;
    bypassEnabled: string | undefined;
    headerValue: string | null;
  }): boolean;
  ```
- `canBypassAuthForE2E` returns `true` only when `nodeEnv !== "production"`, `bypassEnabled === "true"`, and the request header value is exactly `"allow"`.
- `ApplicationLayout` remains the production auth enforcement point and calls `supabase.auth.getUser()` whenever the helper returns `false`.

- [ ] **Step 1: Write the failing auth-boundary tests**

Add unit cases proving production can never bypass, missing/wrong header cannot bypass, and development E2E with the exact header can bypass. Add `tests/e2e/auth-boundary.spec.ts` asserting `/dashboard` redirects to `/login` when the browser does not send the bypass header.

- [ ] **Step 2: Verify RED**

Open a draft PR against `track-b/production-readiness` so GitHub Actions runs the existing Playwright configuration. Expected failure: the new unauthenticated browser test stays on `/dashboard` because the current server-wide `E2E_AUTH_BYPASS` bypass does not distinguish requests.

- [ ] **Step 3: Implement the minimal hardened bypass**

Create `e2e-bypass.ts`; in `ApplicationLayout`, read the request header with `headers()` and bypass only through `canBypassAuthForE2E`. Update Playwright to run normal B4 tests in a project that sends `x-pak-e2e-auth-bypass: allow`, while a dedicated unauthenticated project runs only `auth-boundary.spec.ts` without that header. Both projects use the same non-production dev server.

- [ ] **Step 4: Verify GREEN**

Run the exact PR CI. Expected: helper unit tests pass, `/dashboard` redirects to `/login` in the unauth project, existing shell tests remain authorized through the request-scoped test header, and production build remains unaffected.

- [ ] **Step 5: Commit**

Commit message: `test: prove Track B authentication boundary`

---

### Task 2: Add cross-route desktop release verification

**Files:**
- Create: `tests/e2e/track-b-release.spec.ts`

**Interfaces:**
- Consumes the existing `APP_NAVIGATION` behavior through rendered navigation rather than importing internal implementation into Playwright.
- Produces browser evidence that all fourteen destinations can be traversed through real navigation controls, each destination has the expected heading, URL, and `aria-current="page"` state.

- [ ] **Step 1: Write the cross-route desktop test**

Start at `/dashboard`. For every primary navigation destination in the fixed order, click the rendered navigation link instead of calling `page.goto()` for the destination, assert the final pathname, assert the module heading, and assert only that destination carries `aria-current="page"`.

- [ ] **Step 2: Verify RED if a workflow continuity defect exists**

Run the test on the PR head. If it fails, record the exact route/link defect and fix only that defect. If it is already GREEN, retain the test as release-proof coverage; B4 does not manufacture a product change merely to force a RED application defect.

- [ ] **Step 3: Verify future-route truthfulness during traversal**

For `/media-library` and `/manual-generation`, assert `Foundation only`. For one representative planned route such as `/analytics`, assert `Planned`, `Current availability`, and zero domain mutation buttons inside `main`.

- [ ] **Step 4: Run the full E2E suite**

Expected: all pre-existing B1/B2/B3 browser tests plus the new cross-route traversal pass.

- [ ] **Step 5: Commit**

Commit message: `test: verify Track B desktop route continuity`

---

### Task 3: Add full mobile navigation and responsive release verification

**Files:**
- Modify: `tests/e2e/track-b-release.spec.ts`

**Interfaces:**
- Uses the existing mobile disclosure button labels `Open navigation` / `Close navigation`.
- Produces 390 × 844 evidence for every primary route.

- [ ] **Step 1: Add a 390 × 844 route traversal test**

At viewport 390 × 844, begin on `/dashboard`. For every destination, open the navigation disclosure, click the exact module link, assert the disclosure collapses after navigation, assert the expected heading and URL, and assert `document.documentElement.scrollWidth <= clientWidth`.

- [ ] **Step 2: Verify mobile keyboard/tap semantics already exposed by the shell**

Assert the disclosure has `aria-expanded`, every selected route link becomes `aria-current="page"`, and route changes do not require horizontal scrolling.

- [ ] **Step 3: Run the full E2E suite**

Expected: desktop and mobile cross-route tests pass alongside all existing tests.

- [ ] **Step 4: Commit**

Commit message: `test: verify Track B mobile release routes`

---

### Task 4: Close the Track B readiness matrix without overstating future domains

**Files:**
- Modify: `docs/product/PAK_TRACK_B_READINESS_MATRIX.md`

**Interfaces:**
- The matrix remains the canonical fourteen-route production-readiness audit.
- `ACTIVE` means the currently implemented workflow is usable for its approved scope.
- `RECONCILED` means the route entry surface truthfully represents a future/foundation-only domain; it does not mean that future domain has been implemented.

- [ ] **Step 1: Update the matrix slice to B4**

Set the document slice to `B4 — Full Route Verification and Release`. Preserve all fourteen route classifications and B3's explicit future-domain boundaries.

- [ ] **Step 2: Add B4 verification evidence**

Record the exact pre-documentation implementation head and CI run that proves: authentication boundary, fourteen-route desktop traversal, fourteen-route mobile traversal at 390 × 844, valid active-route semantics, no horizontal dependency, unit tests, lint, typecheck, and build.

- [ ] **Step 3: Add final Track B definition-of-done closure**

State that there are no unresolved P0 production-readiness blockers in the fourteen-route matrix while explicitly retaining roadmap work as future work. Do not call Phase 6+ domains implemented.

- [ ] **Step 4: Run exact-head CI again**

The documentation commit changes the PR head, so require a fresh complete GitHub Actions result before review or merge.

- [ ] **Step 5: Commit**

Commit message: `docs: close Track B release readiness matrix`

---

### Task 5: Review and integrate B4 into Track B

**Files:**
- No new product files unless review discovers a defect.

**Interfaces:**
- Base: `track-b/production-readiness`
- Head: `track-b/b4-full-release-verification`

- [ ] **Step 1: Verify exact-head CI**

Require success for typecheck, lint, full Vitest, production build, and all Playwright projects on the exact B4 PR head.

- [ ] **Step 2: Perform pre-merge review**

Review the PR patch against the B4 plan and Track B design. Any Critical or Important issue must be fixed and re-verified before integration. Confirm no Supabase migration, service-role exposure, provider-secret exposure, fake operational data, future-domain backend implementation, navigation reorder, or Lovable change entered B4.

- [ ] **Step 3: Merge with expected-head guard after user integration choice**

Use the exact verified head SHA when merging into `track-b/production-readiness`.

- [ ] **Step 4: Verify the merged Track B branch**

Confirm the base branch points to the B4 merge commit and the merged tree matches the verified PR merge context or otherwise receives a fresh verification run.

---

### Task 6: Final Track B production release verification

**Files:**
- No application changes unless deployment/runtime verification finds a real blocker.

**Interfaces:**
- Release candidate: `track-b/production-readiness` after B4 integration.
- Production target: repository production branch / Vercel production project.

- [ ] **Step 1: Prepare the final Track B integration into the production branch**

Compare `track-b/production-readiness` against the current production branch and confirm no unexpected files or unresolved conflicts. Use the project's normal PR path; do not force-push.

- [ ] **Step 2: Require exact-green final integration checks**

The final production integration PR must pass the same typecheck, lint, Vitest, build, and Playwright gates on its exact merge context.

- [ ] **Step 3: Merge only after the user's final integration choice**

Use expected-head protection. Do not infer permission to discard branches or bypass the normal integration decision.

- [ ] **Step 4: Verify Vercel production deployment**

Find the deployment for the exact final production merge commit, require `READY`, and verify the production alias points to that deployment.

- [ ] **Step 5: Run live production smoke**

Verify `/` and representative protected routes have the expected unauthenticated login boundary. Where an authenticated session is actually available, verify the implemented Dashboard, Content Studio, Knowledge Base, Settings, and representative future readiness pages without synthesizing production data. If no authenticated browser session is available, state that limitation explicitly and rely only on authenticated CI coverage for that portion.

- [ ] **Step 6: Check runtime health**

Confirm no new Vercel runtime errors attributable to the release. Supabase live probes are required only if B4 changed an authorization/data boundary beyond the non-production E2E harness; otherwise no Supabase mutation is performed.

- [ ] **Step 7: Close Track B**

Track B may be declared complete only after the exact production deployment and live smoke evidence exist.
