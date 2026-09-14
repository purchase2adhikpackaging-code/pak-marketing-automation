# PAK UI/UX Production Convergence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Converge the PAK operator UI with the capabilities already implemented through Phase 8 plus the Organization Profile / Brand Kit / Knowledge foundation, without inventing Phase 9–17 workflows or weakening existing server authority.

**Architecture:** Keep every existing domain model, RLS/RBAC boundary, provider workflow, revision/CAS rule and private-media boundary intact. The slice is presentation-led: grouped navigation, an authoritative production-command Dashboard, clearer cross-workflow handoffs, stage hierarchy in Scene Planning, and truthful operational/readiness copy. New summary state is loaded server-side from existing repositories/tables and exposed as safe read models; the browser never becomes authoritative.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript 5.9, Supabase SSR/Data API, Vitest + Testing Library, Playwright, Tailwind CSS.

**Spec:** `docs/superpowers/specs/2026-09-14-pak-ui-ux-production-convergence-design.md`

## Global Constraints

- Work on `uiux/production-convergence`, which depends on PR #40 / `foundation/org-profile-brand-knowledge` at `3d0c2182f84542ed5d82d1ed5f195e19718092e6`.
- Do not touch Lovable.
- Do not merge PR #40 or this slice without explicit authorization.
- Do not implement Approval Center, Publishing, Content Calendar, Analytics, AI Representative, Podcast, Campus / Locations, Student Testimonials or dedicated Manual Generation behavior.
- Preserve existing RLS/RBAC, organization isolation, private-storage boundaries, revision/CAS semantics, immutable provenance and Integration Vault behavior.
- Browser inputs may carry identifiers/navigation context only; Profile, Brand Kit, Knowledge, lifecycle, media and provider truth remains server-resolved.
- Do not persist signed URLs or raw storage paths as business identity.
- Do not create synthetic Dashboard metrics or a numeric health score.
- Media Library is operational and must not be labelled `Foundation only`.
- Roadmap routes remain truthful readiness pages with `Planned` / `Foundation only` semantics.
- Core Knowledge remains automatic generation context; the 20-source selection cap applies only to selected non-Core ACTIVE Knowledge.
- Scene Planning Brand Kit defaults remain institutional identity; Visual Bible remains project creative direction and cannot replace the official logo.
- Every changed operational surface must preserve or improve empty, pending, error, success, role-aware and mobile behavior.
- Use TDD: RED test commit or clearly observed RED before the corresponding GREEN implementation.
- Run focused tests after each task; final verification is `npm run typecheck`, `npm run lint`, `npm run test:run`, `npm run build`, relevant worker verification already present in CI, and `npm run test:e2e`.

---

## File Structure / Responsibility Map

### Shell and readiness
- `src/components/app-shell/navigation.ts` — grouped navigation data contract.
- `src/components/app-shell/app-navigation.tsx` — grouped desktop/mobile rendering.
- `src/components/app-shell/navigation.test.ts` — grouping/order/active-route unit coverage.
- `src/components/app-shell/app-navigation.test.tsx` — group labels, mobile behavior, active state.
- `src/components/app-shell/module-readiness.ts` — Phase 9–17 truthful readiness registry only.
- `src/components/app-shell/module-readiness-page.tsx` — readiness rendering, unchanged semantically.
- `src/components/app-shell/b3-route-readiness.test.ts` and `module-readiness-page.test.tsx` — roadmap semantics.

### Dashboard
- `src/modules/dashboard/service.ts` — server-only aggregate read model and deterministic next-action resolver.
- `src/modules/dashboard/service.test.ts` — pure mapping/priority contract + query behavior seams.
- `src/app/(app)/dashboard/dashboard-summary.tsx` — command-center rendering.
- `src/app/(app)/dashboard/dashboard-summary.test.tsx` — card/status/CTA behavior.
- `src/app/(app)/dashboard/page.tsx` — page copy and aggregate load boundary.

### Content Studio
- `src/app/(app)/content-studio/page.tsx` — load safe Profile/Brand/Core context metadata alongside selectable Knowledge.
- `src/app/(app)/content-studio/content-studio-form.tsx` — read-only authoritative-context panel.
- `src/app/(app)/content-studio/content-studio-form.test.tsx` — automatic-grounding copy and selected-count behavior.
- `src/app/(app)/content-studio/multilingual-content-panel.tsx` — scene-planning handoff CTA wording/state.
- `src/app/(app)/content-studio/multilingual-content-panel.test.tsx` — generated-artifact handoff regression.

