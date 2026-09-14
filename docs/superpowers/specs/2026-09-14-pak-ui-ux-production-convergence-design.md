# PAK UI/UX Production Convergence — Design Specification

**Date:** 2026-09-14  
**Status:** Proposed design, awaiting implementation-plan approval  
**Branch:** `uiux/production-convergence`  
**Depends on:** `foundation/org-profile-brand-knowledge` / PR #40 at `3d0c2182f84542ed5d82d1ed5f195e19718092e6`

## 1. Purpose

PAK Marketing Automation has reached a point where the production-capable backend and workflow implementation is materially more mature than parts of the operator-visible UI suggest.

Phases 0–8 are implemented, and the Organization Profile / Brand Kit / Knowledge ingestion foundation is implementation-complete in PR #40. However, the operator experience still mixes three different maturity levels at equal visual weight:

1. fully operational workflows;
2. partially implemented/readiness workflows; and
3. future Phase 9–17 roadmap placeholders.

This creates a false impression that the product is less complete than it is, especially when implemented modules are presented beside future modules without hierarchy or when stale copy describes an implemented surface as “Foundation only”.

This convergence slice aligns the UI with the actual system without inventing product capabilities that do not exist.

## 2. Product objective

The PAK operator should immediately understand:

- what can be used in production today;
- where they are in the content-to-video workflow;
- what authoritative institutional context is being applied automatically;
- what action should happen next;
- what is blocked, stale, incomplete, queued, failed or ready;
- which capabilities are future roadmap items rather than currently usable modules.

The resulting product should feel like one coherent production console rather than a collection of independently implemented screens.

## 3. Scope

### 3.1 In scope

This slice converges only capabilities already implemented through Phase 8 plus the PR #40 foundation:

- global shell and navigation;
- Dashboard;
- Content Studio;
- Scene Planning;
- approved-shot video generation status/controls already embedded in Scene Planning;
- final video assembly status/controls already embedded in Scene Planning;
- Media Library;
- Knowledge Base;
- Settings → Organization Profile;
- Settings → Brand Kit;
- Settings → Integrations;
- truthful roadmap/readiness presentation for Phase 9–17 modules;
- responsive/mobile hierarchy for the above;
- accessibility/state clarity for the above;
- regression tests for navigation, readiness semantics, key operator journeys and status summaries.

### 3.2 Out of scope

This slice does **not** implement new domain workflows for:

- Approval Center — Phase 9;
- Publishing / Meta — Phase 10;
- Content Calendar — Phase 11;
- Analytics — Phase 12;
- AI Representative — Phase 13;
- Podcast — Phase 14;
- Campus / Locations — Phase 15;
- Student Testimonials — Phase 16;
- dedicated Manual Generation workspace — Phase 17.

It also does not:

- replace the existing RLS/RBAC model;
- change provider-secret architecture;
- weaken server-side authority boundaries;
- create new storage systems;
- expose signed URLs or storage paths as durable UI/business state;
- replace Scene Planning’s lifecycle/QC model;
- create a second approval model before Phase 9;
- create synthetic Dashboard metrics that are not backed by authoritative data.

## 4. Design principles

### 4.1 Workflow first

Operational navigation and Dashboard hierarchy must follow the real production journey:

**Create → Plan → Generate → Assemble → Manage Media**

Supporting authority remains:

**Knowledge + Organization Identity + Integrations**

Future capabilities remain visible but visually subordinate as roadmap items.

### 4.2 Truthful maturity

A route must never appear production-ready merely because it renders.

Conversely, a genuinely implemented workflow must not remain labelled “Foundation only” or otherwise appear unavailable.

### 4.3 Server authority remains unchanged

The browser may navigate with identifiers and display safe summaries, but authoritative organization, role, Profile, Brand Kit, Knowledge, lifecycle, media and provider state remains server/database resolved.

### 4.4 No duplicate domain models

The convergence layer reuses existing repositories, tables, jobs, lifecycle states and authorization. It does not introduce presentation-only copies of business state.

### 4.5 Next action over feature inventory

The UI should help the operator continue work, not merely enumerate modules.

## 5. Information architecture

### 5.1 Navigation groups

The flat primary navigation is replaced by three semantic groups.

#### Operational

1. Dashboard
2. Content Studio
3. Scene Planning
4. Media Library
5. Knowledge Base

These are the operator’s day-to-day production surfaces.

#### Administration

1. Settings

Settings remains the gateway to:

- Organization Profile;
- Brand Kit;
- Integrations.

