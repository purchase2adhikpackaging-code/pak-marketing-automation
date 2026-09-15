# PAK UI/UX Production Convergence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Converge the PAK operator UI with the capabilities already implemented through Phase 8 plus the Organization Profile / Brand Kit / Knowledge foundation, without inventing Phase 9–17 workflows or weakening existing server authority.

**Architecture:** Preserve every existing domain model, RLS/RBAC boundary, provider workflow, revision/CAS rule and private-media boundary. The slice is presentation-led: grouped navigation, an authoritative production-command Dashboard, clearer cross-workflow handoffs, stage hierarchy in Scene Planning, and truthful operational/readiness copy. New summary state is loaded server-side from existing repositories/tables and exposed as safe read models; the browser never becomes authoritative.

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
- Use TDD: observe RED before each GREEN implementation and commit after each independently reviewable task.
- Final verification: `npm run typecheck`, `npm run lint`, `npm run test:run`, `npm run build`, and `npm run test:e2e` plus the repository’s existing worker/container CI gates.

---

## File Structure / Responsibility Map

### Shell and readiness
- `src/components/app-shell/navigation.ts` — grouped navigation data contract.
- `src/components/app-shell/app-navigation.tsx` — grouped desktop/mobile rendering.
- `src/components/app-shell/navigation.test.ts` — grouping/order/active-route unit coverage.
- `src/components/app-shell/app-navigation.test.tsx` — group labels, mobile behavior, active state.
- `src/components/app-shell/module-readiness.ts` — Phase 9–17 readiness registry only.
- `src/components/app-shell/b3-route-readiness.test.ts` and `module-readiness-page.test.tsx` — roadmap semantics.

### Dashboard
- `src/modules/dashboard/service.ts` — server-only aggregate read model and deterministic next-action resolver.
- `src/modules/dashboard/service.test.ts` — resolver/query-contract coverage.
- `src/app/(app)/dashboard/dashboard-summary.tsx` — command-center rendering.
- `src/app/(app)/dashboard/dashboard-summary.test.tsx` — cards/status/CTA behavior.
- `src/app/(app)/dashboard/page.tsx` — page framing/load boundary.

### Content Studio
- `src/app/(app)/content-studio/page.tsx` — load safe Profile/Brand/Core metadata.
- `src/app/(app)/content-studio/content-studio-form.tsx` — read-only authoritative-context panel.
- `src/app/(app)/content-studio/content-studio-form.test.tsx` — context semantics.
- `src/app/(app)/content-studio/multilingual-content-panel.tsx` — Scene Planning handoff wording/state.
- `src/app/(app)/content-studio/multilingual-content-panel.test.tsx` — handoff regression.

### Scene Planning
- `src/app/(app)/scene-planning/scene-planning-workspace.tsx` — four-stage visual hierarchy only.
- `src/app/(app)/scene-planning/scene-planning-workspace.test.tsx` — stage headings + workflow regression.
- `src/app/(app)/scene-planning/final-render-controls.tsx` — completed final asset → Media Library CTA.
- `src/app/(app)/scene-planning/final-render-controls.test.tsx` — completion CTA/readiness state.
- `src/app/(app)/scene-planning/page.tsx` — route framing/empty-state copy.

### Media Library
- `src/app/(app)/media-library/page.tsx` — operational framing.
- `src/app/(app)/media-library/media-library-client.tsx` — safe purpose/origin presentation using existing metadata only.
- `src/app/(app)/media-library/media-library-client.test.tsx` — purpose/status rendering.

### Knowledge Base
- `src/app/(app)/knowledge-base/knowledge-base-manager.tsx` — explicit manual vs ingestion hierarchy, DRAFT/ACTIVE/Core semantics.
- `src/app/(app)/knowledge-base/knowledge-base-manager.test.tsx` — source-entry/lifecycle UX.
- `src/app/(app)/knowledge-base/knowledge-ingestion-panel.tsx` — DRAFT-review flow.
- `src/app/(app)/knowledge-base/knowledge-ingestion-panel.test.tsx` — ingestion success remains DRAFT-only.

### Settings
- `src/app/(app)/settings/page.tsx` — three administrative domains with safe summaries.
- `src/app/(app)/settings/page.test.tsx` — always create; page summary regression.
- Reuse `src/modules/organization-profile/repository.ts`, `src/modules/brand-kit/repository.ts`, and `src/modules/integrations/repository.ts`.

