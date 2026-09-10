# Track B B2 — Active Pages Production Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reconcile Dashboard, Content Studio, Knowledge Base, and Settings into production-usable active workflows with truthful organization context, real-backed data, actionable empty/error/success states, safe RBAC, valid workflow links, and no fake functionality.

**Architecture:** Preserve the existing Next.js App Router, Supabase RLS/user-session boundary, organization-scoped Integration Vault, and current domain repositories/actions. Add only focused view-model/query helpers and UI components required to make the four active pages operationally clear. Dashboard metrics must be derived from real organization-scoped Supabase data; Content Studio, Knowledge Base, and Settings changes are UX/state and validation hardening, not backend rewrites. OpenAI credentials remain write-only and provider calls remain routed through Supabase Edge Functions.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Tailwind CSS, Supabase Auth/Postgres/RLS, Zod, Vitest, Testing Library, Playwright, GitHub Actions, Vercel.

**Spec:** `docs/superpowers/specs/2026-09-10-track-b-b2-active-pages-readiness-design.md`

## Global Constraints

- Preserve the approved fourteen-module navigation order and the B1 responsive shell.
- Do not implement Phase 6+ business-domain functionality.
- Do not add fake production data, dummy counters, placeholder `#` links, or misleading success states.
- Dashboard metrics must come only from real organization-scoped Supabase tables already implemented in completed phases.
- Authentication and organization membership remain server-derived; UI visibility does not replace server authorization or RLS.
- Keep `SUPABASE_SERVICE_ROLE_KEY` out of Next.js/Vercel runtime. Service-role access remains only inside Supabase Edge Functions.
- OpenAI credentials remain organization-scoped in Supabase Vault and are never returned to browser state or logs.
- Content generation remains through the existing organization-scoped OpenAI provider and `generate-content` Edge Function.
- Allowed OpenAI generation models remain exactly `gpt-5.6-luna` and `gpt-5.6-terra`.
- Knowledge Base mutation permissions remain OWNER/ADMIN/EDITOR; delete remains OWNER/ADMIN; REVIEWER/ANALYST remain read-only ACTIVE-only views.
- Integration mutation permissions remain OWNER/ADMIN.
- All behavior changes follow TDD: observe RED before implementation, then GREEN.
- Exact PR head must pass typecheck, lint, unit/component tests, production build, and Playwright before merge.
- Do not touch Lovable or any Lovable-attached Supabase project.

---

## File Structure

### New files

- `src/modules/dashboard/service.ts` — composes organization-scoped, real-backed operational summary values for active completed workflows only.
- `src/modules/dashboard/service.test.ts` — unit tests for summary mapping, empty counts, and no invented future-module metrics.
- `src/components/workflow/workflow-links.tsx` — reusable internal workflow-link group for valid upstream/downstream navigation on active pages.
- `src/components/workflow/workflow-links.test.tsx` — verifies semantic link rendering and no placeholder destinations.
- `src/app/(app)/dashboard/dashboard-summary.tsx` — responsive dashboard cards and quick workflow links using the real summary model.
- `src/app/(app)/dashboard/dashboard-summary.test.tsx` — component coverage for populated and empty real-backed summary states.
- `tests/e2e/active-pages.spec.ts` — browser checks for Dashboard, Content Studio, Knowledge Base, Settings, workflow links, mobile usability, and truthful future-boundary copy.

### Modified files

- `src/app/(app)/dashboard/page.tsx`
- `src/app/(app)/content-studio/page.tsx`
- `src/app/(app)/content-studio/content-studio-form.tsx`
- `src/app/(app)/content-studio/content-studio-form.test.tsx`
- `src/app/(app)/content-studio/knowledge-selector.tsx`
- `src/app/(app)/content-studio/knowledge-selector.test.tsx`
- `src/app/(app)/knowledge-base/page.tsx`
- `src/app/(app)/knowledge-base/knowledge-base-manager.tsx`
- `src/app/(app)/knowledge-base/knowledge-base-manager.test.tsx`
- `src/modules/integrations/schema.ts`
- `src/modules/integrations/schema.test.ts`
- `src/app/(app)/settings/page.tsx`
- `src/app/(app)/settings/integrations/integrations-manager.tsx`
- `src/app/(app)/settings/integrations/integrations-manager.test.tsx`
- `src/app/(app)/settings/integrations/actions.test.ts`
- `docs/product/PAK_TRACK_B_READINESS_MATRIX.md`