The shell should not duplicate each Settings subsection as a top-level route unless a later UX review proves the extra density necessary.

#### Roadmap

1. Approval Center
2. Publishing
3. Content Calendar
4. Analytics
5. AI Representative
6. Podcast
7. Campus / Locations
8. Student Testimonials
9. Manual Generation

Roadmap items remain navigable and truthful, but they must not have the same visual prominence as operational modules.

### 5.2 Roadmap status semantics

Roadmap routes retain the existing readiness-page behavior.

Allowed maturity labels remain explicit:

- `Planned`
- `Foundation only`

A readiness page must continue to show:

- phase;
- current availability;
- why the workflow is unavailable;
- relevant dependency;
- implemented alternatives.

The convergence must not convert roadmap pages into fake dashboards or inert production-looking forms.

## 6. Dashboard — Production Command Center

### 6.1 Objective

Dashboard becomes the authoritative entry point for current operational state and the next useful action.

It replaces the current narrow Content/Knowledge/OpenAI summary with a broader, existing-data-backed production overview.

### 6.2 Header context

Display:

- active organization;
- current role;
- overall production-readiness summary derived from real prerequisites;
- latest meaningful activity timestamp where available.

Do not invent a numeric “health score”.

### 6.3 Institutional readiness

Display safe current state for:

- Organization Profile revision/readiness;
- Brand Kit revision/readiness;
- Core Knowledge count/readiness.

Example states:

- Profile configured / incomplete;
- Brand Kit configured / minimal;
- Core Knowledge available / none active.

The exact readiness rules must be deterministic and documented in implementation tests. They should be based on required existing fields rather than subjective scoring.

### 6.4 Content production summary

Display existing authoritative counts/statuses for:

- total content items;
- generated content;
- failed content;
- latest content activity.

Primary action: `Open Content Studio`.

### 6.5 Knowledge summary

Display:

- total Knowledge records;
- ACTIVE count;
- DRAFT count;
- Core ACTIVE count.

Primary action depends on state:

- if DRAFT > 0, `Review Knowledge drafts`;
- otherwise `Open Knowledge Base`.

### 6.6 Scene/video production summary

Use existing Phase 6–8 domain state to summarize, at minimum where existing schema/repositories make it safe and efficient:

- video projects total/recent;
- plans needing work/review or approved/current plans;
- active/failed/completed shot-generation jobs or attempts;
- final-assembly pending/running/completed/failed state;
- latest project/render activity.

The implementation plan may split this into a small number of queries/repository methods, but it must not duplicate the Scene Planning business rules.

Primary action should route to the most relevant Scene Planning state, not create new browser authority.

### 6.7 Media summary

Display authoritative Media Library counts useful to an operator, for example:

- ACTIVE assets;
- generated video/final render count where current media metadata supports it;
- uploaded/reusable assets where current origin/type fields support it.

Do not create a new analytics taxonomy solely for Dashboard cosmetics.

Primary action: `Open Media Library`.

### 6.8 Integration readiness

Display safe state for:

- OpenAI;
- LTX / Video.

Only normalized connection state and safe verified timestamp/masked metadata may be shown.

No raw secret or provider response content may reach Dashboard.

### 6.9 Continue production

Dashboard must include a compact next-action section with deterministic guidance.

Priority examples:

1. missing required institutional setup → Settings;
2. Knowledge drafts needing review → Knowledge Base;
3. no generated content → Content Studio;
4. generated content with no scene project → Content Studio/Scene Planning handoff;
5. editable/stale scene plan → Scene Planning;
6. approved plan with generation work remaining → Scene Planning;
7. shots ready for final render → Scene Planning final assembly;
8. completed render → Media Library.

Implementation must derive this only from existing authoritative state. If a safe deterministic next action cannot be resolved, fall back to direct operational shortcuts rather than guessing.

## 7. Content Studio convergence

### 7.1 Preserve existing generation workflow

The existing generation form and server-side generation path remain authoritative.

No Profile/Brand text is made browser-editable in this screen.

### 7.2 Authoritative context panel

Add a compact read-only summary explaining that generation automatically resolves:

1. Organization Profile;
2. Brand Kit;
3. ACTIVE Core Knowledge;
4. selected ACTIVE normal Knowledge;
5. optional task/additional context.

Where safe, display:

- Profile revision;
- Brand Kit revision;
- Core Knowledge count;
- selected normal Knowledge count.

This panel is explanatory and traceability-oriented, not a second settings form.