### E2E / governance
- `tests/e2e/track-b-release.spec.ts` — operational traversal and removal of stale Media Library expectation.
- `tests/e2e/module-readiness.spec.ts` — Phase 9–17 truthful readiness stays intact.
- `tests/e2e/production-convergence.spec.ts` — new workflow-first navigation assertions.
- `docs/product/PAK_UI_UX_SPEC.md`, `PAK_DEVELOPMENT_ROADMAP.md`, `PAK_TRACEABILITY_MATRIX.md` — synchronize only after implementation is proven.

---

### Task 1: Group operational, administration and roadmap navigation

**Files:**
- Modify: `src/components/app-shell/navigation.ts`
- Modify: `src/components/app-shell/navigation.test.ts`
- Modify: `src/components/app-shell/app-navigation.tsx`
- Modify: `src/components/app-shell/app-navigation.test.tsx`
- Verify: `src/components/app-shell/b3-route-readiness.test.ts`
- Verify: `src/components/app-shell/module-readiness-page.test.tsx`

**Interfaces:**

```ts
export type AppNavigationGroup = {
  label: "Operational" | "Administration" | "Roadmap";
  items: readonly AppNavigationItem[];
};

export const APP_NAVIGATION_GROUPS: readonly AppNavigationGroup[];
export const APP_NAVIGATION: readonly AppNavigationItem[];
export function isNavigationItemActive(pathname: string, href: string): boolean;
```

- [ ] **Step 1: Write RED tests**

```ts
expect(APP_NAVIGATION_GROUPS.map((group) => group.label)).toEqual([
  "Operational",
  "Administration",
  "Roadmap",
]);
expect(APP_NAVIGATION_GROUPS[0].items.map((item) => item.href)).toEqual([
  "/dashboard", "/content-studio", "/scene-planning", "/media-library", "/knowledge-base",
]);
expect(APP_NAVIGATION_GROUPS[1].items.map((item) => item.href)).toEqual(["/settings"]);
expect(APP_NAVIGATION_GROUPS[2].items.map((item) => item.href)).toEqual([
  "/approval-center", "/publishing", "/content-calendar", "/analytics",
  "/ai-representative", "/podcast", "/campus-locations",
  "/student-testimonials", "/manual-generation",
]);
```

In `app-navigation.test.tsx`, assert the three group labels, Operational before Roadmap, mobile toggle behavior, and `aria-current="page"`.

- [ ] **Step 2: Run RED**

```bash
npm run test:run -- src/components/app-shell/navigation.test.ts src/components/app-shell/app-navigation.test.tsx
```
Expected: FAIL because grouped navigation does not exist.

- [ ] **Step 3: Implement**

```ts
export const APP_NAVIGATION_GROUPS = [
  { label: "Operational", items: [
    { label: "Dashboard", href: "/dashboard" },
    { label: "Content Studio", href: "/content-studio" },
    { label: "Scene Planning", href: "/scene-planning" },
    { label: "Media Library", href: "/media-library" },
    { label: "Knowledge Base", href: "/knowledge-base" },
  ]},
  { label: "Administration", items: [{ label: "Settings", href: "/settings" }]},
  { label: "Roadmap", items: [
    { label: "Approval Center", href: "/approval-center" },
    { label: "Publishing", href: "/publishing" },
    { label: "Content Calendar", href: "/content-calendar" },
    { label: "Analytics", href: "/analytics" },
    { label: "AI Representative", href: "/ai-representative" },
    { label: "Podcast", href: "/podcast" },
    { label: "Campus / Locations", href: "/campus-locations" },
    { label: "Student Testimonials", href: "/student-testimonials" },
    { label: "Manual Generation", href: "/manual-generation" },
  ]},
] as const satisfies readonly AppNavigationGroup[];

export const APP_NAVIGATION = APP_NAVIGATION_GROUPS.flatMap((group) => group.items);
```

Render group labels in the desktop and collapsed mobile nav. Do not hide Roadmap routes.

- [ ] **Step 4: Run GREEN**

```bash
npm run test:run -- src/components/app-shell/navigation.test.ts src/components/app-shell/app-navigation.test.tsx src/components/app-shell/b3-route-readiness.test.ts src/components/app-shell/module-readiness-page.test.tsx
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/app-shell
git commit -m "feat: group PAK navigation by workflow maturity"
```

---

### Task 2: Expand the server-only Dashboard read model

**Files:**
- Modify: `src/modules/dashboard/service.ts`
- Modify: `src/modules/dashboard/service.test.ts`

**Interfaces:**

