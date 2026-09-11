# Track B B3 — Partial and Future Route Reconciliation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every B3-owned partial/future route a truthful, accessible, dependency-aware operator surface with no fake actions or invented production data.

**Architecture:** Preserve the existing fourteen-route Next.js App Router shell and introduce one shared readiness configuration model plus one reusable server-rendered readiness page component. B3 routes remain non-operational domain surfaces: they expose purpose, status, dependency, roadmap metadata, and one or two links to already implemented workflows only. No new database tables, RPCs, provider calls, client-side privileged code, or future-domain business logic are introduced.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Next `Link`, Tailwind CSS, Vitest/Testing Library, Playwright, GitHub Actions, Vercel.

**Spec:** `docs/superpowers/specs/2026-09-10-track-b-production-readiness-design.md`

## Global Constraints

- Preserve the fixed fourteen-module navigation order.
- B3 owns `/media-library`, `/manual-generation`, `/ai-representative`, `/campus-locations`, `/podcast`, `/student-testimonials`, `/content-calendar`, `/approval-center`, `/publishing`, and `/analytics`.
- Scene Planning remains a dependency/future concept only; do not add a new primary route or implement Phase 6 domain logic in B3.
- Future/partial pages must not expose fake Create, Generate, Approve, Publish, Sync, Upload, or Schedule actions.
- Do not invent counts, jobs, provider health, progress, external IDs, analytics values, or sample production data.
- Related links may target only currently implemented operator workflows: `/dashboard`, `/content-studio`, `/knowledge-base`, `/settings`.
- Use text status in addition to styling; no color-only readiness semantics.
- Mobile acceptance target is 390 × 844 with no critical horizontal dependency.
- No Supabase migrations or authorization changes are expected or permitted unless a requirement-mapped blocker is discovered and separately reviewed.
- Preserve Track A/B2 RLS, RBAC, Integration Vault, OpenAI, provenance, quota, and service-role trust boundaries.
- No Lovable changes or Lovable-attached Supabase access.
- All behavior changes follow RED → GREEN TDD.
- Exact PR head must pass typecheck, lint with no new errors, Vitest, production build, and Playwright before merge.

---

### Task 1: Shared B3 readiness model and production-quality page primitive

**Files:**
- Create: `src/components/app-shell/module-readiness.ts`
- Create: `src/components/app-shell/module-readiness-page.tsx`
- Create: `src/components/app-shell/module-readiness-page.test.tsx`

**Interfaces:**
- Produces:
  ```ts
  export type ModuleReadinessStatus = "Planned" | "Foundation only";
  export type ModuleReadinessLink = {
    href: "/dashboard" | "/content-studio" | "/knowledge-base" | "/settings";
    label: string;
  };
  export type ModuleReadinessConfig = {
    route: string;
    title: string;
    description: string;
    status: ModuleReadinessStatus;
    roadmapPhase: string;
    explanation: string;
    dependency: string;
    relatedLinks: readonly ModuleReadinessLink[];
  };
  export const B3_MODULE_READINESS: Record<string, ModuleReadinessConfig>;
  export function ModuleReadinessPage({ config }: { config: ModuleReadinessConfig }): JSX.Element;
  ```
- Consumes: Next.js `Link` only. No browser state, server action, Supabase client, provider client, or secret-bearing props.

- [ ] **Step 1: Write failing component/config tests**

Create tests proving:

```tsx
const config = B3_MODULE_READINESS["/analytics"];
render(<ModuleReadinessPage config={config} />);
expect(screen.getByRole("heading", { name: "Analytics" })).toBeInTheDocument();
expect(screen.getByText("Planned")).toBeInTheDocument();
expect(screen.getByText(/publishing performance data/i)).toBeInTheDocument();
expect(screen.getByRole("link", { name: "Open Dashboard" })).toHaveAttribute("href", "/dashboard");
expect(screen.queryByRole("button")).not.toBeInTheDocument();
```