No database migration, RLS policy change, Edge Function behavior change, provider architecture change, or Phase 6+ table is planned in B2.

---

### Task 1: Harden OpenAI model configuration at the server boundary

**Files:**
- Modify: `src/modules/integrations/schema.test.ts`
- Modify: `src/modules/integrations/schema.ts`
- Modify: `src/app/(app)/settings/integrations/actions.test.ts`

**Interfaces:**
- Consumes: `updateIntegrationConfigSchema` and existing `executeUpdateIntegrationConfigAction`.
- Produces: server-validated OpenAI config where `defaultModel` is exactly `gpt-5.6-luna` or `gpt-5.6-terra`; other providers retain generic non-secret config behavior.

- [ ] **Step 1: Write the failing schema tests**

Require `gpt-5.6-terra` to parse, `gpt-5.6-sol` to fail, and an OpenAI config containing `apiKey` to fail.

- [ ] **Step 2: Run the focused schema test and verify RED**

```bash
npm run test:run -- src/modules/integrations/schema.test.ts
```

Expected: unsupported OpenAI model and secret-bearing config cases FAIL against the current arbitrary-record schema.

- [ ] **Step 3: Implement provider-aware validation**

```ts
export const OPENAI_ALLOWED_MODELS = ["gpt-5.6-luna", "gpt-5.6-terra"] as const;

const openAiConfig = z.object({
  defaultModel: z.enum(OPENAI_ALLOWED_MODELS),
}).strict();

const genericConfig = z.record(z.string(), z.unknown()).default({});

export const updateIntegrationConfigSchema = z.discriminatedUnion("provider", [
  z.object({ organizationId, provider: z.literal("OPENAI"), config: openAiConfig }),
  z.object({ organizationId, provider: z.literal("META"), config: genericConfig }),
  z.object({ organizationId, provider: z.literal("LTX"), config: genericConfig }),
]);
```

Keep the Edge sensitive-key rejection intact as defense in depth.

- [ ] **Step 4: Add action-level rejection coverage**

Import `executeUpdateIntegrationConfigAction` and assert unsupported OpenAI model input returns `{ ok: false }` without calling `deps.updateConfig`.

- [ ] **Step 5: Run focused tests and verify GREEN**

```bash
npm run test:run -- src/modules/integrations/schema.test.ts src/app/\(app\)/settings/integrations/actions.test.ts
```

- [ ] **Step 6: Commit**

```bash
git add src/modules/integrations/schema.ts src/modules/integrations/schema.test.ts src/app/\(app\)/settings/integrations/actions.test.ts
git commit -m "fix: constrain OpenAI integration model config"
```

---

### Task 2: Make Settings integration controls truthful and operation-aware

**Files:**
- Modify: `src/app/(app)/settings/integrations/integrations-manager.test.tsx`
- Modify: `src/app/(app)/settings/integrations/integrations-manager.tsx`
- Modify: `src/app/(app)/settings/page.tsx`
- Create: `src/components/workflow/workflow-links.tsx`
- Create: `src/components/workflow/workflow-links.test.tsx`

**Interfaces:**
- Consumes: `OPENAI_ALLOWED_MODELS`, `SafeIntegrationConnection`, `can(role, "settings:manage")`.
- Produces: `WorkflowLinks`, a safe model selector, explicit pending state, confirmation for destructive actions, and truthful implemented/planned provider states.

```ts
export type WorkflowLink = { href: string; label: string; description?: string };
export function WorkflowLinks({ links, label }: { links: WorkflowLink[]; label: string }): JSX.Element;
```