```ts
export type DashboardNextAction = { label: string; href: string; reason: string };

export type DashboardWorkspace = {
  organizationId: string;
  organizationLabel: string;
  role: AppRole;
  identity: { profileRevision: number | null; brandKitRevision: number | null; activeCoreKnowledge: number };
  content: { total: number; generated: number; failed: number };
  knowledge: { total: number; active: number; draft: number; coreActive: number };
  production: {
    projects: number;
    plansNeedingWork: number;
    approvedPlans: number;
    generation: { active: number; failed: number; completed: number };
    assembly: { active: number; failed: number; completed: number };
    actionableProjectId?: string;
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

```ts
export function resolveDashboardNextAction(input: {
  profileRevision: number | null;
  brandKitRevision: number | null;
  knowledgeDrafts: number;
  generatedContent: number;
  projects: number;
  plansNeedingWork: number;
  activeGeneration: number;
  assemblyActive: number;
  completedAssemblies: number;
  actionableProjectId?: string;
}): DashboardNextAction;
```

Priority:
1. Profile or Brand missing → `/settings`, `Complete institutional setup`.
2. DRAFT Knowledge > 0 → `/knowledge-base`, `Review Knowledge drafts`.
3. generated Content = 0 → `/content-studio`, `Create content`.
4. projects = 0 → `/content-studio`, `Create a Scene Plan`.
5. plansNeedingWork > 0 → `/scene-planning?project=<actionableProjectId>` when present, else `/scene-planning`.
6. activeGeneration > 0 → same project route, `Review generation progress`.
7. assemblyActive > 0 → same project route, `Continue final assembly`.
8. completedAssemblies > 0 → `/media-library`, `Open completed media`.
9. fallback → `/content-studio`, `Create or continue content`.

- [ ] **Step 1: Write RED resolver tests**

Cover all nine branches and priority precedence. Example:

```ts
expect(resolveDashboardNextAction({
  profileRevision: null,
  brandKitRevision: 2,
  knowledgeDrafts: 3,
  generatedContent: 5,
  projects: 2,
  plansNeedingWork: 1,
  activeGeneration: 1,
  assemblyActive: 1,
  completedAssemblies: 1,
  actionableProjectId: "22222222-2222-4222-8222-222222222222",
})).toMatchObject({ href: "/settings", label: "Complete institutional setup" });
```

- [ ] **Step 2: Run RED**

```bash
npm run test:run -- src/modules/dashboard/service.test.ts
```
Expected: FAIL.

- [ ] **Step 3: Implement organization-scoped aggregation**

Keep the current authenticated membership lookup. Add safe reads for:
- `organization_profiles.revision`;
- `organization_brand_kits.revision`;
- `knowledge_records` total / ACTIVE / DRAFT / ACTIVE+`is_core`;
- `video_projects` total and latest project activity;
- `scene_plan_versions`: `APPROVED` vs all non-APPROVED current/latest versions; derive the latest actionable project ID from the latest non-APPROVED plan, otherwise latest project with active generation/assembly;
- `video_generation_attempts` states: active = `QUEUED`, `SUBMITTING`, `SUBMITTED`, `PROCESSING`, `IMPORT_PENDING`, `SUBMISSION_UNKNOWN`; failed = `FAILED`; completed = `COMPLETED`; exclude `CANCELLED` from active/failed/completed totals;
- `video_assemblies` states: active = `QUEUED` + `PROCESSING`; failed = `FAILED`; completed = `COMPLETED`; exclude `CANCELLED`;
- `media_assets`: ACTIVE total, ACTIVE `asset_type='VIDEO'` total;
- final render total = `video_assemblies` rows with `state='COMPLETED'` and non-null `final_media_asset_id`;
- `integration_connections`: OPENAI and LTX normalized status + `last_verified_at`.

Use only organization-scoped queries and existing repository patterns. Normalize any query failure to the existing safe Dashboard error.

- [ ] **Step 4: Run GREEN**

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

### Task 3: Render the Production Command Center

**Files:**
- Modify: `src/app/(app)/dashboard/dashboard-summary.tsx`
- Modify: `src/app/(app)/dashboard/dashboard-summary.test.tsx`
- Modify: `src/app/(app)/dashboard/page.tsx`

**Consumes:** `DashboardWorkspace` from Task 2. No client-side Supabase queries.

- [ ] **Step 1: Write RED UI tests**

Assert headings:

```text
Institutional readiness
Content production
Trusted Knowledge
Scene & video production
Media Library
Integrations
Continue production
```

Assert Profile/Brand revisions or `Not configured`, Core count, OpenAI/LTX statuses, next-action CTA, safe error/null-workspace states, and absence of a numeric health score.

- [ ] **Step 2: Run RED**

```bash
npm run test:run -- src/app/'(app)'/dashboard/dashboard-summary.test.tsx
```
Expected: FAIL.

- [ ] **Step 3: Implement**

Render semantic sections/cards; `Continue production` appears immediately after organization/role context on mobile. Use text status labels in addition to visual styling. Update page description to:

```text
Monitor institutional readiness and continue the active content-to-video workflow from one operational view.
```

- [ ] **Step 4: Run GREEN**

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

### Task 4: Expose automatic authoritative context in Content Studio

**Files:**
- Modify: `src/app/(app)/content-studio/page.tsx`
- Modify: `src/app/(app)/content-studio/content-studio-form.tsx`
- Modify: `src/app/(app)/content-studio/content-studio-form.test.tsx`
- Modify: `src/app/(app)/content-studio/multilingual-content-panel.tsx`
- Modify: `src/app/(app)/content-studio/multilingual-content-panel.test.tsx`
- Reuse: `src/modules/organization-profile/repository.ts`
- Reuse: `src/modules/brand-kit/repository.ts`
- Reuse: `src/modules/knowledge-base/repository.ts`

**Interface:**

```ts
authoritativeContext: {
  profileRevision: number | null;
  brandKitRevision: number | null;
  activeCoreKnowledgeCount: number;
};
```

- [ ] **Step 1: Write RED tests**

Assert `Authoritative context`, automatic Profile/Brand/Core copy, Profile/Brand revisions, Core count, and explicit copy that `0 of 20 selected` normal Knowledge does not disable Core grounding. Preserve existing `Create Scene Plan` server-action behavior.

- [ ] **Step 2: Run RED**

```bash
npm run test:run -- src/app/'(app)'/content-studio/content-studio-form.test.tsx src/app/'(app)'/content-studio/multilingual-content-panel.test.tsx
```
Expected: FAIL.

- [ ] **Step 3: Load metadata server-side**

For each eligible organization, load Profile revision, Brand Kit revision and ACTIVE Core Knowledge count with existing repositories/data paths. Continue to expose only selectable ACTIVE non-Core Knowledge in the checkbox selector. Do not pass editable Profile/Brand fields to React.

- [ ] **Step 4: Render panel/handoff copy**

Use:

```text
PAK automatically applies the current Organization Profile, Brand Kit and ACTIVE Core Knowledge to generation. The sources selected below are additional approved Knowledge and do not disable Core grounding.
```

Keep the 20 non-Core selection cap and existing Scene Planning action signature.

- [ ] **Step 5: Run GREEN**

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

### Task 5: Reframe Scene Planning into four production stages

**Files:**
- Modify: `src/app/(app)/scene-planning/scene-planning-workspace.tsx`
- Modify: `src/app/(app)/scene-planning/scene-planning-workspace.test.tsx`
- Modify: `src/app/(app)/scene-planning/final-render-controls.tsx`
- Modify: `src/app/(app)/scene-planning/final-render-controls.test.tsx`
- Modify: `src/app/(app)/scene-planning/page.tsx`

**Constraints:** Do not change Scene Planning server-action signatures or lifecycle semantics. `FinalRenderControls` continues to consume `FinalAssemblyReadModel`.

- [ ] **Step 1: Write RED tests**

Assert headings:

```text
1. Source & plan
2. Quality & approval
3. Generate
4. Assemble
```

Keep existing tests for Production Brief, Visual Bible, QC, approval immutability, role behavior and copy-on-write editing. For a COMPLETED assembly with `finalMediaAssetId`, assert an `Open final asset in Media Library` link to `/media-library`. Do not introduce an unsupported `?asset=` deep link.

- [ ] **Step 2: Run RED**

```bash
npm run test:run -- src/app/'(app)'/scene-planning/scene-planning-workspace.test.tsx src/app/'(app)'/scene-planning/final-render-controls.test.tsx
```
Expected: FAIL.

- [ ] **Step 3: Implement presentational hierarchy**

Stage 1: source freshness, Production Brief, official Brand defaults/Visual Bible, plan version.  
Stage 2: QC findings, warning acknowledgement, review/approval/copy-on-write.  
Stage 3: per-shot generation specifications and generation controls/status.  
Stage 4: `FinalRenderControls`.

Add explanatory copy: `Brand Kit provides official institutional identity; Visual Bible controls project-specific creative direction.`

- [ ] **Step 4: Add final Media handoff**

For COMPLETED assembly with a final asset ID, render the Media Library CTA and safe asset identifier/status; do not expose storage path/provider URL.

- [ ] **Step 5: Run GREEN**

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

### Task 6: Promote Media Library as an operational output surface

**Files:**
- Modify: `src/app/(app)/media-library/page.tsx`
- Modify: `src/app/(app)/media-library/media-library-client.tsx`
- Modify: `src/app/(app)/media-library/media-library-client.test.tsx`
- Modify only when rendering existing metadata requires it: `src/app/(app)/media-library/media-detail.tsx`

- [ ] **Step 1: Write RED tests**

Assert no `Foundation only` copy, operational asset-catalogue framing, existing safe `assetType`/source/status/lineage where present, and no inferred category when metadata is absent. Preserve preview/upload/archive/delete coverage.

- [ ] **Step 2: Run RED**

```bash
npm run test:run -- src/app/'(app)'/media-library/media-library-client.test.tsx src/app/'(app)'/media-library/media-upload.test.tsx
```
Expected: new framing assertions fail.

- [ ] **Step 3: Implement metadata-backed labels only**

Use existing authoritative fields. `asset_type='VIDEO'` may be rendered as Video; `source='GENERATED'` may be rendered as Generated; final assembled output is identified only from existing assembly/lineage metadata already exposed to the client/detail model. Do not infer from filename, MIME alone or storage path.

- [ ] **Step 4: Run GREEN**

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

### Task 7: Clarify Knowledge Base source entry and approval lifecycle

**Files:**
- Modify: `src/app/(app)/knowledge-base/knowledge-base-manager.tsx`
- Modify: `src/app/(app)/knowledge-base/knowledge-base-manager.test.tsx`
- Modify: `src/app/(app)/knowledge-base/knowledge-ingestion-panel.tsx`
- Modify: `src/app/(app)/knowledge-base/knowledge-ingestion-panel.test.tsx`

**Decision:** The primary manual form is strictly `sourceType: "MANUAL"`. Remove the manual-form source-type selector from the UI. Keep optional source label/reference metadata. Document/URL creation is only through `KnowledgeIngestionPanel`, which creates DRAFT Knowledge after extraction. Existing server action schemas remain unchanged for compatibility, but this UI always sends `MANUAL` for manual creation/editing of manually-created records.

- [ ] **Step 1: Write RED tests**

Assert `Add manually`, `Ingest document or URL`, absence of a manual source-type selector, explicit DRAFT/ACTIVE text, Core helper `Automatically grounded in generation.`, OWNER/ADMIN Core controls, EDITOR no Core mutation, read-only REVIEWER/ANALYST, and ingestion success containing `Draft created for review` without claiming approval.

- [ ] **Step 2: Run RED**

```bash
npm run test:run -- src/app/'(app)'/knowledge-base/knowledge-base-manager.test.tsx src/app/'(app)'/knowledge-base/knowledge-ingestion-panel.test.tsx src/app/'(app)'/knowledge-base/core-knowledge-manager.test.tsx
```
Expected: FAIL.

- [ ] **Step 3: Implement hierarchy**

Place ingestion in its own top-level card and rename the manual card `Add manually`. Manual create/edit UI uses `MANUAL`; extracted document/URL records keep their authoritative source type when rendered and are not reclassified by editing. Preserve persistent success/error regions and all existing actions/RBAC.

- [ ] **Step 4: Run GREEN**

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

### Task 8: Converge Settings into Profile, Brand Kit and Integrations

**Files:**
- Modify: `src/app/(app)/settings/page.tsx`
- Create: `src/app/(app)/settings/page.test.tsx`
- Reuse: `src/modules/organization-profile/repository.ts`
- Reuse: `src/modules/brand-kit/repository.ts`
- Reuse: `src/modules/integrations/repository.ts`

**Interface:**

```ts
type SettingsOrganizationSummary = {
  id: string;
  label: string;
  role: AppRole;
  profileRevision: number | null;
  brandKitRevision: number | null;
  integrations: { openAI: IntegrationConnectionStatus; ltx: IntegrationConnectionStatus };
};
```

- [ ] **Step 1: Write RED page test**

Mock current repositories and assert:
- Organization Profile configured/not-configured + revision;
- Brand Kit configured/not-configured + revision;
- Integrations with OpenAI/LTX normalized state;
- Meta shown only as `Planned · Phase 10`;
- no raw API key/secret value rendered.

- [ ] **Step 2: Run RED**

```bash
npm run test:run -- src/app/'(app)'/settings/page.test.tsx
```
Expected: FAIL.

- [ ] **Step 3: Implement server-side summaries**

For each authenticated membership, load current Profile, Brand Kit and `SupabaseIntegrationMetadataStore.listConnections()`. Reuse the existing safe connection mapping; never request Vault secret values. Render links to `/settings/organization-profile` and `/settings/brand-kit`; keep the existing integration manager as the live integration control surface.

- [ ] **Step 4: Run GREEN**

```bash
npm run test:run -- src/app/'(app)'/settings/page.test.tsx
npm run test:run -- src/app/'(app)'/settings/integrations/integrations-manager.test.tsx
npm run typecheck
```
If the integration-manager test has a different existing filename, use the exact `*.test.tsx` file in `src/app/(app)/settings/integrations` discovered before editing; do not skip the existing integration regression suite.
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/'(app)'/settings
git commit -m "feat: converge settings around institutional authority"
```