Also assert all ten registry entries have exactly 1–2 related links and that each link targets only `/dashboard`, `/content-studio`, `/knowledge-base`, or `/settings`.

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
npm run test:run -- src/components/app-shell/module-readiness-page.test.tsx
```

Expected: FAIL because the readiness model/component does not exist yet.

- [ ] **Step 3: Implement the typed readiness registry**

Use these exact operator-facing configurations:

```ts
export const B3_MODULE_READINESS = {
  "/media-library": {
    route: "/media-library",
    title: "Media Library",
    description: "Catalog reusable and generated media assets with tenant-safe storage references and provenance.",
    status: "Foundation only",
    roadmapPhase: "Phase 8",
    explanation: "Storage and media-reference foundations exist, but the operator asset catalogue and upload workflow are not enabled in this release.",
    dependency: "Media operations follow Scene Planning and the approved media-generation workflow. Use implemented content and knowledge workflows until that operator surface is released.",
    relatedLinks: [
      { href: "/content-studio", label: "Open Content Studio" },
      { href: "/knowledge-base", label: "Open Knowledge Base" },
    ],
  },
  "/manual-generation": {
    route: "/manual-generation",
    title: "Manual Generation",
    description: "Launch controlled one-off generation workflows outside recurring scheduler automation.",
    status: "Foundation only",
    roadmapPhase: "Phase 17",
    explanation: "The dedicated one-off generation workspace is not enabled yet. Content Studio is the supported generation path in the current release.",
    dependency: "Manual generation will reuse approved provider, authorization, grounding, and artifact controls after its roadmap phase is implemented.",
    relatedLinks: [
      { href: "/content-studio", label: "Open Content Studio" },
      { href: "/settings", label: "Open Settings" },
    ],
  },
  "/ai-representative": {
    route: "/ai-representative",
    title: "AI Representative",
    description: "Configure and supervise AI-assisted representative content and controlled interaction workflows.",
    status: "Planned",
    roadmapPhase: "Phase 13",
    explanation: "AI representative interactions are not active in the current release.",
    dependency: "This module depends on approved content, controlled knowledge, and later representative-specific authorization and interaction workflows.",
    relatedLinks: [
      { href: "/content-studio", label: "Open Content Studio" },
      { href: "/knowledge-base", label: "Open Knowledge Base" },
    ],
  },
  "/campus-locations": {
    route: "/campus-locations",
    title: "Campus / Locations",
    description: "Manage approved PAK campus and location identities used across knowledge and visual continuity workflows.",
    status: "Planned",
    roadmapPhase: "Phase 15",
    explanation: "Campus and location management is not active in the current release.",
    dependency: "The module requires its approved location data model and lifecycle before operators can manage campus identities here.",
    relatedLinks: [{ href: "/knowledge-base", label: "Open Knowledge Base" }],
  },
  "/podcast": {
    route: "/podcast",
    title: "Podcast",
    description: "Plan, generate, review, and schedule podcast-oriented content and media assets.",
    status: "Planned",
    roadmapPhase: "Phase 14",
    explanation: "Podcast generation and episode operations are not active in the current release.",
    dependency: "Podcast operations depend on approved content plus later audio/media generation and review workflows.",
    relatedLinks: [
      { href: "/content-studio", label: "Open Content Studio" },
      { href: "/knowledge-base", label: "Open Knowledge Base" },
    ],
  },
  "/student-testimonials": {
    route: "/student-testimonials",
    title: "Student Testimonials",
    description: "Manage testimonial source material, approvals, generation, and reusable testimonial media.",
    status: "Planned",
    roadmapPhase: "Phase 16",
    explanation: "Testimonial management is not active in the current release.",
    dependency: "This workflow requires the approved testimonial consent and source-governance model before testimonial content can be managed here.",
    relatedLinks: [
      { href: "/knowledge-base", label: "Open Knowledge Base" },
      { href: "/content-studio", label: "Open Content Studio" },
    ],
  },
  "/content-calendar": {
    route: "/content-calendar",
    title: "Content Calendar",
    description: "Coordinate planned content, recurring schedules, approvals, and downstream publishing timing.",
    status: "Planned",
    roadmapPhase: "Phase 11",
    explanation: "Calendar scheduling is not active in the current release.",
    dependency: "Scheduling depends on the later Approval and Publishing workflows. Current content work remains in Content Studio.",
    relatedLinks: [
      { href: "/content-studio", label: "Open Content Studio" },
      { href: "/dashboard", label: "Open Dashboard" },
    ],
  },
  "/approval-center": {
    route: "/approval-center",
    title: "Approval Center",
    description: "Review scripts, translations, scenes, renders, and publishing copy with auditable decisions.",
    status: "Planned",
    roadmapPhase: "Phase 9",
    explanation: "The auditable approval workflow is not active in the current release.",
    dependency: "Approval Center follows the scene/render workflow and will be enabled only when approval records and role-specific decisions are implemented.",
    relatedLinks: [
      { href: "/content-studio", label: "Open Content Studio" },
      { href: "/knowledge-base", label: "Open Knowledge Base" },
    ],
  },
  "/publishing": {
    route: "/publishing",
    title: "Publishing",
    description: "Manage approved publication schedules, platform adapters, attempts, external identifiers, and publish outcomes.",
    status: "Planned",
    roadmapPhase: "Phase 10",
    explanation: "External publishing is not active in the current release.",
    dependency: "Publishing requires the later Approval workflow and approved platform integration adapters before any content can be sent externally.",
    relatedLinks: [
      { href: "/settings", label: "Open Settings" },
      { href: "/content-studio", label: "Open Content Studio" },
    ],
  },
  "/analytics": {
    route: "/analytics",
    title: "Analytics",
    description: "Track normalized performance metrics linked back to generated content, publishing records, and source workflows.",
    status: "Planned",
    roadmapPhase: "Phase 12",
    explanation: "Publishing performance analytics are not active in the current release.",
    dependency: "Analytics requires real publishing outcomes and normalized metric ingestion. No performance values are shown until those data sources exist.",
    relatedLinks: [
      { href: "/dashboard", label: "Open Dashboard" },
      { href: "/content-studio", label: "Open Content Studio" },
    ],
  },
} as const satisfies Record<string, ModuleReadinessConfig>;
```

- [ ] **Step 4: Implement the reusable page primitive**

Render, in order:

```tsx
<section className="max-w-5xl">
  <p>PAK Workspace</p>
  <div className="flex flex-wrap items-start justify-between gap-4">
    <div>
      <h2>{config.title}</h2>
      <p>{config.description}</p>
    </div>
    <span aria-label={`Readiness: ${config.status}`}>{config.status}</span>
  </div>
  <section aria-labelledby={`${slug}-availability`}>
    <h3 id={`${slug}-availability`}>Current availability</h3>
    <p>{config.explanation}</p>
    <p><strong>Dependency:</strong> {config.dependency}</p>
    <p>{config.roadmapPhase}</p>
  </section>
  <nav aria-label={`${config.title} related workflows`}>
    <h3>Available now</h3>
    {config.relatedLinks.map((link) => <Link key={link.href} href={link.href}>{link.label}</Link>)}
  </nav>