- [ ] **Step 1: Write failing Settings component tests**

Assert `Default model` is a SELECT whose values are exactly Luna/Terra. Assert `Remove key` prompts for confirmation and cancellation prevents the action. Assert an in-flight connection test exposes `Testing connection…`.

- [ ] **Step 2: Run focused test and verify RED**

```bash
npm run test:run -- src/app/\(app\)/settings/integrations/integrations-manager.test.tsx
```

- [ ] **Step 3: Write RED/GREEN coverage for `WorkflowLinks`**

Verify semantic internal links render with the supplied label and exact `href` values; do not allow placeholder destinations in any call site.

- [ ] **Step 4: Replace free-form model input with allowlisted selector**

Render options from `OPENAI_ALLOWED_MODELS` only.

- [ ] **Step 5: Track operation-specific pending state**

Use `save-key`, `remove-key`, `save-model`, `test`, and `toggle` states and expose visible labels such as `Saving key…` and `Testing connection…` while pending.

- [ ] **Step 6: Add confirmation for key removal and disabling OpenAI**

Use explicit `window.confirm` copy stating the operational consequence. Enabling does not require destructive confirmation.

- [ ] **Step 7: Make Settings page scope explicit and add links**

State that Integrations is the implemented operational section in this slice; do not fabricate Organization/Members/Operational controls. Add valid links to `/dashboard` and `/content-studio`.

- [ ] **Step 8: Run focused tests and verify GREEN**

```bash
npm run test:run -- src/components/workflow/workflow-links.test.tsx src/app/\(app\)/settings/integrations/integrations-manager.test.tsx src/modules/integrations/schema.test.ts src/app/\(app\)/settings/integrations/actions.test.ts
```

- [ ] **Step 9: Commit**

```bash
git add src/components/workflow src/app/\(app\)/settings src/modules/integrations/schema.ts
git commit -m "feat: harden integration settings experience"
```

---

### Task 3: Make Content Studio states actionable

**Files:**
- Modify: `src/app/(app)/content-studio/knowledge-selector.test.tsx`
- Modify: `src/app/(app)/content-studio/knowledge-selector.tsx`
- Modify: `src/app/(app)/content-studio/content-studio-form.test.tsx`
- Modify: `src/app/(app)/content-studio/content-studio-form.tsx`
- Modify: `src/app/(app)/content-studio/page.tsx`

**Interfaces:**
- Consumes: existing real `generateContentAction`, `KnowledgeSelector`, `WorkflowLinks`.
- Produces: actionable zero-source state, explicit generation lifecycle feedback, current organization context, and valid Settings/Knowledge Base navigation.

- [ ] **Step 1: Write failing zero-source selector test**

Require `Manage Knowledge Base` → `/knowledge-base` while preserving the visible `0 of 20 selected` limit.

- [ ] **Step 2: Run selector test and verify RED**

```bash
npm run test:run -- src/app/\(app\)/content-studio/knowledge-selector.test.tsx
```

- [ ] **Step 3: Implement zero-source link**

Use `next/link`; keep free-form generation available because Knowledge Base grounding is optional by current product behavior.

- [ ] **Step 4: Write failing form lifecycle tests**

Require visible current organization context, `Generating source script…` while pending, a persistent success message after generation, and safe error guidance linking to `/settings` and `/knowledge-base`.

- [ ] **Step 5: Run form test and verify RED**

```bash
npm run test:run -- src/app/\(app\)/content-studio/content-studio-form.test.tsx
```

- [ ] **Step 6: Implement lifecycle status region and troubleshooting links**

Keep server-returned safe errors only. Do not infer a provider-specific cause from the generic action failure.

- [ ] **Step 7: Add page-level workflow links**

Add `/knowledge-base` and `/settings`; do not present Scene Planning as an active next step before Phase 6.

- [ ] **Step 8: Run focused tests and verify GREEN**