### Scene Planning
- `src/app/(app)/scene-planning/scene-planning-workspace.tsx` — four-stage visual hierarchy only; preserve domain actions.
- `src/app/(app)/scene-planning/scene-planning-workspace.test.tsx` — stage headings + existing workflow regression.
- `src/app/(app)/scene-planning/final-render-controls.tsx` — completed final asset → Media Library CTA.
- `src/app/(app)/scene-planning/final-render-controls.test.tsx` — final-asset CTA and readiness state.
- `src/app/(app)/scene-planning/page.tsx` — route-level framing/empty-state copy.

### Media Library
- `src/app/(app)/media-library/page.tsx` — operational framing.
- `src/app/(app)/media-library/media-library-client.tsx` — safe purpose/origin presentation using existing metadata only.
- `src/app/(app)/media-library/media-library-client.test.tsx` — no foundation copy; category/purpose labels only when metadata supports them.

### Knowledge Base
- `src/app/(app)/knowledge-base/knowledge-base-manager.tsx` — explicit manual vs ingestion hierarchy, DRAFT/ACTIVE/Core semantics.
- `src/app/(app)/knowledge-base/knowledge-base-manager.test.tsx` — source-entry and lifecycle UX.
- `src/app/(app)/knowledge-base/knowledge-ingestion-panel.tsx` — retain DRAFT-review message, adjust placement/copy only.
- `src/app/(app)/knowledge-base/knowledge-ingestion-panel.test.tsx` — ingestion success must remain DRAFT-only.

### Settings
- `src/app/(app)/settings/page.tsx` — three administrative domains with safe summaries.
- Reuse `src/modules/organization-profile/repository.ts`, `src/modules/brand-kit/repository.ts`, and `src/modules/integrations/repository.ts`; do not create duplicate identity models.
- Add `src/app/(app)/settings/page.test.tsx` if page-level summary rendering cannot be covered cleanly by existing integration-manager tests.

### E2E / governance
- `tests/e2e/track-b-release.spec.ts` — operational route traversal and removal of stale Media Library expectation.
- `tests/e2e/module-readiness.spec.ts` — Phase 9–17 truthful readiness stays intact.
- Add `tests/e2e/production-convergence.spec.ts` — workflow-first navigation + key production journey assertions.
- `docs/product/PAK_UI_UX_SPEC.md` — update current maturity/navigation/dashboard wording after implementation is proven.
- `docs/product/PAK_DEVELOPMENT_ROADMAP.md` and `docs/product/PAK_TRACEABILITY_MATRIX.md` — record convergence slice only after tests/runtime verification.

---

### Task 1: Group operational, administration and roadmap navigation

**Files:**
- Modify: `src/components/app-shell/navigation.ts`
- Modify: `src/components/app-shell/navigation.test.ts`
- Modify: `src/components/app-shell/app-navigation.tsx`
- Modify: `src/components/app-shell/app-navigation.test.tsx`
- Verify unchanged semantics: `src/components/app-shell/module-readiness.ts`
- Verify: `src/components/app-shell/b3-route-readiness.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type AppNavigationGroup = {
    label: "Operational" | "Administration" | "Roadmap";
    items: readonly AppNavigationItem[];
  };

  export const APP_NAVIGATION_GROUPS: readonly AppNavigationGroup[];
  ```
- Preserve `isNavigationItemActive(pathname, href): boolean`.
- `APP_NAVIGATION` may remain as a flattened derived export only if existing tests/callers still need it; it must be derived from `APP_NAVIGATION_GROUPS`, not maintained separately.

- [ ] **Step 1: Write RED navigation tests**

Add assertions equivalent to:

```ts
expect(APP_NAVIGATION_GROUPS.map((group) => group.label)).toEqual([
  "Operational",
  "Administration",
  "Roadmap",
]);
expect(APP_NAVIGATION_GROUPS[0].items.map((item) => item.href)).toEqual([
  "/dashboard",
  "/content-studio",
  "/scene-planning",
  "/media-library",
  "/knowledge-base",
]);
expect(APP_NAVIGATION_GROUPS[1].items.map((item) => item.href)).toEqual(["/settings"]);
expect(APP_NAVIGATION_GROUPS[2].items.map((item) => item.href)).toEqual([
  "/approval-center",
  "/publishing",
  "/content-calendar",
  "/analytics",
  "/ai-representative",
  "/podcast",
  "/campus-locations",
  "/student-testimonials",
  "/manual-generation",
]);
```

In `app-navigation.test.tsx`, assert the three group headings are rendered, Operational appears before Roadmap, mobile toggle still exposes the nav, and the current route gets `aria-current="page"`.

- [ ] **Step 2: Run focused tests and confirm RED**

