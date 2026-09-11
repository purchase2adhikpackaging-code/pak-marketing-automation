# Track B B2 — Active Pages Production Readiness Implementation Plan

> **Execution mode:** superpowers:executing-plans with TDD and exact-head verification.

**Goal:** Reconcile Dashboard, Content Studio, Knowledge Base, and Settings so their production UI is truthful, useful, role-aware, mobile-usable, and backed only by existing implemented data/workflows.

**Architecture:** Preserve the current Next.js App Router, Supabase RLS model, organization membership model, Integration Vault, and Vault-backed OpenAI generation path. B2 is a reconciliation/polish slice, not a backend rewrite. No Phase 6+ domain functionality is introduced.

## Global constraints

- No Lovable changes or Lovable credits.
- No new service-role exposure in Next/Vercel.
- No plaintext provider credentials in props, logs, UI, or tests.
- Keep organization and actor resolution server-side.
- Do not weaken RLS/RBAC.
- Do not create fake dashboard metrics or future-domain counts.
- All behavior changes follow RED → GREEN TDD.
- Exact PR head must pass typecheck, lint, Vitest, build, and Playwright before merge.

## Task 1 — Dashboard real-backed operational summary

**Files:**
- Modify: `src/app/(app)/dashboard/page.tsx`
- Add: `src/app/(app)/dashboard/dashboard-summary.tsx`
- Add: `src/app/(app)/dashboard/dashboard-summary.test.tsx`
- Add or modify a small server-only dashboard query module if needed.

**Acceptance:**
- Show only current implemented-domain information backed by Supabase: organization context, content items, Knowledge Base records, and integration readiness.
- No Approval, Publishing, Analytics, Podcast, AI Representative, Calendar, Campus, Testimonial, or video counts.
- Useful links to Content Studio, Knowledge Base, Settings.
- Zero-data state is explanatory rather than blank.
- Query failures render a safe operational-unavailable state without raw database/provider details.

**TDD:**
1. Write component tests for populated, empty, and safe-error states plus real workflow links.
2. Observe RED.
3. Implement minimal server query/view-model and component.
4. Verify focused tests GREEN.

## Task 2 — Content Studio production-readiness polish

**Files:**
- Modify: `src/app/(app)/content-studio/page.tsx`
- Modify: `src/app/(app)/content-studio/content-studio-form.tsx`
- Modify: `src/app/(app)/content-studio/knowledge-selector.tsx`
- Modify relevant tests.

**Acceptance:**
- When there are no eligible organizations, do not render a misleading usable generation form.
- Zero ACTIVE Knowledge Base sources provides a real link to `/knowledge-base`.
- Generation failures remain persistent and include a safe Settings link for provider/configuration recovery where appropriate, without exposing provider internals.
- Pending state is programmatically announced and primary controls remain disabled while generation is in flight.
- 20-source limit remains visible.
- Successful canonical generation clearly exposes provider/model metadata only if already safe/persisted.
- Existing multilingual stale/failed/retry behavior remains intact.

**TDD:**
1. Add tests for no-org state, zero-KB link, pending state, and safe recovery links.
2. Observe RED.
3. Implement minimum UI changes without changing the generation trust boundary.
4. Verify Content Studio tests GREEN.

## Task 3 — Knowledge Base workflow feedback and destructive confirmation

**Files:**
- Modify: `src/app/(app)/knowledge-base/page.tsx`
- Modify: `src/app/(app)/knowledge-base/knowledge-base-manager.tsx`
- Modify tests.

**Acceptance:**
- Clear organization/role context.
- Meaningful empty state with a Content Studio link where appropriate.
- Create/update/activate/archive/delete expose persistent pending/success/error feedback.
- Delete requires explicit confirmation before the server action is called.
- REVIEWER/ANALYST remain ACTIVE-only read-only.
- Existing revision-conflict safe error remains unchanged.
- No horizontal-layout dependency on mobile.

**TDD:**
1. Add tests proving delete does not execute before confirmation and success state is visible.
2. Add tests for empty-state workflow link and role context.
3. Observe RED.
4. Implement minimal UI state/confirmation.
5. Verify GREEN.

## Task 4 — Settings integration truthfulness and model defense-in-depth

**Files:**
- Modify: `src/modules/integrations/schema.ts`
- Modify: `src/modules/integrations/schema.test.ts`
- Modify: `src/app/(app)/settings/page.tsx`
- Modify: `src/app/(app)/settings/integrations/integrations-manager.tsx`
- Modify relevant tests.

**Acceptance:**
- OpenAI model is selected from the same production allowlist currently accepted by generation: `gpt-5.6-luna`, `gpt-5.6-terra`.
- Server-side schema rejects unsupported OpenAI `defaultModel`, even if client controls are bypassed.
- UI uses a select control, not arbitrary model text input.
- Missing organization membership remains an actionable state.
- Connection test/save/disable/remove pending and result states remain persistent.
- Destructive credential removal requires confirmation.
- Only safe metadata is displayed; secret input remains blank/write-only.
- Planned Meta/LTX cards remain clearly planned, with no fake actions.

**TDD:**
1. Add schema test rejecting an unsupported OpenAI model.
2. Add manager tests for model select and remove-key confirmation.
3. Observe RED.
4. Implement schema refinement and UI changes.
5. Verify focused tests GREEN.

## Task 5 — Browser-level B2 journeys

**Files:**
- Add/modify `tests/e2e/dashboard.spec.ts`
- Modify `tests/e2e/content-studio.spec.ts`
- Modify `tests/e2e/knowledge-base.spec.ts`
- Add/modify `tests/e2e/settings.spec.ts`

**Acceptance:**
- Dashboard renders real workflow links and truthful empty/operational state under E2E bypass.
- Content Studio no-org/zero-KB states do not expose misleading successful actions.
- Knowledge Base and Settings surface their role/state messaging without dead controls.
- 390×844 viewport has no critical workflow dependency on horizontal scrolling.

## Task 6 — Readiness matrix and release gate

**Files:**
- Modify `docs/product/PAK_TRACK_B_READINESS_MATRIX.md`

**Steps:**
1. Update only B2-owned fields with verified PASS/ACTIVE/BLOCKED decisions.
2. Run `npm run typecheck`.
3. Run `npm run lint`.
4. Run `npm run test:run`.
5. Run `npm run build`.
6. Run `npm run test:e2e`.
7. Open a dedicated B2 PR.
8. Verify CI on exact head.
9. Review PR patch for security/regression scope.
10. Merge only exact green head, then verify Vercel READY and production runtime smoke.

## Definition of Done

- Dashboard contains no invented future-domain metrics.
- Content Studio, Knowledge Base, and Settings expose useful empty/error/success/pending states and valid workflow links.
- OpenAI model configuration is constrained in both UI and server schema.
- Credential deletion and Knowledge Base deletion require explicit confirmation.
- Existing Vault, OpenAI, RLS, RBAC, provenance, and quota trust boundaries are unchanged.
- Desktop and mobile primary workflows pass browser verification.
- Exact B2 PR head is green across full CI.
