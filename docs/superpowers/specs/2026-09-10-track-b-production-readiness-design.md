# PAK Marketing Automation — Track B Production-Readiness Reconciliation Design

**Date:** 10 September 2026  
**Workstream:** Track B — Production-Readiness Reconciliation  
**Status:** Proposed for user review  
**Scope:** Application-wide UI/UX, navigation, workflow truthfulness, RBAC-aware interaction states, and page-level production readiness.  
**Out of scope:** Implementing future roadmap business subsystems ahead of their approved phases.

## 1. Purpose

Track B reconciles the visible PAK application with the governing product baseline so that every route is honest, useful, connected, secure, responsive, and operationally understandable.

The governing principle is that a route rendering is not sufficient. A production-ready screen must either:

1. implement its currently approved primary workflow completely; or
2. clearly present the module as not yet enabled, explain the prerequisite/dependency, and provide useful navigation to the nearest implemented workflow without exposing fake controls or implying backend capability that does not exist.

This workstream preserves the roadmap. It must not pull Phase 6+ domain implementation forward merely to make placeholder routes look complete.

## 2. Governing sources

Track B is subordinate to and must remain consistent with:

- `docs/product/PAK_MASTER_PRD.md`
- `docs/product/PAK_MASTER_TRD.md`
- `docs/product/PAK_UI_UX_SPEC.md`
- `docs/product/PAK_BACKEND_SCHEMA.md`
- `docs/product/PAK_SYSTEM_WORKFLOWS.md`
- `docs/product/PAK_INTEGRATION_SPEC.md`
- `docs/product/PAK_DEVELOPMENT_ROADMAP.md`
- `docs/product/PAK_TRACEABILITY_MATRIX.md`
- `docs/product/PAK_EXISTING_IMPLEMENTATION_GAP_AUDIT.md`

If Track B discovers a conflict between visible UI and these sources, the governing baseline wins unless the baseline itself is intentionally revised through a separate approved change.

## 3. Current route inventory

The current application shell exposes the following fourteen primary modules in fixed navigation order:

1. Dashboard
2. Content Studio
3. AI Representative
4. Campus / Locations
5. Podcast
6. Manual Generation
7. Student Testimonials
8. Media Library
9. Knowledge Base
10. Content Calendar
11. Approval Center
12. Publishing
13. Analytics
14. Settings

The shell must continue to preserve this navigation order unless the baseline documentation is explicitly changed.

## 4. Architectural approach

### 4.1 Reconciliation, not rewrite

Existing implemented workflows that already satisfy the baseline are preserved. Track B changes only what is required to close user-facing production-readiness gaps.

### 4.2 Shared production-readiness layer

Cross-cutting UX behavior should be implemented through reusable shell/page primitives rather than independently re-created on every route. Likely reusable concerns include:

- page header with title, description, active organization, and role context where relevant;
- consistent status labels;
- empty-state component with explanation and next action;
- unavailable-module state for future roadmap modules;
- persistent form/server error region;
- breadcrumb/back-link pattern for drill-down workflows;
- accessible navigation active state;
- responsive page container and action layout;
- confirmation pattern for destructive actions;
- async action state pattern: idle/submitting/success/failed.

The implementation plan may split these into smaller focused components if existing shell architecture supports that cleanly.

### 4.3 Truthful future-module behavior

Future-phase modules must not contain fake Create, Generate, Approve, Publish, Sync, Upload, or Schedule actions unless their backend workflows actually exist and are authorized for the current release phase.

Instead they receive a production-quality unavailable state containing:

- module name and intended purpose;
- current readiness status such as `Planned` or `Requires prerequisite workflow`;
- concise explanation of what is not active yet;
- prerequisite or upstream dependency where meaningful;
- link to a currently implemented related workflow such as Content Studio, Knowledge Base, Media Library, or Settings;
- no fictitious progress percentages, counts, jobs, provider health, or sample production data.

This is a product-truthfulness requirement, not a cosmetic placeholder treatment.

## 5. Module readiness classes

Track B classifies routes before modifying them.

### Class A — implemented workflows requiring production polish

Current examples include:

- Content Studio
- Knowledge Base
- Settings → Integrations
- Authentication and organization context surfaces supporting the above

These pages are audited against their full UX acceptance criteria including loading, empty, error, success, authorization and responsive states.

### Class B — partial foundation requiring honest boundary treatment

Current examples may include:

- Dashboard
- Media Library
- Manual Generation

For these, Track B may expose only the parts already backed by real data and routes. Missing backend capabilities remain visibly unavailable rather than being simulated.

### Class C — future roadmap modules

Current roadmap/gap-audit examples include:

- Scene Planning until Phase 6 begins
- AI Representative
- Campus / Locations
- Podcast
- Student Testimonials
- Content Calendar
- Approval Center
- Publishing
- Analytics

Track B does not implement these domains. It provides coherent, accessible, dependency-aware module states so the shell no longer overstates completeness.