### 7.3 Knowledge selection semantics

Preserve:

- maximum 20 selected non-Core Knowledge sources;
- Core automatic grounding;
- same-org ACTIVE enforcement;
- server-side re-resolution;
- duplicate collapse;
- cross-org/non-ACTIVE rejection.

Copy must explicitly prevent the operator from assuming that zero selected normal records means zero grounding.

### 7.4 Post-generation handoff

A GENERATED canonical artifact should present a clear next action:

- create scene plan when none exists;
- continue scene planning where a project/plan exists.

The handoff must use server-resolved identifiers/revisions already supported by the existing Scene Planning architecture.

## 8. Scene Planning convergence

### 8.1 Preserve the domain model

Do not rebuild Scene Planning.

Keep existing:

- source revision/freshness;
- Visual Bible;
- versioned plan/scene/shot graph;
- manual edit/reorder;
- human-modified protection;
- AI replanning;
- QC;
- review/approval lifecycle;
- approved-shot generation;
- retries/reconciliation;
- final-render readiness;
- final assembly;
- Media Library output identity.

### 8.2 Reframe the screen hierarchy

The operator should visually read Scene Planning in four stages:

1. **Source & plan** — canonical source freshness, project/plan version, Visual Bible;
2. **Quality & approval** — QC blockers/warnings, review lifecycle, approval state;
3. **Generate** — per-shot generation readiness/progress/result state;
4. **Assemble** — final-render prerequisites, job state and final Media asset.

The stages may be represented through section headings, status strips or progressive cards; implementation should prefer minimal structural change over a complete component rewrite.

### 8.3 Brand authority clarity

Institutional Brand Kit identity and project Visual Bible must remain visibly distinct:

- Brand Kit = official organization identity/defaults;
- Visual Bible = project-specific creative direction.

A project must never appear able to replace the official organization logo.

### 8.4 Final completion state

When final assembly completes, the screen should clearly link the resulting PAK-owned asset to Media Library rather than treating the provider/worker result as the terminal user experience.

## 9. Media Library convergence

### 9.1 Production status

Media Library is an operational module, not “Foundation only”.

Any remaining stale readiness copy/tests asserting Media Library is unavailable must be removed or updated.

### 9.2 Preserve current capabilities

Retain existing:

- organization-scoped asset catalogue;
- private preview flow;
- upload workflow;
- detail/metadata/lineage;
- archive/delete boundaries;
- generated media identity;
- final-render identity;
- reuse for Brand Kit and Knowledge document ingestion.

### 9.3 Operator framing

The surface should make asset purpose easier to understand without creating a new data model.

Where supported by existing metadata, group/filter or visually distinguish:

- uploaded assets;
- institutional brand assets;
- Knowledge-source documents;
- generated shot/video assets;
- final assembled renders.

If current metadata cannot reliably identify one category, the UI must not infer it heuristically.

## 10. Knowledge Base convergence

### 10.1 Source-entry hierarchy

Make two legitimate creation paths explicit:

- `Add manually`;
- `Ingest document or URL`.

Do not maintain a visual flow that suggests manually selecting `DOCUMENT`/`URL` source type is equivalent to the authoritative ingestion path when actual extraction/provenance is required.

### 10.2 Lifecycle clarity

DRAFT and ACTIVE must be visually distinct.

Successful document/URL ingestion must continue to say, in substance:

`Draft created for review. Activate only after verifying extracted content.`

Ingestion success must never imply approval.

### 10.3 Core Knowledge

ACTIVE Core Knowledge should have a clear institutional badge and helper copy such as:

`Automatically grounded in generation.`

Authorization remains:

- OWNER/ADMIN: may mark/remove Core;
- EDITOR: may manage normal Knowledge but cannot mutate Core state;
- REVIEWER/ANALYST: read-only approved Knowledge according to existing rules.

### 10.4 Provenance

Safe source identity and revision context should remain visible where useful without exposing private object paths or signed URLs.

## 11. Settings convergence

### 11.1 Settings landing page

Settings presents three administrative domains:

1. Organization Profile;
2. Brand Kit;
3. Integrations.

Each domain card should show a safe short state summary where existing data can be loaded without exposing secrets.

### 11.2 Organization Profile

Preserve existing revision/CAS and role behavior.

OWNER/ADMIN edit.

Other authorized organization members see populated read-only state rather than hidden institutional context.

### 11.3 Brand Kit

Preserve:

- palette;
- typography;
- brand voice;
- logo usage;
- visual constraints;
- semantic Media Library asset roles;
- same-org ACTIVE image enforcement;
- Media asset IDs rather than durable signed URLs/paths.

### 11.4 Integrations

Preserve Integration Vault semantics.

Safe UI shows:

- provider;
- normalized status;
- masked hint where applicable;
- last verified time;
- allowed role-specific actions.

OpenAI and LTX remain implemented providers.

Future Meta integration remains clearly planned for Phase 10 and must not look configured/operational before that phase.

## 12. Cross-screen status language

Operational status vocabulary should be consistent and domain-correct.

Examples:

- `Draft`
- `Active`
- `Archived`
- `Generated`
- `Failed`
- `Current`
- `Stale`
- `Needs review`
- `Approved`
- `Queued`
- `Processing`
- `Retry available`
- `Ready to generate`
- `Ready to assemble`
- `Completed`
- `Not configured`
- `Disabled`

Do not collapse materially different domain states into generic labels like “Ready” where the distinction matters.

## 13. Empty, loading, error and success states

Every operational screen touched by this slice must satisfy the existing UX acceptance rule.

### 13.1 Empty

Explain why the surface is empty and provide a legitimate next action.

Examples:

- no Content → open Content Studio creation form;
- no Knowledge → add/ingest source;
- no Scene project → return to a generated Content item;
- no Media → upload or complete generation workflow.

### 13.2 Loading/pending

Async actions expose visible pending state and prevent accidental duplicate submission.

### 13.3 Error

Errors remain normalized and persistent enough to understand/retry. Provider/database internals and secrets are not shown.

### 13.4 Success

Success messages describe the actual lifecycle transition, not an exaggerated result.

Example: Knowledge ingestion says DRAFT created, not Knowledge approved.

## 14. Responsive design

### 14.1 Desktop

- grouped persistent navigation;
- command-center Dashboard cards;
- multi-column layouts where density is useful;
- workflow stages remain readable without excessive scrolling.

### 14.2 Mobile

- grouped navigation collapses accessibly;
- operational group appears before Administration/Roadmap;
- Dashboard becomes single-column with next action near the top;
- status/card layouts replace horizontal-table dependency;
- no critical action requires horizontal overflow;
- existing Content Studio, Knowledge, Settings, Scene and Media flows remain usable in modern mobile Chrome.

## 15. Accessibility

Preserve or improve the existing baseline:

- semantic headings and landmarks;
- labels associated with controls;
- keyboard-accessible navigation/disclosures;
- visible focus state;
- status expressed with text, not color only;
- pending state exposed with appropriate status semantics;
- errors associated with the affected operation/form;
- mobile-appropriate tap targets;
- read-only/disabled states remain understandable;
- grouped navigation has accessible group labels.

## 16. Data and architecture constraints

### 16.1 Dashboard aggregation

Extend the existing server-side Dashboard service/repository boundary.

The Dashboard must not make browser-side direct multi-table orchestration authoritative.

Prefer existing repositories/domain services where they already encode safe access patterns.

### 16.2 Query discipline

Dashboard/status convergence must avoid N+1 query patterns and avoid reimplementing expensive domain calculations per row.

Use bounded aggregate queries and existing indexed tenant/status columns.

Any new query introduced against production-size tables must be reviewed for organization scoping and practical index support.

### 16.3 Authorization

Navigation grouping is presentation only.

Authorization continues to be enforced by server actions, repositories, Edge boundaries and RLS/RBAC. Hidden/disabled controls never substitute for authorization.

### 16.4 Secrets/private storage

Never expose:

- Vault secrets;
- provider tokens;
- service-role credentials;
- internal worker tokens;
- raw private storage credentials;
- durable signed URLs as business state.

### 16.5 Provenance

No convergence change may weaken immutable generation/media provenance already implemented.

## 17. Testing strategy

Implementation follows TDD for changed behavior.

### 17.1 Navigation tests

Verify:

- Operational / Administration / Roadmap grouping;
- exact route presence;
- active-route behavior;
- mobile disclosure/accessibility;
- implemented modules are not marked planned/foundation;
- Phase 9–17 routes remain truthful readiness surfaces.

### 17.2 Dashboard service tests

Verify deterministic aggregation and next-action priority for representative states, including:

- missing setup;
- Knowledge drafts;
- no generated Content;
- generated Content waiting for Scene handoff;
- plan work remaining;
- generation work remaining;
- ready-to-assemble;
- completed render.