</section>
```

Use existing slate styling, wrapping flex/grid layouts, minimum readable tap targets, and no `<button>` or async UI.

- [ ] **Step 5: Run the focused test and verify GREEN**

Run the same Vitest command. Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/app-shell/module-readiness.ts src/components/app-shell/module-readiness-page.tsx src/components/app-shell/module-readiness-page.test.tsx
git commit -m "feat: add truthful module readiness surface"
```

### Task 2: Convert all ten B3 routes to the shared truthfulness surface

**Files:**
- Modify: `src/app/(app)/media-library/page.tsx`
- Modify: `src/app/(app)/manual-generation/page.tsx`
- Modify: `src/app/(app)/ai-representative/page.tsx`
- Modify: `src/app/(app)/campus-locations/page.tsx`
- Modify: `src/app/(app)/podcast/page.tsx`
- Modify: `src/app/(app)/student-testimonials/page.tsx`
- Modify: `src/app/(app)/content-calendar/page.tsx`
- Modify: `src/app/(app)/approval-center/page.tsx`
- Modify: `src/app/(app)/publishing/page.tsx`
- Modify: `src/app/(app)/analytics/page.tsx`
- Create: `src/components/app-shell/b3-route-readiness.test.tsx`

**Interfaces:**
- Consumes: `B3_MODULE_READINESS` and `ModuleReadinessPage` from Task 1.
- Produces: ten top-level routes that contain no domain mutation form or fake primary action.

- [ ] **Step 1: Write a failing static route-source test**

For each route, read its `page.tsx` and assert it imports `ModuleReadinessPage` and references its exact `B3_MODULE_READINESS["/<route>"]` config. Assert the source does not include `<button`, `action=`, `form action`, or placeholder href `#`.

- [ ] **Step 2: Run the focused test and verify RED**

```bash
npm run test:run -- src/components/app-shell/b3-route-readiness.test.tsx
```

Expected: FAIL while routes still use the old title/description-only `ModulePage`.

- [ ] **Step 3: Convert each page to the exact minimal pattern**

Example for Analytics:

```tsx
import { B3_MODULE_READINESS } from "@/components/app-shell/module-readiness";
import { ModuleReadinessPage } from "@/components/app-shell/module-readiness-page";

export default function AnalyticsPage() {
  return <ModuleReadinessPage config={B3_MODULE_READINESS["/analytics"]} />;
}
```