The exact classification for each route will be recorded in the Track B audit matrix before code changes are accepted.

## 6. Global shell requirements

The application shell must satisfy the following user-visible behavior:

### 6.1 Identity and context

Authenticated workspace screens must make the active organization clear. Where role-sensitive actions are present, the user role must be understandable without exposing internal authorization implementation details.

### 6.2 Navigation

- all primary navigation links resolve to valid application routes;
- current route is visibly and programmatically identifiable;
- mobile navigation is usable without horizontal dependency;
- navigation does not expose a control that leads to a broken page;
- unavailable future modules may remain navigable if their page truthfully explains readiness and dependencies;
- authorization remains enforced server/database-side even if controls are hidden or disabled for UX.

### 6.3 Backlinks and workflow continuity

Backlinks are required where a user has moved from a parent workflow into a detail/configuration workflow. Examples include:

- Settings subsection → Settings overview where applicable;
- content artifact/detail → Content Studio;
- source/provenance inspection → originating content item;
- future modules → nearest implemented prerequisite workflow.

Primary top-level routes do not require synthetic browser-style Back buttons when the persistent navigation already supplies context. Backlinks should serve workflow continuity, not duplicate navigation mechanically.

### 6.4 Error and async behavior

Every user-triggered async operation must expose a durable visible state. Toast-only success/error is insufficient for a workflow-critical action.

Safe error copy must not leak raw database/provider errors, tokens, API keys, stack traces, request bodies, or sensitive identifiers.

### 6.5 Accessibility and mobile

Track B acceptance includes:

- semantic labels for inputs and controls;
- keyboard reachable navigation/actions;
- text status in addition to color;
- readable tap targets on modern mobile Chrome;
- no critical action requiring horizontal scrolling;
- focus handling for dialogs/confirmations where used;
- field-level validation association where practical.

## 7. Page-level acceptance model

Every primary route receives an audit record covering these fields:

| Field | Required decision |
|---|---|
| Route | Exact route |
| Module | Product module |
| Roadmap phase | Approved implementation phase |
| Current implementation class | Implemented / Partial / Future |
| Primary user goal | What the user is supposed to accomplish |
| Data source | Real DB/provider data or none |
| RBAC | Roles that can read/mutate |
| Loading state | Defined and usable |
| Empty state | Explains meaning and next step |
| Error state | Safe, persistent, actionable |
| Success state | Visible and unambiguous |
| Primary action | Real action only |
| Secondary action | Real action only |
| Backlink/upstream link | Required where workflow continuity benefits |
| Downstream link | Next valid workflow step only |
| Mobile behavior | Verified |
| Accessibility | Baseline verified |
| Dead-link result | None permitted |
| Fake-control result | None permitted |
| Production readiness | PASS / BLOCKED with reason |

No page can be declared production-ready without this record.

## 8. Implemented-module requirements

### 8.1 Content Studio

Track B verifies and, where required, corrects:

- organization context;
- topic and canonical language labels;
- ACTIVE Knowledge source selector behavior;
- explicit useful zero-source state with a link to Knowledge Base when the current role can manage sources;
- 20-source selection limit visibility;
- generation pending/duplicate-submit protection;
- persistent provider/generation failure state;
- generated source artifact state;
- EN/PL/HI artifact state and stale translation behavior;
- source/provenance visibility when source snapshots exist;
- no fake-provider wording in live production paths;
- appropriate link to Settings when OpenAI is missing/invalid and role permits configuration.

### 8.2 Knowledge Base

Track B verifies and, where required, corrects:

- meaningful empty state;
- create/edit lifecycle actions only for authorized roles;
- DRAFT/ACTIVE/ARCHIVED state clarity;
- stale revision conflict message;
- read-only experience for REVIEWER/ANALYST;
- link back to Content Studio where ACTIVE sources are intended for generation;
- no full Knowledge content dumped into selectors unnecessarily.

### 8.3 Settings

Track B verifies and, where required, corrects:

- Organization / Members / Integrations / Operational configuration sections are represented truthfully;
- incomplete subsections do not masquerade as functional management tools;
- Integration cards show status, last verified, safe metadata and supported actions;
- secret inputs remain write-only;
- test connection state is persistent and safe;
- missing membership has actionable UX rather than a dead-end technical message;
- supported role behavior is explicit.

### 8.4 Dashboard

Dashboard must display only metrics/activity backed by implemented data. Missing future-domain counts must not be invented.

If current durable data cannot yet support all baseline action cards, the dashboard must distinguish active metrics from modules not yet enabled and route the user to valid workflows.

## 9. Future-module page standard

A future-module page must include:

1. page title;
2. concise product-purpose description derived from the governing UX/PRD baseline;
3. readiness badge/status;
4. dependency or roadmap explanation in plain operational language;
5. one or two valid related links, never a dead-end;
6. no dummy production data;
7. no interactive primary CTA that suggests the future workflow is already implemented;
8. mobile and accessible layout equal in quality to implemented pages.