Run:
```bash
npm run test:run -- src/components/app-shell/navigation.test.ts src/components/app-shell/app-navigation.test.tsx
```
Expected: FAIL because `APP_NAVIGATION_GROUPS` and grouped headings do not exist.

- [ ] **Step 3: Implement grouped navigation data**

Use:

```ts
export const APP_NAVIGATION_GROUPS = [
  {
    label: "Operational",
    items: [
      { label: "Dashboard", href: "/dashboard" },
      { label: "Content Studio", href: "/content-studio" },
      { label: "Scene Planning", href: "/scene-planning" },
      { label: "Media Library", href: "/media-library" },
      { label: "Knowledge Base", href: "/knowledge-base" },
    ],
  },
  {
    label: "Administration",
    items: [{ label: "Settings", href: "/settings" }],
  },
  {
    label: "Roadmap",
    items: [
      { label: "Approval Center", href: "/approval-center" },
      { label: "Publishing", href: "/publishing" },
      { label: "Content Calendar", href: "/content-calendar" },
      { label: "Analytics", href: "/analytics" },
      { label: "AI Representative", href: "/ai-representative" },
      { label: "Podcast", href: "/podcast" },
      { label: "Campus / Locations", href: "/campus-locations" },
      { label: "Student Testimonials", href: "/student-testimonials" },
      { label: "Manual Generation", href: "/manual-generation" },
    ],
  },
] as const satisfies readonly AppNavigationGroup[];

export const APP_NAVIGATION = APP_NAVIGATION_GROUPS.flatMap((group) => group.items);
```

Render each group with a visible text label on desktop and the same semantic grouping inside the collapsed mobile nav. Do not hide Roadmap routes.

- [ ] **Step 4: Run focused tests and confirm GREEN**

Run the same Vitest command plus:
```bash
npm run test:run -- src/components/app-shell/b3-route-readiness.test.ts src/components/app-shell/module-readiness-page.test.tsx
```
Expected: PASS; readiness semantics unchanged.

- [ ] **Step 5: Commit**

```bash
git add src/components/app-shell
git commit -m "feat: group PAK navigation by workflow maturity"
```

---

### Task 2: Expand the server-only Dashboard read model and next-action resolver

**Files:**
- Modify: `src/modules/dashboard/service.ts`
- Modify: `src/modules/dashboard/service.test.ts`

**Interfaces:**
- Replace/extend `DashboardWorkspace` with:

```ts
export type DashboardNextAction = {
  label: string;
  href: string;
  reason: string;
};

export type DashboardWorkspace = {
  organizationId: string;
  organizationLabel: string;
  role: AppRole;
  identity: {
    profileRevision: number | null;
    brandKitRevision: number | null;
    activeCoreKnowledge: number;
  };
  content: { total: number; generated: number; failed: number };
  knowledge: { total: number; active: number; draft: number; coreActive: number };
  production: {
    projects: number;
    plansNeedingWork: number;
    approvedPlans: number;
    generation: { active: number; failed: number; completed: number };
    assembly: { active: number; failed: number; completed: number };
    latestProjectId?: string;
  };
  media: { active: number; video: number; finalRenders: number };
  integrations: {
    openAI: { status: IntegrationConnectionStatus; lastVerifiedAt?: string };
    ltx: { status: IntegrationConnectionStatus; lastVerifiedAt?: string };
  };
  lastActivityAt?: string;
  nextAction: DashboardNextAction;
};
```

- Produce pure helper:

```ts
export function resolveDashboardNextAction(input: {
  profileRevision: number | null;
  brandKitRevision: number | null;
  knowledgeDrafts: number;
  generatedContent: number;
  projects: number;
  plansNeedingWork: number;
  activeGeneration: number;
  assemblyReadyOrActive: boolean;
  completedAssemblies: number;
}): DashboardNextAction;
```

Priority:
1. missing Profile or Brand Kit → `/settings` / `Complete institutional setup`;
2. DRAFT Knowledge > 0 → `/knowledge-base` / `Review Knowledge drafts`;
3. generated content = 0 → `/content-studio` / `Create content`;
4. projects = 0 → `/content-studio` / `Create a Scene Plan`;
5. plansNeedingWork > 0 → `/scene-planning` / `Continue Scene Planning`;
6. activeGeneration > 0 → `/scene-planning` / `Review generation progress`;
7. assemblyReadyOrActive → `/scene-planning` / `Continue final assembly`;
8. completedAssemblies > 0 → `/media-library` / `Open completed media`;
9. fallback → `/dashboard` or `/content-studio` with a neutral operational shortcut; do not guess a project ID.

