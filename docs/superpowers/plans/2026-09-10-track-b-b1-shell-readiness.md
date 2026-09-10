# Track B B1 — Shell & Route Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the PAK application shell production-usable on desktop and mobile, expose the active route accessibly, prove all approved primary links resolve, and establish the canonical route-by-route Track B readiness matrix without implementing future roadmap domains.

**Architecture:** Preserve the existing Next.js App Router and fixed fourteen-module navigation. Introduce a focused client navigation component for pathname-aware active state and compact mobile disclosure while keeping authentication in the server layout. Add a documentation-only readiness matrix as the canonical Track B audit ledger and strengthen static/component/Playwright verification around navigation integrity.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Tailwind CSS, Vitest, Testing Library, Playwright, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-09-10-track-b-production-readiness-design.md`

## Global Constraints

- Preserve the approved fourteen-module navigation order.
- Do not implement Phase 6+ business-domain functionality in B1.
- Do not add fake production data, fake actions, placeholder `#` links, or misleading readiness claims.
- Authentication remains server-side in `src/app/(app)/layout.tsx`.
- UI hiding/active state never replaces RBAC or RLS.
- No provider secret, service-role credential, or Vault secret may enter client props/state.
- All behavior changes follow TDD: observe RED before implementation, then GREEN.
- Exact PR head must pass typecheck, lint, unit/component tests, production build, and applicable Playwright E2E before merge.
- Do not touch Lovable or any Lovable-attached Supabase project.

---

## File Structure

### New files

- `docs/product/PAK_TRACK_B_READINESS_MATRIX.md` — canonical route-by-route audit record for all fourteen primary modules.
- `src/components/app-shell/app-navigation.tsx` — client-only navigation rendering, active-route semantics, and compact mobile menu state.
- `src/components/app-shell/app-navigation.test.tsx` — component tests for active state and mobile disclosure.
- `src/components/app-shell/navigation-integrity.test.ts` — static contract proving approved app-shell links are real internal routes and are not placeholders.

### Modified files

- `src/components/app-shell/app-shell.tsx` — layout-only shell that delegates navigation behavior to `AppNavigation` and stops rendering the entire fourteen-link list expanded on small screens.
- `src/components/app-shell/navigation.ts` — keep canonical route order and export a pure `isNavigationItemActive(pathname, href)` matcher.
- `src/components/app-shell/navigation.test.ts` — extend pure navigation contract coverage.
- `tests/e2e/navigation.spec.ts` — verify all fourteen routes, active current-page semantics, and compact mobile navigation.

No database migration, Supabase policy change, provider change, or server action is part of B1.

---

### Task 1: Establish the Track B route readiness ledger

**Files:**
- Create: `docs/product/PAK_TRACK_B_READINESS_MATRIX.md`

**Interfaces:**
- Consumes: approved Track B spec plus `PAK_MASTER_PRD.md`, `PAK_MASTER_TRD.md`, `PAK_UI_UX_SPEC.md`, `PAK_DEVELOPMENT_ROADMAP.md`, `PAK_TRACEABILITY_MATRIX.md`, and `PAK_EXISTING_IMPLEMENTATION_GAP_AUDIT.md`.
- Produces: one auditable row per primary route with fields required by Section 7 of the Track B spec.

- [ ] **Step 1: Create the fourteen-route matrix with explicit current classifications**

Use these initial classifications, derived from current repo/domain evidence:

```markdown
| Route | Module | Class | Current production-readiness decision |
|---|---|---|---|
| /dashboard | Dashboard | B — Partial | BLOCKED: shell page exists; real backed operational summary is not yet reconciled |
| /content-studio | Content Studio | A — Implemented | ACTIVE: real OpenAI/Vault generation verified; B2 polish still required |
| /ai-representative | AI Representative | C — Future | BLOCKED: future domain; B3 truthful unavailable state required |
| /campus-locations | Campus / Locations | C — Future | BLOCKED: future domain; B3 truthful unavailable state required |
| /podcast | Podcast | C — Future | BLOCKED: future domain; B3 truthful unavailable state required |
| /manual-generation | Manual Generation | B — Partial | BLOCKED: route shell exists; actual supported workflow boundary must be reconciled in B3 |
| /student-testimonials | Student Testimonials | C — Future | BLOCKED: future domain; B3 truthful unavailable state required |
| /media-library | Media Library | B — Partial | BLOCKED: schema/storage foundation exists; complete operator workflow is not implemented |
| /knowledge-base | Knowledge Base | A — Implemented | ACTIVE: CRUD/state foundation exists; B2 production polish still required |
| /content-calendar | Content Calendar | C — Future | BLOCKED: publication scheduling belongs to later roadmap phase |
| /approval-center | Approval Center | C — Future | BLOCKED: approval workflow domain belongs to later roadmap phase |
| /publishing | Publishing | C — Future | BLOCKED: publishing adapters/workflow belong to later roadmap phase |
| /analytics | Analytics | C — Future | BLOCKED: analytics synchronization/reporting belongs to later roadmap phase |
| /settings | Settings | A — Implemented/Partial | ACTIVE for Integration Vault; remaining settings sections require B2 truthfulness review |
```