The page must avoid developer-centric copy such as raw phase numbers as the only explanation. Roadmap phase may appear as secondary metadata, but the primary message must be understandable to an operator.

## 10. RBAC and tenant isolation

Track B may improve UX around authorization but may not weaken or replace database/server authorization.

Rules:

- organization membership remains server-derived;
- unauthorized mutation controls are removed/disabled only as a UX layer;
- same-org data boundaries remain RLS-controlled;
- no privileged/admin client is introduced into browser code;
- no service-role or Vault secret is exposed to the UI;
- cross-org negative probes remain mandatory if Track B changes any security-sensitive query/mutation path.

## 11. Data and backend change policy

Track B is primarily reconciliation. Database migrations are allowed only when a UI acceptance requirement cannot be satisfied with the approved existing data model and the change is already within an implemented roadmap phase.

Track B must not create backend tables for future modules merely to make their pages look more complete.

Any schema change requires:

- explicit mapped requirement;
- forward-only migration;
- RLS/privilege review;
- structural tests;
- live Supabase negative probes where security-sensitive.

## 12. Testing strategy

All behavior changes follow TDD.

Required verification layers:

### Unit/component

- navigation active-state behavior;
- shared empty/unavailable/error components;
- RBAC-conditioned actions;
- page-specific state rendering;
- no fake actions on future modules;
- correct links/backlinks.

### Static/navigation integrity

A route/link integrity test should verify that internal application links used by the shell and Track B page states target existing routes and do not use placeholder destinations such as `#`.

### Build/type/lint

Every PR head must pass:

- typecheck;
- lint with no new errors;
- unit/component tests;
- production build.

### E2E

Playwright coverage must include at minimum:

- unauthenticated redirect;
- authenticated shell navigation on desktop-sized viewport;
- mobile navigation;
- Content Studio empty/success/error-relevant surfaces where deterministic fixtures allow;
- Knowledge Base navigation and empty/list state;
- Settings integrations route;
- representative future-module unavailable-state navigation;
- no broken primary navigation route.

### Live runtime

After exact-green merge and deployment:

- production route smoke for all fourteen modules;
- no new Vercel runtime errors;
- authenticated manual/browser verification for user-visible implemented workflows where credentials/session are available;
- live Supabase probes only where Track B changes authorization/data boundaries.

## 13. Delivery decomposition

Track B will be implemented in small reviewable slices, not one large uncontrolled PR.

Recommended sequence:

### Slice B1 — Audit matrix and global shell

- generate current route-by-route readiness matrix;
- active navigation state;
- shared page/empty/unavailable/error primitives where justified;
- internal-link integrity tests;
- mobile shell verification.

### Slice B2 — Implemented workflow polish

- Content Studio;
- Knowledge Base;
- Settings;
- Dashboard data truthfulness.

### Slice B3 — Partial/future route reconciliation

- Media Library and Manual Generation partial-state treatment;
- AI Representative;
- Campus / Locations;
- Podcast;
- Student Testimonials;
- Content Calendar;
- Approval Center;
- Publishing;
- Analytics;
- Scene Planning only as a future/dependency state until its separate Phase 6 workstream begins.

### Slice B4 — full route verification and release

- cross-route E2E;
- responsive verification;
- final gap-matrix closure;
- exact-green merge/deployment;
- live production smoke.

Each slice can be a separate PR if that reduces review and regression risk.

## 14. Explicit non-goals

Track B does not:

- implement Scene Planning domain logic;
- implement video generation providers;
- implement Approval Center backend workflow;
- implement Meta publishing;
- implement analytics synchronization;
- implement podcast generation;
- implement AI representative generation;
- implement testimonial consent storage;
- implement campus/location domain storage;
- create fake/sample operational data merely to populate screens;
- alter the fixed module order without baseline approval;
- touch Lovable or any Lovable-attached Supabase project.

## 15. Definition of done

Track B is complete only when:

- all fourteen primary routes resolve successfully;
- every route has a recorded readiness classification;
- implemented pages meet their currently approved UX acceptance criteria;
- future pages clearly communicate unavailable/dependency state without fake functionality;
- internal links and backlinks are valid and intentional;
- no placeholder `#` links or dead primary actions remain;
- active organization/workspace context is consistently understandable;
- desktop and mobile navigation are verified;
- no secrets/sensitive provider data are exposed;
- all Track B tests, typecheck, lint and production build pass on exact PR heads;
- applicable Playwright E2E passes;
- production deployment is verified route-by-route with no new runtime errors;
- the Track B audit matrix contains no unresolved P0 production-readiness blockers.

## 16. Design decision summary

Track B treats production readiness as **workflow truthfulness plus operational usability**, not visual decoration. Implemented capabilities are polished to complete journeys; unimplemented roadmap capabilities are presented honestly and connected to useful prerequisites. Shared shell primitives reduce inconsistency, while backend scope remains constrained by the approved roadmap and security boundaries.