---

### Task 9: Lock truthful readiness and production navigation in E2E

**Files:**
- Modify: `tests/e2e/track-b-release.spec.ts`
- Modify: `tests/e2e/module-readiness.spec.ts`
- Create: `tests/e2e/production-convergence.spec.ts`

- [ ] **Step 1: Write RED E2E**

Update `track-b-release.spec.ts` so `/media-library` is asserted as operational instead of `Foundation only`.

`production-convergence.spec.ts` asserts:
1. Operational nav appears before Roadmap.
2. Dashboard renders `Continue production`, OpenAI and LTX status areas.
3. Content Studio renders `Authoritative context`.
4. Knowledge Base renders `Add manually` and `Ingest document or URL`.
5. Analytics still renders `Planned` + `Current availability`.
6. Manual Generation still renders `Foundation only`.
7. Roadmap pages expose no domain mutation controls.

Use only existing E2E fixture gates; add no production bypass.

- [ ] **Step 2: Run RED**

```bash
npm run test:e2e -- tests/e2e/production-convergence.spec.ts tests/e2e/track-b-release.spec.ts tests/e2e/module-readiness.spec.ts
```
Expected: RED until convergence UI is complete.

- [ ] **Step 3: Fix convergence-only failures**

If E2E reveals a genuine domain/security defect, stop that task, reproduce it with a focused RED unit/integration test, fix it separately, then resume. Do not expand into Phase 9–17.