Below that summary, create the full audit table with columns exactly matching the Track B spec: `Route`, `Module`, `Roadmap phase`, `Current implementation class`, `Primary user goal`, `Data source`, `RBAC`, `Loading`, `Empty`, `Error`, `Success`, `Primary action`, `Secondary action`, `Backlink/upstream`, `Downstream`, `Mobile`, `Accessibility`, `Dead-link`, `Fake-control`, `Production readiness`.

For fields not yet validated, use `BLOCKED — reason` rather than vague markers. Do not use `TBD` or `TODO`.

- [ ] **Step 2: Self-check matrix completeness**

Verify exactly fourteen unique primary routes appear and every row has a concrete `PASS`, `ACTIVE`, or `BLOCKED — reason` decision. Confirm no route is labeled production-ready merely because `page.tsx` exists.

- [ ] **Step 3: Commit the readiness ledger**

```bash
git add docs/product/PAK_TRACK_B_READINESS_MATRIX.md
git commit -m "docs: establish Track B route readiness matrix"
```

---

### Task 2: Add pure active-route semantics and static link integrity

**Files:**
- Modify: `src/components/app-shell/navigation.ts`
- Modify: `src/components/app-shell/navigation.test.ts`
- Create: `src/components/app-shell/navigation-integrity.test.ts`

**Interfaces:**
- Consumes: `APP_NAVIGATION: readonly AppNavigationItem[]`.
- Produces: `isNavigationItemActive(pathname: string, href: string): boolean`.

Active matching contract:

```ts
export function isNavigationItemActive(pathname: string, href: string): boolean {
  if (pathname === href) return true;
  return href !== "/" && pathname.startsWith(`${href}/`);
}
```

This makes `/settings/integrations` activate `Settings` without letting `/content-studio-old` activate `/content-studio`.

- [ ] **Step 1: Write failing tests for pathname matching**

Append to `navigation.test.ts`:

```ts
import { APP_NAVIGATION, isNavigationItemActive } from "./navigation";

it("matches exact routes and nested child routes without prefix collisions", () => {
  expect(isNavigationItemActive("/content-studio", "/content-studio")).toBe(true);
  expect(isNavigationItemActive("/settings/integrations", "/settings")).toBe(true);
  expect(isNavigationItemActive("/content-studio-old", "/content-studio")).toBe(false);
  expect(isNavigationItemActive("/dashboard", "/settings")).toBe(false);
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
npm run test:run -- src/components/app-shell/navigation.test.ts
```

Expected: FAIL because `isNavigationItemActive` is not exported yet.

- [ ] **Step 3: Implement the minimal matcher**

Add the exact pure function above to `navigation.ts`. Do not change `APP_NAVIGATION` order or labels.

- [ ] **Step 4: Add static route/link integrity tests**

Create `navigation-integrity.test.ts` with the explicit approved route list and filesystem existence check:

```ts
import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { APP_NAVIGATION } from "./navigation";

const routeToPage = (href: string) =>
  join(process.cwd(), "src", "app", "(app)", href.slice(1), "page.tsx");

describe("application navigation integrity", () => {
  it("contains no placeholder, external, or query-only primary destinations", () => {
    for (const item of APP_NAVIGATION) {
      expect(item.href).toMatch(/^\/[a-z0-9-]+$/);
      expect(item.href).not.toBe("#");
    }
  });

  it("maps every primary navigation item to an existing App Router page", () => {
    for (const item of APP_NAVIGATION) {
      expect(existsSync(routeToPage(item.href)), `${item.href} is missing page.tsx`).toBe(true);
    }
  });
});
```