- [ ] **Step 1: Write RED pure-helper tests**

Cover every priority branch and verify earlier priorities win. Example:

```ts
expect(resolveDashboardNextAction({
  profileRevision: null,
  brandKitRevision: 2,
  knowledgeDrafts: 4,
  generatedContent: 12,
  projects: 5,
  plansNeedingWork: 2,
  activeGeneration: 1,
  assemblyReadyOrActive: true,
  completedAssemblies: 3,
})).toMatchObject({ href: "/settings", label: "Complete institutional setup" });
```

Also test Profile/Brand revisions are nullable and Core count is independent of selected Knowledge.

- [ ] **Step 2: Run and confirm RED**

```bash
npm run test:run -- src/modules/dashboard/service.test.ts
```
Expected: FAIL because the expanded contract/helper does not exist.

- [ ] **Step 3: Implement safe server-side aggregation**

In `loadDashboardWorkspace()` keep the current authenticated membership lookup and organization scope. Add parallel organization-scoped reads using existing tables/repositories:

- `organization_profiles` → `revision`;
- `organization_brand_kits` → `revision`;
- `knowledge_records` → total / ACTIVE / DRAFT / ACTIVE+`is_core`;
- `video_projects` → total + latest project identifier/activity;
- `scene_plan_versions` → statuses grouped into approved vs needs-work using actual stored status values already used by Scene Planning;
- `video_generation_attempts` → active/failed/completed using actual `state` values;
- `video_assemblies` → active/failed/completed using `state` values (`QUEUED`/`PROCESSING` active, `FAILED` failed, `COMPLETED` completed);
- `media_assets` → ACTIVE count and existing asset/origin metadata only; final-render count must be based on current authoritative asset metadata or `video_assemblies.final_media_asset_id`, not a guessed filename;
- `integration_connections` → OPENAI and LTX safe status + `last_verified_at`.

If a category cannot be distinguished reliably by current media metadata, return the conservative count supported by schema and let Task 6 omit that submetric.

Normalize any query failure to the existing safe Dashboard error; do not expose Supabase internals.

- [ ] **Step 4: Run focused service tests GREEN**

```bash
npm run test:run -- src/modules/dashboard/service.test.ts
npm run typecheck
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/dashboard/service.ts src/modules/dashboard/service.test.ts
git commit -m "feat: add production dashboard read model"
```

---

### Task 3: Render the Production Command Center Dashboard

**Files:**
- Modify: `src/app/(app)/dashboard/dashboard-summary.tsx`
- Modify: `src/app/(app)/dashboard/dashboard-summary.test.tsx`
- Modify: `src/app/(app)/dashboard/page.tsx`

**Interfaces:**
- Consumes the `DashboardWorkspace` from Task 2 unchanged.
- No client-side Supabase queries.

- [ ] **Step 1: Write RED UI tests**

Assert headings/cards for:

```text
Institutional readiness
Content production
Trusted Knowledge
Scene & video production
Media Library
Integrations
Continue production
```

Test states:
- Profile revision displayed as `Revision N` or `Not configured`;
- Brand Kit same;
- Core count shown;
- OpenAI and LTX normalized state shown;
- next-action CTA uses `workspace.nextAction.href`;
- no `health score` text;
- error state remains safe and useful;
- null workspace still yields authenticated-workspace empty state rather than crash.

- [ ] **Step 2: Run and confirm RED**

```bash
npm run test:run -- src/app/'(app)'/dashboard/dashboard-summary.test.tsx
```
Expected: FAIL on missing production sections.

- [ ] **Step 3: Implement command-center layout**

Use semantic sections and links; keep mobile as single-column, use responsive grids only at `md`/`xl`. Put `Continue production` immediately after organization/role context so mobile users see the next action early. Use text labels for all states; color cannot carry meaning alone.

Update page copy from the narrow Content/Knowledge/OpenAI description to:

```text
Monitor institutional readiness and continue the active content-to-video workflow from one operational view.
```

- [ ] **Step 4: Run UI tests and typecheck**

```bash
npm run test:run -- src/app/'(app)'/dashboard/dashboard-summary.test.tsx src/modules/dashboard/service.test.ts
npm run typecheck
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/'(app)'/dashboard
git commit -m "feat: turn dashboard into production command center"
```

---

### Task 4: Make Content Studio show automatic authoritative context and a clearer Scene Planning handoff