- [ ] **Step 4: Run GREEN**

Run the same Playwright command. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add tests/e2e
git commit -m "test: verify production convergence journeys"
```

---

### Task 10: Synchronize governance and verify exact head

**Files:**
- Modify: `docs/product/PAK_UI_UX_SPEC.md`
- Modify: `docs/product/PAK_DEVELOPMENT_ROADMAP.md`
- Modify: `docs/product/PAK_TRACEABILITY_MATRIX.md`
- Create/update: `docs/handoffs/2026-09-14-ui-ux-production-convergence-handoff.md`

- [ ] **Step 1: Update governing docs only with proven behavior**

Record grouped navigation, command-center Dashboard, Content Studio authoritative-context panel, Scene Planning four-stage hierarchy, operational Media Library, Knowledge lifecycle/source hierarchy and Settings three-domain landing. Keep Phase 9–17 roadmap statuses unchanged.

- [ ] **Step 2: Run changed-area unit suite**

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

- [ ] **Step 3: Run full verification**

```bash
npm run typecheck
npm run lint
npm run test:run
npm run build
npm run test:e2e
```
Expected: PASS. Do not remove/bypass the repository’s final-assembly worker/container CI gates.

- [ ] **Step 4: Commit governance/handoff**

```bash
git add docs/product docs/handoffs
git commit -m "docs: record UI UX production convergence"
```

- [ ] **Step 5: Verify exact-head CI/deployment**

Record the final SHA, then verify GitHub Actions on that exact SHA: typecheck, lint, unit, build, worker gates and Playwright. Verify Vercel deployment metadata points to the same SHA. If READY, confirm expected app/login surface returns HTTP 200 and inspect runtime error/fatal logs for the verification window. If Vercel is QUEUED/pending, report it exactly as pending; do not claim READY.

- [ ] **Step 6: Final review gate**

Use `superpowers:requesting-code-review` and `superpowers:verification-before-completion`. Report Critical/Important findings explicitly. Do not merge without user authorization.