```bash
npm run test:run -- src/app/\(app\)/content-studio/content-studio-form.test.tsx src/app/\(app\)/content-studio/knowledge-selector.test.tsx src/app/\(app\)/content-studio/multilingual-content-panel.test.tsx src/app/\(app\)/content-studio/actions.test.ts
```

- [ ] **Step 9: Commit**

```bash
git add src/app/\(app\)/content-studio
git commit -m "feat: improve Content Studio workflow states"
```

---

### Task 4: Make Knowledge Base lifecycle actions operationally safe and connected

**Files:**
- Modify: `src/app/(app)/knowledge-base/knowledge-base-manager.test.tsx`
- Modify: `src/app/(app)/knowledge-base/knowledge-base-manager.tsx`
- Modify: `src/app/(app)/knowledge-base/page.tsx`

**Interfaces:**
- Consumes: existing server actions and `WorkflowLinks`.
- Produces: explicit organization/role context, useful empty state, mutation success state, delete confirmation, and direct Content Studio handoff.

- [ ] **Step 1: Write failing lifecycle UX tests**

Require distinct manager/read-only empty copy, persistent mutation success messages, delete confirmation/cancellation behavior, and visible organization + role context.

- [ ] **Step 2: Run focused test and verify RED**

```bash
npm run test:run -- src/app/\(app\)/knowledge-base/knowledge-base-manager.test.tsx
```

- [ ] **Step 3: Add success state and operating context**

Use `role="status"` for success and retain `role="alert"` for errors. Clear stale success text before each new mutation.

- [ ] **Step 4: Add delete confirmation**

Prompt `Delete <title>? This cannot be undone.` before calling the existing delete action. Do not expose delete controls to unauthorized roles.

- [ ] **Step 5: Improve empty-state copy and add links**

Managers: explain DRAFT → ACTIVE. REVIEWER/ANALYST: explain no ACTIVE approved records. Add valid `/content-studio` and `/dashboard` workflow links.

- [ ] **Step 6: Run focused tests and verify GREEN**

```bash
npm run test:run -- src/app/\(app\)/knowledge-base/knowledge-base-manager.test.tsx src/app/\(app\)/knowledge-base/actions.test.ts
```

- [ ] **Step 7: Commit**

```bash
git add src/app/\(app\)/knowledge-base
git commit -m "feat: improve Knowledge Base lifecycle UX"
```

---

### Task 5: Replace Dashboard shell with real-backed operational summary

**Files:**
- Create: `src/modules/dashboard/service.test.ts`
- Create: `src/modules/dashboard/service.ts`
- Create: `src/app/(app)/dashboard/dashboard-summary.test.tsx`
- Create: `src/app/(app)/dashboard/dashboard-summary.tsx`
- Modify: `src/app/(app)/dashboard/page.tsx`

**Interfaces:**
- Produces:

```ts
export type DashboardOrganizationSummary = {
  organizationId: string;
  organizationName: string;
  role: AppRole;
  generatedContentCount: number;
  failedContentCount: number;
  activeKnowledgeCount: number;
  draftKnowledgeCount: number;
  openAiStatus: IntegrationConnectionStatus | "NOT_CONFIGURED";
  lastContentUpdatedAt?: string;
};

export async function loadDashboardSummaries(): Promise<DashboardOrganizationSummary[]>;
```

Only `content_items`, `knowledge_records`, and OpenAI `integration_connections` metadata are permitted.

- [ ] **Step 1: Write failing service tests**

Require exact mapping of generated/failed content, ACTIVE/DRAFT knowledge, OpenAI status, and absence of future-domain counters.

- [ ] **Step 2: Run service test and verify RED**

```bash
npm run test:run -- src/modules/dashboard/service.test.ts
```

- [ ] **Step 3: Implement authenticated organization-scoped loader**

Use `createServerSupabaseClient()` only. Resolve `auth.getUser()`, memberships, then bounded organization-scoped count queries and latest `updated_at`. Never read script/content bodies and never use a service-role client.