**Files:**
- Modify: `src/app/(app)/content-studio/page.tsx`
- Modify: `src/app/(app)/content-studio/content-studio-form.tsx`
- Modify: `src/app/(app)/content-studio/content-studio-form.test.tsx`
- Modify: `src/app/(app)/content-studio/multilingual-content-panel.tsx`
- Modify: `src/app/(app)/content-studio/multilingual-content-panel.test.tsx`
- Reuse: `src/modules/organization-profile/repository.ts`
- Reuse: `src/modules/brand-kit/repository.ts`
- Reuse: `src/modules/knowledge-base/repository.ts`

**Interfaces:**

Extend each Content Studio organization view model with:

```ts
authoritativeContext: {
  profileRevision: number | null;
  brandKitRevision: number | null;
  activeCoreKnowledgeCount: number;
};
```

Do not pass Profile/Brand business fields into the form for editing.

- [ ] **Step 1: Write RED tests**

`content-studio-form.test.tsx` must assert:
- heading `Authoritative context`;
- copy explicitly says Profile, Brand Kit and ACTIVE Core Knowledge are applied automatically;
- `0 of 20 selected` does not imply zero grounding;
- profile/brand revisions are read-only display values.

`multilingual-content-panel.test.tsx` must retain existing `Create Scene Plan` action behavior and assert the successful GENERATED artifact is presented as the next production step. Do not change the server action signature.

- [ ] **Step 2: Run RED**

```bash
npm run test:run -- src/app/'(app)'/content-studio/content-studio-form.test.tsx src/app/'(app)'/content-studio/multilingual-content-panel.test.tsx
```
Expected: FAIL on missing context panel/copy.

- [ ] **Step 3: Load safe context metadata server-side**

For each eligible organization in `page.tsx`:
- load Profile with the existing organization-profile repository;
- load Brand Kit with the existing brand-kit repository;
- count ACTIVE Core Knowledge from organization-scoped repository/data path;
- continue to load only selectable ACTIVE normal Knowledge for the checkbox selector.

The form receives revisions/count only. Generation still uses the existing shared server-side resolver; do not duplicate it in React.

- [ ] **Step 4: Render context panel and handoff copy**

Example copy:

```text
Authoritative context
PAK automatically applies the current Organization Profile, Brand Kit and ACTIVE Core Knowledge to generation. The sources selected below are additional approved Knowledge and do not disable Core grounding.
```

Keep the 20 selected non-Core maximum.

- [ ] **Step 5: Run focused tests GREEN**

```bash
npm run test:run -- src/app/'(app)'/content-studio/content-studio-form.test.tsx src/app/'(app)'/content-studio/knowledge-selector.test.tsx src/app/'(app)'/content-studio/multilingual-content-panel.test.tsx src/app/'(app)'/content-studio/actions-organization-context.test.ts
npm run typecheck
```
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/app/'(app)'/content-studio
git commit -m "feat: expose authoritative generation context in Content Studio"
```

---

### Task 5: Reframe Scene Planning into Source → Quality → Generate → Assemble stages

**Files:**
- Modify: `src/app/(app)/scene-planning/scene-planning-workspace.tsx`
- Modify: `src/app/(app)/scene-planning/scene-planning-workspace.test.tsx`
- Modify: `src/app/(app)/scene-planning/final-render-controls.tsx`
- Modify: `src/app/(app)/scene-planning/final-render-controls.test.tsx`
- Modify: `src/app/(app)/scene-planning/page.tsx`

**Interfaces:**
- Do not change existing Scene Planning server-action signatures.
- Keep `ScenePlanningWorkspaceProps` domain fields intact unless a purely presentational derived field is demonstrably needed.
- `FinalRenderControls` continues to consume `FinalAssemblyReadModel`.

- [ ] **Step 1: Write RED stage-hierarchy tests**

Add assertions for visible stage headings:

```text
1. Source & plan
2. Quality & approval
3. Generate
4. Assemble
```

Existing tests for Production Brief, Visual Bible, QC, approval immutability, edit/replan and role behavior must stay.

In `final-render-controls.test.tsx`, when `view.assembly.state === "COMPLETED"` and `finalMediaAssetId` exists, assert a link/button `Open final asset in Media Library` is rendered. Use a safe route such as `/media-library?asset=<uuid>` only if the existing Media Library supports the query; otherwise link to `/media-library` and display the asset ID in the existing safe detail context. Do not invent unsupported client routing.

- [ ] **Step 2: Run RED**

```bash
npm run test:run -- src/app/'(app)'/scene-planning/scene-planning-workspace.test.tsx src/app/'(app)'/scene-planning/final-render-controls.test.tsx
```
Expected: FAIL on missing stage headings/final Media CTA.

- [ ] **Step 3: Implement presentational hierarchy only**

Wrap/reorder existing visual sections so their actions remain in the same lifecycle:
- Stage 1 contains source freshness, production brief, Brand defaults/Visual Bible and plan version context;
- Stage 2 contains QC findings, warning acknowledgement, review/approval/copy-on-write controls;
- Stage 3 contains per-shot generation specifications and generation controls/status;
- Stage 4 contains `FinalRenderControls`.

Do not move approval logic into a new component that changes mutation semantics. Add explanatory copy distinguishing `Official Brand Kit` from `Project Visual Bible` where institutional defaults are shown.

- [ ] **Step 4: Implement completed-assembly Media handoff**

When a final asset exists, end the flow with a Media Library CTA rather than worker/provider language.

- [ ] **Step 5: Run regression suite GREEN**

```bash
npm run test:run -- src/app/'(app)'/scene-planning/scene-planning-workspace.test.tsx src/app/'(app)'/scene-planning/final-render-controls.test.tsx src/app/'(app)'/scene-planning/actions.test.ts src/app/'(app)'/scene-planning/final-assembly-actions.test.ts
npm run typecheck
```
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/app/'(app)'/scene-planning
git commit -m "feat: converge Scene Planning production stages"
```