Apply the same pattern to all ten B3-owned routes. Do not add new domain components.

- [ ] **Step 4: Run focused route and component tests and verify GREEN**

```bash
npm run test:run -- src/components/app-shell/module-readiness-page.test.tsx src/components/app-shell/b3-route-readiness.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/'(app)'/media-library src/app/'(app)'/manual-generation src/app/'(app)'/ai-representative src/app/'(app)'/campus-locations src/app/'(app)'/podcast src/app/'(app)'/student-testimonials src/app/'(app)'/content-calendar src/app/'(app)'/approval-center src/app/'(app)'/publishing src/app/'(app)'/analytics src/components/app-shell/b3-route-readiness.test.tsx
git commit -m "feat: reconcile partial and future module routes"
```

### Task 3: Extend internal-link integrity to B3 related-workflow links

**Files:**
- Modify: `src/components/app-shell/navigation-integrity.test.ts`

**Interfaces:**
- Consumes: `B3_MODULE_READINESS`.
- Produces: static evidence that every B3 related link is a valid existing App Router destination and no B3 config uses `#`, external URLs, or query-only destinations.

- [ ] **Step 1: Add the failing integrity assertions**

Add:

```ts
for (const config of Object.values(B3_MODULE_READINESS)) {
  for (const link of config.relatedLinks) {
    expect(link.href).toMatch(/^\/[a-z0-9-]+$/);
    expect(link.href).not.toBe("#");
    expect(existsSync(routeToPage(link.href)), `${config.route} -> ${link.href} is missing page.tsx`).toBe(true);
  }
}
```

- [ ] **Step 2: Run the focused integrity suite**

```bash
npm run test:run -- src/components/app-shell/navigation-integrity.test.ts
```

Expected after Task 1 registry exists: PASS. If it fails, fix only the invalid B3 link/config; do not create a fake route.

- [ ] **Step 3: Commit**

```bash
git add src/components/app-shell/navigation-integrity.test.ts
git commit -m "test: verify B3 related workflow links"
```

### Task 4: Browser verification for all B3 truthfulness surfaces

**Files:**
- Create: `tests/e2e/module-readiness.spec.ts`

**Interfaces:**
- Consumes: public route paths and rendered readiness semantics only.
- Produces: deterministic browser evidence under the existing E2E auth-bypass environment; no synthetic user/org/domain data.

- [ ] **Step 1: Add a ten-route Playwright table**

Use:

```ts
const routes = [
  ["/media-library", "Media Library", "Foundation only"],
  ["/manual-generation", "Manual Generation", "Foundation only"],
  ["/ai-representative", "AI Representative", "Planned"],
  ["/campus-locations", "Campus / Locations", "Planned"],
  ["/podcast", "Podcast", "Planned"],
  ["/student-testimonials", "Student Testimonials", "Planned"],
  ["/content-calendar", "Content Calendar", "Planned"],
  ["/approval-center", "Approval Center", "Planned"],
  ["/publishing", "Publishing", "Planned"],
  ["/analytics", "Analytics", "Planned"],
] as const;
```

For each route assert:

```ts
await page.goto(route);
await expect(page.getByRole("heading", { name: title })).toBeVisible();
await expect(page.getByLabel(`Readiness: ${status}`)).toBeVisible();
await expect(page.getByRole("heading", { name: "Current availability" })).toBeVisible();
await expect(page.getByRole("heading", { name: "Available now" })).toBeVisible();
await expect(page.getByRole("button")).toHaveCount(0);
```

- [ ] **Step 2: Add 390 × 844 mobile overflow verification for all ten routes**

For each route set `page.setViewportSize({ width: 390, height: 844 })`, navigate, and assert:

```ts
const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
expect(overflow).toBe(false);
```

- [ ] **Step 3: Run Playwright and verify GREEN**

```bash
npm run test:e2e -- tests/e2e/module-readiness.spec.ts
```

Expected: all readiness and mobile cases PASS.

- [ ] **Step 4: Commit**

```bash
git add tests/e2e/module-readiness.spec.ts
git commit -m "test: cover B3 route truthfulness in browser"
```

### Task 5: Close B3-owned readiness-matrix fields without overstating domain implementation

**Files:**
- Modify: `docs/product/PAK_TRACK_B_READINESS_MATRIX.md`

**Interfaces:**
- Consumes: verified B3 component, static-integrity, and browser evidence.
- Produces: audit truth for ten B3 routes only; B4/global verification remains pending.