Tests must use explicit fixtures/domain rows rather than fragile text-only assertions where practical.

### 17.3 Component tests

Cover changed state hierarchy for:

- Dashboard;
- Content Studio context panel/handoff;
- Knowledge source paths/Core badge;
- Settings landing status cards;
- Scene stage framing where component-level behavior changes;
- Media Library removal of stale readiness semantics.

### 17.4 E2E

At minimum verify:

1. OWNER lands on Dashboard and sees production navigation groups;
2. operational modules are reachable and do not show planned/foundation readiness copy;
3. Content Studio → generated artifact → Scene Planning handoff remains functional;
4. Knowledge ingestion still yields DRAFT review state;
5. Media Library is an operational catalogue surface;
6. Settings exposes Organization Profile, Brand Kit and Integrations;
7. representative roadmap route remains `Planned` with no fake mutation controls;
8. REVIEWER/read-only flows do not gain mutation controls.

### 17.5 Full release gates

Before readiness claim:

- typecheck;
- lint;
- full unit suite;
- production build;
- final-assembly worker typecheck/tests/container build/smoke where repository CI requires them;
- Playwright E2E;
- exact-head CI;
- Vercel preview/runtime verification;
- no unresolved Critical/Important review findings.

## 18. Documentation updates

Implementation completion must synchronize, where affected:

- `docs/product/PAK_UI_UX_SPEC.md`;
- `docs/product/PAK_DEVELOPMENT_ROADMAP.md` only if maturity wording changes;
- `docs/product/PAK_TRACEABILITY_MATRIX.md`;
- any release/handoff documentation created for this slice.

No roadmap phase is to be marked implemented merely because navigation/readiness copy changes.

## 19. Branch and integration strategy

This slice is intentionally stacked on PR #40 because it depends on Organization Profile, Brand Kit, Core Knowledge and ingestion UI/contracts.

- PR #40 remains untouched and independently reviewable.
- `uiux/production-convergence` starts from PR #40’s reviewed exact HEAD.
- During implementation, if PR #40 merges to `main`, this branch should be rebased/merged forward using normal repository policy before final readiness verification.
- If PR #40 changes materially before merge, convergence must reconcile those changes rather than silently pinning stale assumptions.
- Do not merge the convergence slice before its dependency is integrated or the PR base is intentionally retargeted with verified clean diff.

## 20. Acceptance criteria

The convergence is complete only when all of the following are true:

1. Operational navigation contains Dashboard, Content Studio, Scene Planning, Media Library and Knowledge Base as first-class modules.
2. Settings is clearly separated as Administration.
3. Phase 9–17 items are grouped as Roadmap and retain truthful readiness behavior.
4. No implemented Phase 0–8 workflow is described as unavailable/foundation-only in the operator UI.
5. Dashboard reflects existing production domains beyond Content/Knowledge/OpenAI without synthetic metrics.
6. Dashboard offers deterministic, safe next-action guidance or explicit operational shortcuts.
7. Content Studio explains automatic Profile/Brand/Core grounding without exposing authoritative identity as editable generation input.
8. Scene Planning clearly communicates source/plan, QC/approval, generation and assembly stages without altering domain lifecycle authority.
9. Final assembled output links into the PAK-owned Media Library workflow.
10. Media Library is presented as operational and preserves tenant-safe private asset handling.
11. Knowledge Base clearly distinguishes manual entry from authoritative document/URL ingestion, DRAFT review from ACTIVE approval and Core from normal Knowledge.
12. Settings clearly exposes Profile, Brand Kit and Integrations with correct role behavior.
13. No new browser authority, secret exposure, storage-path persistence or provenance weakening is introduced.
14. Empty/loading/error/success states remain truthful and actionable.
15. Desktop and mobile critical flows remain usable and accessible.
16. Changed behavior has RED → GREEN regression coverage.
17. Full exact-head CI and required preview/runtime verification are green before the slice is called merge-ready.
18. No Lovable change or credit usage occurs.

## 21. Success definition

After this convergence, an operator should be able to open PAK and immediately perceive the actual maturity of the system:

- create grounded multilingual content;
- carry it into structured scene planning;
- generate approved shots;
- assemble final video;
- inspect/reuse PAK-owned media;
- manage trusted Knowledge;
- manage institutional Profile/Brand and provider integrations;
- distinguish clearly between usable production workflows and future roadmap modules.

The product should look and behave like the Phase 8+ system it already is, without pretending that Phase 9–17 functionality exists before it is actually implemented.