---

### Task 6: Present Media Library as a first-class operational surface

**Files:**
- Modify: `src/app/(app)/media-library/page.tsx`
- Modify: `src/app/(app)/media-library/media-library-client.tsx`
- Modify: `src/app/(app)/media-library/media-library-client.test.tsx`
- Modify only if needed for safe metadata display: `src/app/(app)/media-library/media-detail.tsx`

**Interfaces:**
- Reuse existing `MediaOrganizationWorkspace`, repository pagination, upload, preview, archive/delete and detail actions.
- No new asset taxonomy in the database.

- [ ] **Step 1: Write RED operator-framing tests**

Assert:
- no `Foundation only` text anywhere in the operational Media Library surface;
- page description calls it the PAK-owned asset catalogue/output library;
- asset cards/details show existing safe `assetType`, origin/lineage/status fields when present;
- no heuristic category is shown when metadata is absent;
- existing preview/upload/archive/delete tests remain intact.

- [ ] **Step 2: Run RED**

```bash
npm run test:run -- src/app/'(app)'/media-library/media-library-client.test.tsx src/app/'(app)'/media-library/media-upload.test.tsx
```
Expected: at least the new framing assertions fail.

- [ ] **Step 3: Implement safe purpose presentation**

Use existing metadata to display concise tags such as `Uploaded`, `Generated video`, `Final render`, or brand/document linkage only when the authoritative row already contains the needed origin/type/lineage. Do not infer from filenames, MIME alone, or storage path.

- [ ] **Step 4: Run focused tests GREEN**

```bash
npm run test:run -- src/app/'(app)'/media-library/media-library-client.test.tsx src/app/'(app)'/media-library/media-upload.test.tsx src/app/'(app)'/media-library/actions.test.ts
npm run typecheck
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/'(app)'/media-library
git commit -m "feat: promote Media Library as operational output surface"
```

---

### Task 7: Clarify Knowledge Base source entry, lifecycle and Core authority

**Files:**
- Modify: `src/app/(app)/knowledge-base/knowledge-base-manager.tsx`
- Modify: `src/app/(app)/knowledge-base/knowledge-base-manager.test.tsx`
- Modify: `src/app/(app)/knowledge-base/knowledge-ingestion-panel.tsx`
- Modify: `src/app/(app)/knowledge-base/knowledge-ingestion-panel.test.tsx`

**Interfaces:**
- Preserve all existing action signatures and role checks.
- Manual create defaults to `MANUAL` for the primary manual flow.
- Authoritative document/URL ingestion stays in `KnowledgeIngestionPanel` and still produces DRAFT only.

- [ ] **Step 1: Write RED lifecycle/source-entry tests**

Assert:
- two explicit headings/actions: `Add manually` and `Ingest document or URL`;
- manual form does not visually encourage `DOCUMENT`/`URL` as a substitute for ingestion; either constrain primary manual creation to `MANUAL` or place advanced source metadata behind clearly labelled metadata fields without extraction semantics;
- DRAFT and ACTIVE badges are explicit text;
- Core badge includes helper text `Automatically grounded in generation.`;
- OWNER/ADMIN Core controls remain; EDITOR has no Core mutation control; REVIEWER/ANALYST remain read-only;
- ingestion success message contains `Draft created for review` and does not contain `approved`.

- [ ] **Step 2: Run RED**