- [ ] **Step 4: Write failing dashboard component tests**

Require exact values, zero handling, text status, and quick links to `/content-studio`, `/knowledge-base`, `/settings`.

- [ ] **Step 5: Run component test and verify RED**

```bash
npm run test:run -- src/app/\(app\)/dashboard/dashboard-summary.test.tsx
```

- [ ] **Step 6: Implement responsive dashboard summary**

Show only Generated content, Failed content, ACTIVE knowledge, DRAFT knowledge, OpenAI status, and last content update. For no memberships show a truthful owner-contact message with no fake membership action.

- [ ] **Step 7: Replace Dashboard page shell**

Use `dynamic = "force-dynamic"`, call `loadDashboardSummaries()`, catch loading failure to a safe operator message, and never expose raw Supabase errors.

- [ ] **Step 8: Run focused tests and verify GREEN**

```bash
npm run test:run -- src/modules/dashboard/service.test.ts src/app/\(app\)/dashboard/dashboard-summary.test.tsx
```

- [ ] **Step 9: Commit**

```bash
git add src/modules/dashboard src/app/\(app\)/dashboard
git commit -m "feat: add real-backed operations dashboard"
```

---

### Task 6: Browser verification and B2 evidence

**Files:**
- Create: `tests/e2e/active-pages.spec.ts`
- Modify: `docs/product/PAK_TRACK_B_READINESS_MATRIX.md`

- [ ] **Step 1: Add deterministic browser checks**

Verify all four active headings and workflow links. Under CI auth bypass allow only truthful empty/no-workspace fallback states; do not insert fake DB fixtures. At 390 × 844 assert document-level horizontal overflow does not occur.

- [ ] **Step 2: Run focused Playwright**

```bash
npm run test:e2e -- tests/e2e/active-pages.spec.ts
```

- [ ] **Step 3: Run the full exact-head gate**

```bash
npm run typecheck
npm run lint
npm run test:run
npm run build
npm run test:e2e
```

- [ ] **Step 4: Update only B2-owned readiness fields**

Update `/dashboard`, `/content-studio`, `/knowledge-base`, `/settings` only where evidence supports PASS/ACTIVE. Leave B3 routes blocked. Record exact SHA and verification evidence.

- [ ] **Step 5: Commit**

```bash
git add tests/e2e/active-pages.spec.ts docs/product/PAK_TRACK_B_READINESS_MATRIX.md
git commit -m "test: verify Track B B2 active pages"
```

---

### Task 7: Review, PR, exact-head CI, merge, and production smoke

- [ ] Review diff against B2 spec and trust boundaries.
- [ ] Open a dedicated PR titled `feat: reconcile active pages for production readiness`.
- [ ] Require exact-head GitHub Actions success for typecheck, lint, unit tests, build, browser install, and Playwright.
- [ ] Merge only the reviewed green head.
- [ ] Confirm Vercel production deployment is READY and points to the expected merge commit.
- [ ] Smoke `/dashboard`, `/content-studio`, `/knowledge-base`, `/settings`, root unauthenticated redirect, and recent runtime errors without destructive production mutations.
- [ ] Close B2 only when all gates are satisfied; otherwise record the exact blocker.

---

## Self-Review

- **Spec coverage:** Dashboard real-backed state, Content Studio workflow states, Knowledge Base lifecycle/read-only UX, Settings truthfulness/model safety, workflow links, RBAC, mobile, accessibility, safe errors/success, and B2 verification are each mapped to a task.
- **Placeholder scan:** No task uses fake data, placeholder links, or unspecified implementation language.
- **Type consistency:** `OPENAI_ALLOWED_MODELS`, `WorkflowLink`, `WorkflowLinks`, `DashboardOrganizationSummary`, and `loadDashboardSummaries` have one canonical role each.
- **Phase boundary:** No Phase 6+ backend workflow is introduced.
- **Security boundary:** Existing Edge/Vault trust model remains unchanged; B2 only tightens validation and UX.