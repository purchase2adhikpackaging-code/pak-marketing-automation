# Track B B2 — Active Pages Production Readiness Design

**Status:** Proposed for written-spec review  
**Date:** 10 September 2026  
**Branch:** `track-b/b2-active-pages-readiness`  
**Governing baseline:** `PAK_MASTER_PRD.md`, `PAK_MASTER_TRD.md`, `PAK_UI_UX_SPEC.md`, `PAK_DEVELOPMENT_ROADMAP.md`, `PAK_TRACEABILITY_MATRIX.md`, `PAK_EXISTING_IMPLEMENTATION_GAP_AUDIT.md`, and the approved Track B production-readiness design.

## 1. Purpose

B2 reconciles the currently implemented/active operator surfaces with the governing UX and production-readiness requirements without pulling later roadmap functionality forward.

B2 covers exactly these four routes:

- `/dashboard`
- `/content-studio`
- `/knowledge-base`
- `/settings`

The goal is not a redesign or subsystem rewrite. The goal is to make the existing implemented workflows truthful, navigable, role-aware, responsive, accessible, and operationally understandable.

## 2. Architectural approach

Use reconciliation-first enhancement.

- Preserve existing Next.js App Router architecture, server-side authentication, Supabase RLS, domain services, server actions, Integration Vault, and OpenAI generation boundaries.
- Do not reimplement working Phase 2–5 business logic.
- Add only missing presentation/state/navigation behavior required for production readiness.
- Dashboard may use only real data that already exists and is safely queryable under current tenant/RBAC boundaries.
- Future domains must not contribute invented counts, health, activity, or fake actions.
- No database migration is expected for B2 unless implementation reveals an existing-phase requirement that cannot be satisfied safely otherwise; any such discovery upgrades scope and requires explicit design reconciliation before migration work.

## 3. Global B2 UX contract

Each covered page must clearly communicate:

1. current organization context;
2. effective role or permission posture where relevant;
3. what the user can do now;
4. what prerequisite is missing when an action cannot proceed;
5. loading/pending state for async work;
6. persistent error feedback for failed operations;
7. persistent or clearly announced success feedback for completed mutations;
8. valid upstream/downstream links that match the real workflow;
9. mobile usability without critical horizontal scrolling;
10. accessible labels, status text, focusable controls, and non-color-only state communication.

Critical workflow failures must not be toast-only. Secrets, provider payloads, raw database errors, and privileged identifiers must not be surfaced.

## 4. Dashboard design

### 4.1 Purpose

Convert the current descriptive shell into a real operational launchpad for the implemented system.

### 4.2 Allowed data

Dashboard may show only metrics/statuses backed by existing Phase 1–5 data and current authenticated organization membership. Suitable examples include:

- active organization name;
- current role;
- Knowledge Base record counts/status summary if existing queries can provide them without weakening authorization;
- Content Studio content/artifact counts or recent generation summary only if already-backed tables and current RLS make the query safe;
- OpenAI integration status/verification health from safe Integration Vault metadata;
- direct links to Content Studio, Knowledge Base, and Settings.

### 4.3 Prohibited dashboard content

Do not display fabricated or zero-filled future-domain metrics for Approval Center, Publishing, Calendar, Analytics, Podcast, AI Representative, Testimonials, Campus/Locations, Scene Planning, or video generation.

Do not imply a future workflow is operational merely because its route exists.

### 4.4 Dashboard states

- No membership: actionable membership-unavailable state; no fake dashboard data.
- One or more organizations: select or consistently derive an organization using the same safe membership context pattern used elsewhere.
- Loading is primarily server-rendered; any client transitions introduced must expose pending state.
- Query failure: safe persistent error region with links to still-usable implemented modules when possible.
- Success: real summary cards plus workflow launch links.

## 5. Content Studio design

Preserve current generation, provenance, multilingual artifact, Vault-backed OpenAI, quota, and authorization flows.

B2 adds:

- explicit organization/permission context;
- valid links to Knowledge Base and Settings;
- zero-ACTIVE-source guidance with a Knowledge Base link when the user can access it;
- clear explanation that supplemental context is optional and not a replacement for approved grounding;
- persistent `role="alert"` failure state for generation errors;
- accessible pending/generating state beyond button text where useful;
- clear generated-success state and next valid operator action;
- no Phase 6 Scene Planning CTA until Phase 6 is actually enabled;
- mobile verification of form, result workspace, and multilingual artifact controls.

When OpenAI is missing, disabled, invalid, or otherwise unavailable, the page should present a safe actionable route to Settings only for users who can reasonably act on it; otherwise provide a neutral administrator-contact instruction without leaking provider details.

## 6. Knowledge Base design

Preserve existing CRUD, lifecycle status, optimistic revision checks, server authorization, and RLS behavior.

B2 adds:

- explicit organization and role context;
- meaningful zero-record state;
- clear distinction between DRAFT, ACTIVE, and ARCHIVED status;
- persistent mutation success feedback;
- persistent mutation error feedback;
- clear pending state while a mutation is running;
- confirmation before destructive delete;
- read-only messaging for REVIEWER/ANALYST that clearly states what remains available;
- downstream Content Studio link when approved ACTIVE grounding exists or when the workflow context makes the link useful;
- mobile-friendly action groups and record layout.

No client-only permission decision may replace server/DB authorization.

## 7. Settings design

B2 treats Integrations as the implemented Settings capability and must not fabricate Organization, Members, or Operational sections.

B2 adds:

- explicit organization and role context;
- clear statement that Integrations is the currently enabled settings area;
- Content Studio backlink;
- safe provider health display using existing metadata only;
- pending action text/state for save key, save model, test connection, enable/disable, and remove key operations;
- persistent success and failure status;
- confirmation before API key removal;
- confirmation before disabling a configured provider;
- model control constrained to the runtime-supported allowlist: `gpt-5.6-luna` and `gpt-5.6-terra`;
- clear read-only experience for roles without `settings:manage`;
- mobile-friendly provider card/action layout.

Secrets remain write-only. Browser state must never contain stored plaintext credentials.

## 8. Shared components and reuse

Prefer small reusable presentation primitives only where they reduce duplication without hiding domain semantics. Candidate primitives include:

- page context/header block;
- inline workflow links;
- persistent status/alert region;
- role/status badge;
- empty-state card.

Do not introduce a generic framework that forces all pages into one abstraction. Domain-specific behavior stays inside each existing page/module.

## 9. RBAC and tenancy

B2 must preserve all existing trust boundaries:

- authenticated user-scoped Supabase client in Next.js;
- server-derived membership context;
- organization-scoped reads and mutations;
- existing `can(...)` authorization semantics;
- RLS as final data boundary;
- service role only inside approved Supabase Edge runtime;
- Vault plaintext never returned to browser;
- OpenAI key never moved into Vercel environment or client code.

If B2 changes a security-sensitive query or action, add a negative test proving unauthorized/cross-org access still fails.

## 10. Accessibility and mobile acceptance

For all four routes:

- semantic page headings and form labels;
- keyboard-operable controls;
- `role="alert"` for errors and appropriate live/status semantics for async success/pending states;
- disabled controls communicate why they are unavailable in nearby text where the reason is not obvious;
- status is communicated with text, not color only;
- destructive actions require confirmation;
- modern mobile Chrome at approximately 390 × 844 must support the primary journey without critical horizontal scrolling.

## 11. Testing strategy

B2 follows TDD.

Unit/component tests must cover, as applicable:

- Dashboard renders only real implemented-domain cards/links;
- Dashboard has no future-domain fake KPI cards/actions;
- Content Studio zero-source and provider-unavailable guidance;
- Content Studio persistent error and pending/success semantics;
- Knowledge Base empty/read-only/success/error/pending states;
- Knowledge Base delete confirmation;
- Settings role-aware read-only/manage states;
- Settings model allowlist;
- Settings remove/disable confirmations;
- internal links have valid routes and no `#` placeholders.

E2E must cover desktop and mobile primary journeys for all four routes under existing test auth setup. Live production verification after merge must check route rendering and absence of new runtime errors. Supabase probes are required only if B2 changes security/data boundaries.

## 12. Delivery decomposition

B2 should be implemented in small reviewable tasks:

1. shared page-context/status primitives only if justified by repeated need;
2. Dashboard real operational summary;
3. Content Studio production UX reconciliation;
4. Knowledge Base production UX reconciliation;
5. Settings production UX reconciliation;
6. cross-route desktop/mobile E2E and readiness-matrix update;
7. whole-diff review and exact-head CI gate.

## 13. Non-goals

B2 does not implement:

- Scene Planning;
- video generation/providers;
- Media Library completion;
- Approval Center backend;
- Publishing adapters;
- Content Calendar scheduling;
- Analytics synchronization;
- AI Representative;
- Podcast generation;
- Campus/Locations storage;
- testimonial consent/storage;
- Manual Generation completion;
- new provider secret architecture;
- Lovable dependencies or Lovable-attached Supabase changes.

## 14. Definition of done

B2 is complete only when:

- all four routes have truthful organization/role/workflow context;
- Dashboard uses real implemented-domain data only;
- Content Studio has actionable prerequisite/error/success guidance;
- Knowledge Base has complete empty/read-only/error/success/pending/destructive-confirmation UX;
- Settings exposes truthful Integration-only capability, safe status, confirmations, and model allowlist;
- all internal links are valid;
- no future-domain fake KPI/action is introduced;
- mobile and desktop primary journeys pass Playwright;
- typecheck, lint, full Vitest, production build, and E2E are green on the exact PR head;
- Track B readiness matrix is updated only for evidence actually verified;
- no unresolved P0/P1 issue remains inside B2 scope.