```bash
npm run test:run -- src/app/'(app)'/knowledge-base/knowledge-base-manager.test.tsx src/app/'(app)'/knowledge-base/knowledge-ingestion-panel.test.tsx src/app/'(app)'/knowledge-base/core-knowledge-manager.test.tsx
```
Expected: new hierarchy/helper-copy assertions fail.

- [ ] **Step 3: Implement hierarchy/copy without changing lifecycle**

Place `KnowledgeIngestionPanel` in its own top-level card before or beside the manual card. Rename manual section heading to `Add manually`. Keep normalized persistent success/error regions. Render `Core Knowledge` plus helper copy only when `record.isCore` is true.

- [ ] **Step 4: Run Knowledge regression GREEN**

```bash
npm run test:run -- src/app/'(app)'/knowledge-base/knowledge-base-manager.test.tsx src/app/'(app)'/knowledge-base/knowledge-ingestion-panel.test.tsx src/app/'(app)'/knowledge-base/core-knowledge-manager.test.tsx src/app/'(app)'/knowledge-base/actions.test.ts src/app/'(app)'/knowledge-base/ingestion-actions.test.ts
npm run typecheck
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/'(app)'/knowledge-base
git commit -m "feat: clarify Knowledge source and approval lifecycle"
```

---

### Task 8: Converge Settings into Profile, Brand Kit and Integrations with safe summaries

**Files:**
- Modify: `src/app/(app)/settings/page.tsx`
- Create: `src/app/(app)/settings/page.test.tsx`
- Reuse: `src/modules/organization-profile/repository.ts`
- Reuse: `src/modules/brand-kit/repository.ts`
- Reuse: `src/modules/integrations/repository.ts`
- Do not change the existing Profile/Brand/Integration mutation surfaces unless a regression is discovered.

**Interfaces:**
- Define a page-local safe summary type, for example:

```ts
type SettingsOrganizationSummary = {
  id: string;
  label: string;
  role: AppRole;
  profileRevision: number | null;
  brandKitRevision: number | null;
  integrations: {
    openAI: IntegrationConnectionStatus;
    ltx: IntegrationConnectionStatus;
  };
};
```

- [ ] **Step 1: Write RED page test**

Mock the repositories and assert three administrative cards/sections:
- `Organization Profile` with configured/not-configured + revision;
- `Brand Kit` with configured/not-configured + revision;
- `Integrations` with OpenAI and LTX normalized state;
- Meta is shown only as `Planned · Phase 10`, not as a configurable provider.

Also assert no full API key/secret text is rendered.

- [ ] **Step 2: Run RED**

```bash
npm run test:run -- src/app/'(app)'/settings/page.test.tsx
```
Expected: FAIL because safe summary cards are not yet loaded/rendered.

- [ ] **Step 3: Load safe summaries server-side**

Use the authenticated memberships already loaded in `settings/page.tsx`. For each membership, fetch current Profile, current Brand Kit and safe integration metadata. Reuse `SupabaseIntegrationMetadataStore.listConnections()` and strip creator/updater fields exactly as the current page already does. Never request raw Vault secrets.

- [ ] **Step 4: Render the three-domain landing page**

Keep links:
- `/settings/organization-profile`
- `/settings/brand-kit`
- Integration controls on the current Settings page or existing integration subsection as already implemented.

Show read-only state summaries for non-manager roles while mutation controls remain governed by existing components/actions.

- [ ] **Step 5: Run Settings regression GREEN**

```bash
npm run test:run -- src/app/'(app)'/settings/page.test.tsx src/app/'(app)'/settings/integrations
npm run typecheck
```
If Vitest path expansion does not accept the directory, run the specific existing `*.test.tsx` / `*.test.ts` files under `src/app/(app)/settings/integrations`.
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/app/'(app)'/settings
git commit -m "feat: converge settings around institutional authority"
```

---

### Task 9: Lock truthful readiness and end-to-end production navigation

**Files:**
- Modify: `tests/e2e/track-b-release.spec.ts`
- Modify: `tests/e2e/module-readiness.spec.ts`
- Create: `tests/e2e/production-convergence.spec.ts`
- Modify as needed: `src/components/app-shell/module-readiness.test.tsx` or `b3-route-readiness.test.ts`

**Interfaces:**
- Operational routes: `/dashboard`, `/content-studio`, `/scene-planning`, `/media-library`, `/knowledge-base`, `/settings`.
- Roadmap routes retain existing readiness labels/phases.

- [ ] **Step 1: Write RED E2E assertions**

In `track-b-release.spec.ts`, remove the obsolete assertion that `/media-library` says `Foundation only`. Replace with assertions that Media Library has its operational heading and asset-catalogue framing.

Add `production-convergence.spec.ts` to assert:
1. grouped nav shows Operational before Roadmap;
2. Dashboard shows `Continue production` and both OpenAI/LTX integration areas using deterministic fixture/safe state;
3. Content Studio exposes `Authoritative context`;
4. Knowledge Base exposes `Add manually` and `Ingest document or URL`;
5. Analytics still says `Planned` and `Current availability`;
6. Manual Generation still says `Foundation only`;
7. no roadmap page exposes domain mutation buttons.

Use existing E2E fixture gates only; do not add production bypasses.

- [ ] **Step 2: Run selected E2E and observe RED**

```bash
npm run test:e2e -- tests/e2e/production-convergence.spec.ts tests/e2e/track-b-release.spec.ts tests/e2e/module-readiness.spec.ts
```
Expected: RED until the new UI/expectations are fully present.

- [ ] **Step 3: Fix only convergence regressions found by E2E**

Do not expand scope into Phase 9–17. Any genuine domain/security defect discovered must be isolated, reproduced in a unit/integration RED test, then fixed separately before proceeding.

- [ ] **Step 4: Run selected E2E GREEN**

Run the same command. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add tests/e2e src/components/app-shell
git commit -m "test: verify production convergence journeys"
```