- [ ] **Step 5: Run focused navigation tests and verify GREEN**

Run:

```bash
npm run test:run -- src/components/app-shell/navigation.test.ts src/components/app-shell/navigation-integrity.test.ts
```

Expected: both test files PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/app-shell/navigation.ts src/components/app-shell/navigation.test.ts src/components/app-shell/navigation-integrity.test.ts
git commit -m "test: enforce app navigation route integrity"
```

---

### Task 3: Replace the expanded mobile sidebar with accessible responsive navigation

**Files:**
- Create: `src/components/app-shell/app-navigation.tsx`
- Create: `src/components/app-shell/app-navigation.test.tsx`
- Modify: `src/components/app-shell/app-shell.tsx`

**Interfaces:**
- Consumes: `APP_NAVIGATION`, `isNavigationItemActive`, Next.js `usePathname()`.
- Produces: `AppNavigation(): JSX.Element` with `aria-current="page"` on active link and a mobile `Menu` disclosure button with `aria-expanded`.

- [ ] **Step 1: Write failing component tests**

Mock `next/navigation` pathname as `/content-studio` and assert:

```tsx
expect(screen.getByRole("link", { name: "Content Studio" })).toHaveAttribute("aria-current", "page");
expect(screen.getByRole("link", { name: "Settings" })).not.toHaveAttribute("aria-current");
expect(screen.getByRole("button", { name: "Open navigation" })).toHaveAttribute("aria-expanded", "false");
```

Then click the button and assert `aria-expanded="true"` and `screen.getByRole("navigation", { name: "Primary" })` remains keyboard-addressable.

- [ ] **Step 2: Run focused component test and verify RED**

Run:

```bash
npm run test:run -- src/components/app-shell/app-navigation.test.tsx
```

Expected: FAIL because `AppNavigation` does not exist.

- [ ] **Step 3: Implement `AppNavigation` minimally**

Use this behavior:

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { APP_NAVIGATION, isNavigationItemActive } from "./navigation";

export function AppNavigation() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className="min-h-11 rounded-lg border border-slate-700 px-4 text-sm font-medium text-slate-100 lg:hidden"
        aria-expanded={open}
        aria-controls="primary-navigation"
        aria-label={open ? "Close navigation" : "Open navigation"}
        onClick={() => setOpen((value) => !value)}
      >
        Menu
      </button>
      <nav
        id="primary-navigation"
        aria-label="Primary"
        className={`${open ? "grid" : "hidden"} gap-1 pt-4 lg:grid lg:pt-0`}
      >
        {APP_NAVIGATION.map((item) => {
          const active = isNavigationItemActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              onClick={() => setOpen(false)}
              className={active
                ? "rounded-lg bg-slate-800 px-3 py-2.5 text-sm font-medium text-white"
                : "rounded-lg px-3 py-2.5 text-sm text-slate-300 transition hover:bg-slate-800 hover:text-white"}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
```

Do not add icon dependencies in B1.

- [ ] **Step 4: Refactor `AppShell` to delegate navigation**

Keep `AppShell` server-compatible and replace direct map rendering with `<AppNavigation />`. On mobile, make the header row compact so the fourteen links are collapsed until requested. On `lg+`, keep the left rail visible.

Target shell structure:

```tsx
<div className="min-h-screen bg-slate-950 text-slate-100">
  <div className="mx-auto min-h-screen max-w-[1600px] lg:grid lg:grid-cols-[280px_1fr]">
    <aside className="border-b border-slate-800 bg-slate-900/60 px-4 py-4 lg:border-b-0 lg:border-r lg:p-6">
      <div className="flex items-center justify-between gap-4 lg:mb-8 lg:block">
        <div>...existing Polish Railway Academy / PAK Marketing Automation identity...</div>
        <AppNavigation />
      </div>
    </aside>
    <main className="min-w-0 px-4 py-6 sm:px-6 lg:p-10">{children}</main>
  </div>
</div>
```

If the exact DOM nesting makes desktop navigation collapse into the identity row, split the identity and navigation wrappers while preserving these responsive outcomes: compact mobile header, toggle-visible mobile menu, persistent desktop rail.

- [ ] **Step 5: Run component and existing navigation unit tests**

Run:

```bash
npm run test:run -- src/components/app-shell/app-navigation.test.tsx src/components/app-shell/navigation.test.ts src/components/app-shell/navigation-integrity.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/app-shell/app-navigation.tsx src/components/app-shell/app-navigation.test.tsx src/components/app-shell/app-shell.tsx
git commit -m "feat: add responsive active application navigation"
```

---

### Task 4: Strengthen Playwright route, active-state, and mobile navigation coverage

**Files:**
- Modify: `tests/e2e/navigation.spec.ts`

**Interfaces:**
- Consumes: E2E auth bypass already configured by the current CI Playwright workflow.
- Produces: browser evidence that all fourteen primary routes resolve, active state follows navigation, and mobile navigation does not render the full menu expanded by default.

- [ ] **Step 1: Add failing active-state E2E assertion**

Add:

```ts
test("marks the current primary navigation destination", async ({ page }) => {
  await page.goto("/content-studio");
  await expect(page.getByRole("link", { name: "Content Studio" })).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("link", { name: "Settings" })).not.toHaveAttribute("aria-current", "page");
});
```

Before Task 3 implementation this test must fail because current links expose no `aria-current`.

- [ ] **Step 2: Add mobile navigation E2E test**

```ts
test("uses a compact disclosure menu on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/dashboard");

  const toggle = page.getByRole("button", { name: "Open navigation" });
  await expect(toggle).toBeVisible();
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(page.getByRole("link", { name: "Settings" })).not.toBeVisible();

  await toggle.click();
  await expect(page.getByRole("button", { name: "Close navigation" })).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByRole("link", { name: "Settings" })).toBeVisible();

  await page.getByRole("link", { name: "Settings" }).click();
  await expect(page).toHaveURL(/\/settings$/);
  await expect(page.getByRole("button", { name: "Open navigation" })).toHaveAttribute("aria-expanded", "false");
});
```

- [ ] **Step 3: Preserve and tighten fourteen-route smoke**

Keep the existing loop over all fourteen modules. For each route assert the expected page heading is visible and the request does not land on a 404/error shell.

- [ ] **Step 4: Run Playwright navigation spec**

Run:

```bash
npm run test:e2e -- tests/e2e/navigation.spec.ts
```

Expected: all navigation E2E tests PASS under the existing CI auth bypass.

- [ ] **Step 5: Run the complete B1 verification gate**

Run in this order:

```bash
npm run typecheck
npm run lint
npm run test:run
npm run build
npm run test:e2e
```

Acceptance:

- typecheck exit 0;
- lint has zero errors and introduces no new warnings;
- all Vitest tests pass;
- production build exit 0;
- all Playwright E2E tests pass.

- [ ] **Step 6: Update the B1 section of the readiness matrix with evidence**

Mark only the B1-owned fields as verified: primary-route existence, dead-link result, desktop navigation, mobile navigation, and accessibility active-state semantics. Do not mark B2/B3 page workflow fields as passed.

- [ ] **Step 7: Commit final B1 verification updates**

```bash
git add tests/e2e/navigation.spec.ts docs/product/PAK_TRACK_B_READINESS_MATRIX.md
git commit -m "test: verify Track B shell readiness"
```

---

## B1 Pull Request Gate

After Tasks 1–4:

1. Open a dedicated PR from the B1 implementation branch into `main`; do not merge the long-lived Track B branch directly without isolating the reviewed B1 commit set.
2. Confirm the PR head SHA is exact and current.
3. Confirm GitHub Actions typecheck, lint, unit tests, build, and E2E are green on that exact head.
4. Review the PR patch for scope creep: no future module business logic, no DB migration, no provider change, no secret-bearing client props.
5. Merge with expected-head protection.
6. Verify the resulting Vercel production deployment is `READY` and built from the merge commit.
7. Smoke `/dashboard`, `/content-studio`, `/knowledge-base`, `/settings`, and at least one future-module route at desktop and mobile widths; full fourteen-route browser smoke follows in B4.
8. Check production runtime errors after deployment.

## B1 Definition of Done

B1 is complete only when the readiness matrix exists with all fourteen routes, every primary nav href maps to a real route, the active route exposes `aria-current="page"`, the mobile shell starts compact and opens/closes accessibly, desktop navigation remains persistent, all existing route headings continue to render, and the exact PR head passes the full verification gate. No future module is declared functionally complete by B1.