- [ ] **Step 1: Update summary decisions for ten B3 routes**

Use wording equivalent to:

```text
PASS — truthful boundary surface; dedicated domain workflow remains roadmap-disabled
```

For Media Library and Manual Generation preserve Class B and explicitly say `Foundation only`. For the remaining eight preserve Class C and explicitly say `Planned`.

- [ ] **Step 2: Update full-route audit fields for the ten B3 rows**

Set:
- Data source: `None exposed in B3 operator surface` for future routes; `Existing foundation only; no operator-domain read/write exposed` for Media Library/Manual Generation.
- Loading: `PASS — no async domain workflow`.
- Empty: `PASS — readiness/dependency state`.
- Error: `PASS — no backend domain action`.
- Success: `PASS — no false success state`.
- Primary action: `NONE — domain workflow intentionally unavailable`.
- Secondary action: real related links only.
- Mobile: `PASS — 390 × 844 verified`.
- Accessibility: `PASS — semantic status/headings/links verified`.
- Dead-link: `PASS`.
- Fake-control: `PASS — no domain mutation control`.
- Production readiness: `PASS — truthful boundary surface; domain remains roadmap-blocked`.

Do not change B1/B2 ownership decisions except wording needed for matrix consistency. Do not mark the future domain itself ACTIVE.

- [ ] **Step 3: Add a B3 verification-evidence section**

Record exact branch head after the matrix update and the focused/full verification results available at that point. If full CI has not yet run on that exact head, state `PENDING exact-head CI` rather than inventing a pass.

- [ ] **Step 4: Commit**

```bash
git add docs/product/PAK_TRACK_B_READINESS_MATRIX.md
git commit -m "docs: record B3 route readiness decisions"
```

### Task 6: Exact-head release gate, review, and merge into Track B

**Files:**
- No product source changes expected. Any defect discovered here receives its own RED → GREEN fix before this task resumes.

**Interfaces:**
- Base branch: `track-b/production-readiness`.
- Head branch: `track-b/b3-partial-future-routes`.

- [ ] **Step 1: Run the full verification gate**

```bash
npm run typecheck
npm run lint
npm run test:run
npm run build
npm run test:e2e
```

Required results: zero typecheck errors, zero lint errors, all Vitest files/tests pass, production build exits successfully, all Playwright tests pass.

- [ ] **Step 2: Open a dedicated draft PR into `track-b/production-readiness`**

PR body must state that B3 adds truthful boundary surfaces only and introduces no Phase 6+ backend implementation.

- [ ] **Step 3: Verify CI on the exact PR head**

Record workflow run ID, job ID, exact head SHA, unit-test count, Playwright count, and build result. If any gate fails, use `superpowers:systematic-debugging`; do not merge.

- [ ] **Step 4: Review the exact PR patch**

Confirm:
- only B3 route/readiness component/tests/matrix/plan changes are intentional;
- no service-role usage, Supabase migration, privileged client, provider secret, server action, or future-domain mutation path was introduced;
- all related links resolve to implemented routes;
- no fake action/data appears;
- no navigation-order change occurred.

- [ ] **Step 5: Merge only the exact green head**

Use GitHub merge with `expected_head_sha` set to the verified SHA.

- [ ] **Step 6: Verify the merge deployment**

Confirm Vercel deployment metadata references the exact merge commit and reaches `READY`. Smoke the accessible deployment boundary and query runtime errors. Authenticated route truthfulness will be fully exercised again in B4; do not claim an authenticated live session if none is available.

## Definition of Done

- All ten B3-owned routes show purpose, explicit readiness, operational dependency, roadmap metadata, and 1–2 valid links to implemented workflows.
- Media Library and Manual Generation are clearly `Foundation only`; eight future modules are clearly `Planned`.
- No B3 page exposes fake Create/Generate/Approve/Publish/Sync/Upload/Schedule actions, invented metrics, or sample operational data.
- No new Scene Planning route or Phase 6+ backend domain logic is added.
- All B3 related links resolve to `/dashboard`, `/content-studio`, `/knowledge-base`, or `/settings`.
- 390 × 844 browser verification finds no critical horizontal dependency.
- Readiness matrix closes B3 page-level blockers without falsely marking future domains active.
- Exact PR head is green across typecheck, lint, Vitest, build, and Playwright.
- Security review confirms Track A/B2 trust boundaries are unchanged.
- B3 merges into `track-b/production-readiness` only with an exact-head guard, followed by a READY Vercel deployment check.