---

### Task 10: Synchronize governance docs and run exact-head release verification

**Files:**
- Modify: `docs/product/PAK_UI_UX_SPEC.md`
- Modify: `docs/product/PAK_DEVELOPMENT_ROADMAP.md`
- Modify: `docs/product/PAK_TRACEABILITY_MATRIX.md`
- Update/create handoff under `docs/handoffs/` only after verification state is known.

**Interfaces:**
- Docs must describe only proven behavior from Tasks 1–9.
- Do not mark Phase 9–17 implemented.

- [ ] **Step 1: Update UI/UX maturity truth**

Record:
- grouped Operational / Administration / Roadmap navigation;
- Dashboard maturity upgraded from partial only if all command-center acceptance tests pass;
- Content Studio authoritative-context panel;
- Scene Planning four-stage production hierarchy;
- Media Library operational status;
- Knowledge manual/ingestion lifecycle clarity;
- Settings three-domain landing summaries.

- [ ] **Step 2: Update roadmap/traceability**

Add a cross-phase `UI/UX Production Convergence — IMPLEMENTED` entry only after all implementation tests are green. Explicitly state it introduces no Phase 9–17 domain workflows.

- [ ] **Step 3: Run focused changed-area unit suite**

```bash
npm run test:run -- \
  src/components/app-shell/navigation.test.ts \
  src/components/app-shell/app-navigation.test.tsx \
  src/modules/dashboard/service.test.ts \
  src/app/'(app)'/dashboard/dashboard-summary.test.tsx \
  src/app/'(app)'/content-studio/content-studio-form.test.tsx \
  src/app/'(app)'/content-studio/multilingual-content-panel.test.tsx \
  src/app/'(app)'/scene-planning/scene-planning-workspace.test.tsx \
  src/app/'(app)'/scene-planning/final-render-controls.test.tsx \
  src/app/'(app)'/media-library/media-library-client.test.tsx \
  src/app/'(app)'/knowledge-base/knowledge-base-manager.test.tsx \
  src/app/'(app)'/knowledge-base/knowledge-ingestion-panel.test.tsx \
  src/app/'(app)'/settings/page.test.tsx
```
Expected: PASS.

- [ ] **Step 4: Run full repository verification**

```bash
npm run typecheck
npm run lint
npm run test:run
npm run build
npm run test:e2e
```
Expected: all PASS. Preserve existing final-assembly worker/container verification in repository CI; do not remove or bypass it because this slice does not modify the worker.

- [ ] **Step 5: Commit governance/closure docs**

```bash
git add docs/product docs/handoffs
git commit -m "docs: record UI UX production convergence"
```

- [ ] **Step 6: Push/inspect exact-head CI and preview**

After the final commit:
- record exact HEAD SHA;
- verify GitHub Actions on that exact SHA: typecheck, lint, unit, build, worker gates, Playwright;
- verify Vercel deployment metadata points to the exact SHA;
- when READY, fetch the protected/publicly reachable expected surface as permitted and confirm the login/app shell returns HTTP 200;
- inspect runtime errors/fatal logs for the verification window;
- inspect review threads/status checks;
- do not claim Vercel READY if it remains QUEUED/pending.

- [ ] **Step 7: Final review gate**

Use `superpowers:requesting-code-review` and `superpowers:verification-before-completion`. Report Critical/Important findings explicitly. Do not merge without user authorization.
