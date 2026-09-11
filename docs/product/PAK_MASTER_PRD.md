# PAK Marketing Automation — Master Product Requirements Document (PRD)

**Document ID:** PAK-PRD-001  
**Version:** 1.1  
**Status:** Current baseline after Phase 7  
**Product:** Polska Akademia Kolejnictwa (PAK) Marketing Automation  
**Primary users:** PAK marketing, communications, reviewers, analysts, administrators and owners

## 1. Product purpose

PAK Marketing Automation is a multi-tenant-ready internal marketing operating system for planning, generating, reviewing, producing, publishing and measuring multilingual railway-industry content. The product combines approved institutional knowledge, AI-assisted content generation, versioned scene planning, provider-backed media generation, approval workflows, publishing integrations, campaign scheduling and analytics without exposing organization data or provider secrets to unauthorized users.

The post-Phase 7 baseline has a production-grade content/knowledge/scene-planning/video-generation core. Approval Center, final video assembly, full Media Library operations, publishing, calendar, analytics and the specialized content modules remain roadmap work.

## 2. Product principles

- **PRD-GEN-001 — Grounded by default.** AI-generated institutional content must use explicitly approved PAK Knowledge records plus optional user-supplied context.
- **PRD-GEN-002 — Human control.** AI output remains editable and must never be externally published without an explicit policy/approval path.
- **PRD-GEN-003 — Traceable output.** Generated content must retain immutable generation-time provenance for selected approved Knowledge records.
- **PRD-GEN-004 — Multilingual first.** Canonical content and translations support EN, PL and HI in the initial product baseline.
- **PRD-GEN-005 — Tenant isolation.** Every organization-owned resource is organization-scoped and protected by database authorization.
- **PRD-GEN-006 — Server-side secrets.** Provider credentials must never be exposed back to browser clients after storage.
- **PRD-GEN-007 — Durable workflows.** Long-running generation, video, publishing and synchronization operations use durable jobs with retry/failure states.
- **PRD-GEN-008 — Evidence-based release.** Features are complete only when implementation, automated tests and required runtime verification are green.
- **PRD-GEN-009 — Authoritative state.** Browser state never overrides authoritative database workflow, approval, source-integrity or tenant state.

## 3. Current implementation snapshot

| Capability | Current product state |
|---|---|
| Authentication, organization membership, RBAC/RLS | Implemented |
| Knowledge Base lifecycle and provenance | Implemented |
| Content Studio grounded canonical generation | Implemented |
| EN/PL/HI artifacts and stale/regeneration workflow | Implemented |
| Integration Vault — OpenAI | Implemented |
| Integration Vault — LTX | Implemented |
| Scene Planning, Visual Bible, QC, review and approval | Implemented |
| Approved-shot LTX generation, retry/reconciliation, private media import | Implemented; paid provider acceptance awaits an org credential/credits |
| Media Library operator catalogue/upload/detail UX | Partial foundation |
| Final assembled video render | Missing — Phase 8 |
| Generic Approval Center | Missing — Phase 9 |
| Publishing / Meta | Missing — Phase 10 |
| Content Calendar | Missing — Phase 11 |
| Analytics | Missing — Phase 12 |
| AI Representative / Podcast / Campus / Testimonials | Missing — Phases 13–16 |
| Manual Generation completion | Partial foundation — Phase 17 |

This table reports implementation maturity only. Requirements below remain normative even when roadmap implementation is pending.

## 4. User roles

### PRD-RBAC-001 OWNER
Full organization administration, integrations, members, content, approval, publishing, analytics, Knowledge and destructive actions.

### PRD-RBAC-002 ADMIN
Operational administration equivalent to OWNER except ownership-only governance functions that may be added later.

### PRD-RBAC-003 EDITOR
Create/edit content, manage Knowledge records, generate AI artifacts, plan scenes, initiate approved-shot media generation, use media tools and view analytics. No destructive organization ownership operations.

### PRD-RBAC-004 REVIEWER
Read approved Knowledge, review generated content and Scene Plans, approve/reject where explicitly authorized, acknowledge review warnings where allowed and view analytics. No Knowledge mutation or provider credential administration.

### PRD-RBAC-005 ANALYST
Read-only access to approved content/Knowledge and analytics. No mutation privileges.

## 5. Information architecture / modules

The current application shell contains 15 primary modules:

1. Dashboard
2. Content Studio
3. Scene Planning
4. AI Representative
5. Campus / Locations
6. Podcast
7. Manual Generation
8. Student Testimonials
9. Media Library
10. Knowledge Base
11. Content Calendar
12. Approval Center
13. Publishing
14. Analytics
15. Settings

Routes for roadmap modules may exist as truthful readiness surfaces before workflows are enabled. A rendered route alone does not satisfy a module requirement.

## 6. Dashboard

- **PRD-DASH-001** Show current organization and user role.
- **PRD-DASH-002** Show actionable workflow counts: drafts, pending review, failed jobs, scheduled publications.
- **PRD-DASH-003** Surface recent content, recent generation activity and integration health.
- **PRD-DASH-004** Never surface data from another organization.

**Current maturity:** Partial. Shell/context exists; full cross-workflow cards depend on later Approval, Publishing and Calendar data.

## 7. Knowledge Base

- **PRD-KB-001** Users with `knowledge:manage` can create Knowledge records.
- **PRD-KB-002** Lifecycle states are `DRAFT`, `ACTIVE`, `ARCHIVED`.
- **PRD-KB-003** Only `ACTIVE` records are selectable for new AI grounding.
- **PRD-KB-004** OWNER/ADMIN/EDITOR may view all same-org lifecycle states; REVIEWER/ANALYST may view only ACTIVE.
- **PRD-KB-005** Record source types are `MANUAL`, `DOCUMENT`, `URL`.
- **PRD-KB-006** Source label and source reference are editable metadata.
- **PRD-KB-007** Every successful business update increments revision exactly once.
- **PRD-KB-008** `organization_id` is immutable after creation.
- **PRD-KB-009** Creation audit fields are immutable; update actor/time are system-controlled.
- **PRD-KB-010** Delete is restricted to OWNER/ADMIN.
- **PRD-KB-011** Auth-user FK nullification must not corrupt or fabricate Knowledge revision history.

**Current maturity:** Implemented.

## 8. Content Studio

- **PRD-CS-001** User selects organization, topic and canonical language.
- **PRD-CS-002** User may select up to 20 ACTIVE Knowledge Base records.
- **PRD-CS-003** Browser submits Knowledge record IDs, never trusted Knowledge content.
- **PRD-CS-004** Server reloads selected records under organization authorization before invoking an AI provider.
- **PRD-CS-005** Missing, cross-org, DRAFT or ARCHIVED selections fail before provider invocation.
- **PRD-CS-006** User may supply optional `Additional context` separate from approved Knowledge.
- **PRD-CS-007** Combined grounding context is capped at 12,000 characters before provider invocation.
- **PRD-CS-008** Canonical generation creates a content item and source script artifact.
- **PRD-CS-009** Generation-time Knowledge snapshots are immutable and server-created only.
- **PRD-CS-010** If snapshot persistence fails, the generated item must not remain successful-looking; it transitions to FAILED with a safe operational failure code.
- **PRD-CS-011** User-facing errors must not expose secrets, provider payloads, SQL errors or stack traces.
- **PRD-CS-012** A GENERATED script artifact may be handed off into Scene Planning without browser-supplied script text being trusted as authoritative source content.

**Current maturity:** Implemented.

## 9. Multilingual content artifacts

- **PRD-ML-001** Supported initial languages are exactly `EN`, `PL`, `HI`.
- **PRD-ML-002** Each content item has one current artifact per language.
- **PRD-ML-003** Exactly one artifact is canonical/source.
- **PRD-ML-004** Artifact states: `PENDING`, `GENERATING`, `GENERATED`, `STALE`, `FAILED`.
- **PRD-ML-005** Translation records the source revision used.
- **PRD-ML-006** Regenerating source increments its revision; older translations become STALE.
- **PRD-ML-007** Translation must never target the canonical language.
- **PRD-ML-008** Failed regeneration does not erase the last successful script.

**Current maturity:** Implemented.

## 10. Scene Planning and video production

The original video requirements keep their IDs and meanings; Phases 6–7 add new IDs rather than reusing old ones.

### Original video requirements

- **PRD-VID-001** Long-form videos are scene-based; target final durations are 90–180 seconds unless content format specifies otherwise.
- **PRD-VID-002** Scene plan derives from an approved/generated script artifact.
- **PRD-VID-003** Scene/planning entities collectively retain ordered sequence, narration/source text, visual direction, duration, provider-generation state and media lineage. In the current normalized architecture those responsibilities are split across Scene Plan scenes/shots, generation attempts/jobs and media assets rather than one overloaded row.
- **PRD-VID-004** Video-provider integration is provider-neutral; LTX is the first production provider and is not hard-coded into domain contracts.
- **PRD-VID-005** Final render may start only when required components are successful and readiness/QA passes.
- **PRD-VID-006** Scene/shot/provider failures use durable retryable jobs where safe and explicit terminal failure when retry is unsafe/exhausted.
- **PRD-VID-007** Generated media assets are organization-scoped and traceable to source content/plans/scenes/shots/jobs.

### Phase 6 Scene Planning requirements

- **PRD-VID-008** Planning uses a versioned hierarchy: Video Project → Visual Bible → Scene Plan Version → Scenes → Shots.
- **PRD-VID-009** Canonical narration remains authoritative and is mapped to scenes/shots without provider/planner rewriting.
- **PRD-VID-010** Deterministic QC covers source freshness, narration coverage, ordering, timing, references, generation requirements and blocker/warning states before approval.
- **PRD-VID-011** Approved Scene Plan versions are immutable; later edits/replans use copy-on-write/new version semantics and source changes invalidate approval/currentness.

### Phase 7 per-shot provider generation requirements

- **PRD-VID-012** Paid/provider generation may start only for an APPROVED, source-current, blocker-free Scene Plan shot after organization/role/lineage validation.
- **PRD-VID-013** Browser submits identifiers only. Provider model, prompt, duration, aspect ratio and policy are reconstructed from authoritative approved state.
- **PRD-VID-014** Per-shot generation uses durable jobs plus append-only attempt lineage with submit, processing, import, retry, terminal and submission-unknown states.
- **PRD-VID-015** Retry is bounded and idempotent. Ambiguous submission outcomes are never blindly re-submitted when duplicate provider spend may occur.
- **PRD-VID-016** Provider result URLs are transport-only; successful output must be copied into private PAK organization storage and linked to `media_assets` before completion.
- **PRD-VID-017** Unattended reconciliation continues without an open browser using a privileged dispatcher that browser roles cannot invoke directly.
- **PRD-VID-018** LTX credentials use Integration Vault, never return to browser state, and support non-billable credential validation where provider semantics permit.
- **PRD-VID-019** Final video assembly is a separate durable job from per-shot generation and produces an organization-scoped final media asset with component lineage.

**Current maturity:** Scene Planning and per-shot provider generation implemented. PRD-VID-005 and PRD-VID-019 final assembly/readiness remain Phase 8.

## 11. AI Representative

- **PRD-AIR-001** Provide an AI-presenter workflow for approved PAK messaging.
- **PRD-AIR-002** Must use approved content/Knowledge inputs, not unrestricted institutional claims.
- **PRD-AIR-003** Avatar/voice/provider credentials remain server-side.
- **PRD-AIR-004** Outputs enter the same review/publishing governance path as other content.

**Current maturity:** Missing; truthful readiness route only.

## 12. Campus / Locations

- **PRD-CAMP-001** Maintain structured campus/location content and reusable approved facts.
- **PRD-CAMP-002** Location-specific generation can reference Knowledge Base records and approved campus metadata.
- **PRD-CAMP-003** Public-facing addresses/contact details require explicit source records and review.

**Current maturity:** Missing; truthful readiness route only.

## 13. Podcast

- **PRD-POD-001** Generate podcast concepts/scripts from approved Knowledge and user briefs.
- **PRD-POD-002** Support episode metadata, script artifact, media assets and review status.
- **PRD-POD-003** Audio provider abstraction must be replaceable without changing podcast domain state.

**Current maturity:** Missing; truthful readiness route only.

## 14. Manual Generation

- **PRD-MAN-001** Allow users to create content without AI provider calls.
- **PRD-MAN-002** Manual content must use the same organization, artifact, approval and publishing model.
- **PRD-MAN-003** Manual edits preserve audit and revision state.

**Current maturity:** Partial foundation/readiness route. Dedicated workflow remains Phase 17.

## 15. Student Testimonials

- **PRD-TST-001** Manage testimonial source, consent/status, text/media assets and publication eligibility.
- **PRD-TST-002** Generated adaptations must not alter factual substance of an approved testimonial.
- **PRD-TST-003** Personally identifiable information is shown only to authorized roles and where operationally required.

**Current maturity:** Missing; truthful readiness route only.

## 16. Media Library

- **PRD-MEDIA-001** Media assets are organization-scoped.
- **PRD-MEDIA-002** Support images, video, audio and documents with metadata, origin and lifecycle.
- **PRD-MEDIA-003** Media may link to content items, legacy scene references and current generation/job/Scene Planning lineage.
- **PRD-MEDIA-004** Upload/read/delete authorization follows explicit roles and storage policies.
- **PRD-MEDIA-005** Provider-generated assets retain safe provider/job metadata where operationally necessary.
- **PRD-MEDIA-006** Generated-video objects are stored in private organization-scoped paths before a generation job is considered successfully imported.

**Current maturity:** Backend/storage/generated-video foundation implemented; full operator catalogue/upload/preview/detail/lifecycle UX remains Phase 8.

## 17. Approval Center

- **PRD-APR-001** Content requiring review has explicit review state.
- **PRD-APR-002** Authorized reviewers can approve, reject or request changes.
- **PRD-APR-003** Approval events are immutable audit records.
- **PRD-APR-004** Publication may enforce approval prerequisites by channel/content policy.
- **PRD-APR-005** Revisions after approval invalidate prior approval when substantive content changes.

**Current maturity:** Generic Approval Center missing. Scene Planning has its own implemented domain approval lifecycle but does not replace product-wide approval.

## 18. Content Calendar

- **PRD-CAL-001** Calendar displays planned/scheduled content by date/channel/status.
- **PRD-CAL-002** Users can schedule or reschedule eligible content.
- **PRD-CAL-003** Calendar state references authoritative publishing/scheduling records and does not duplicate workflow state.

**Current maturity:** Missing.

## 19. Publishing

- **PRD-PUB-001** Initial architecture supports Meta properties and is extensible to other channels.
- **PRD-PUB-002** Provider/channel credentials are stored through Integration Vault.
- **PRD-PUB-003** Publishing is durable-job based with idempotency.
- **PRD-PUB-004** Record provider publication ID, timestamps, status and normalized error metadata.
- **PRD-PUB-005** Failed publish may be retried without duplicate posts where provider semantics permit.
- **PRD-PUB-006** Browser clients never receive raw provider secrets.

**Current maturity:** Missing; Settings/Vault foundation exists but no production publishing workflow.

## 20. Analytics

- **PRD-AN-001** Provide content, channel, campaign and publication performance metrics.
- **PRD-AN-002** Metrics ingestion is organization-scoped.
- **PRD-AN-003** Store normalized metrics plus source/provider timestamps.
- **PRD-AN-004** Analytics UI must distinguish fresh, delayed and unavailable data.
- **PRD-AN-005** ANALYST role is read-only.

**Current maturity:** Missing.

## 21. Settings and Integration Vault

- **PRD-SET-001** Settings contains organization, members, integrations and operational configuration. Integrations are the currently implemented Settings section; remaining sections may be phased.
- **PRD-SET-002** Integration UI supports OpenAI first and generic provider credential schemas thereafter; LTX is now the second implemented organization provider.
- **PRD-SET-003** Credentials are written only through authenticated server-side/Edge actions and narrowly scoped privileged RPCs.
- **PRD-SET-004** Raw secret values are never returned after storage.
- **PRD-SET-005** UI shows `Not configured`, `Configured`, `Invalid`, `Disabled` or equivalent health without revealing value.
- **PRD-SET-006** OWNER/ADMIN may create/replace/delete credentials; EDITOR may use configured integrations but cannot retrieve/administer secrets.
- **PRD-SET-007** Credential use is organization-scoped and auditable.
- **PRD-SET-008** OpenAI key must be usable by Content Studio without a Vercel redeploy after being saved in PAK Settings.
- **PRD-SET-009** Future Meta credentials may contain app ID, app secret, access token, page/business/account IDs and webhook metadata as provider-specific fields.
- **PRD-SET-010** LTX key is usable by approved-shot generation without a redeploy and supports no-spend credential validation where possible.

**Current maturity:** Integrations/Vault implemented for OpenAI and LTX; Organization/Members/Operational Configuration UI remains partial.

## 22. Durable jobs

- **PRD-JOB-001** States: `QUEUED`, `PROCESSING`, `COMPLETED`, `FAILED`, `RETRYING`, `CANCELLED`.
- **PRD-JOB-002** Worker claim is not callable by anonymous/authenticated browser roles.
- **PRD-JOB-003** Jobs support idempotency keys, attempt count and lease/claim semantics.
- **PRD-JOB-004** Provider errors are normalized before persistence/UI display.
- **PRD-JOB-005** Provider-spend jobs have a single validated creation boundary that derives trusted execution input from authoritative domain state.

**Current maturity:** Implemented foundation; exercised by Phase 7 video generation.

## 23. Non-functional requirements

- **PRD-NFR-001 Security:** strict organization isolation, least privilege, server-only provider secrets, no secret logging.
- **PRD-NFR-002 Reliability:** durable long-running jobs, idempotent external actions, recoverable failure states.
- **PRD-NFR-003 Performance:** normal interactive pages target responsive server/client interaction; large media and AI operations must not block request lifetimes unnecessarily.
- **PRD-NFR-004 Accessibility:** keyboard-usable forms, semantic labels, visible focus, readable status/error text.
- **PRD-NFR-005 Responsive UX:** core administration workflows must work on modern desktop and mobile browsers.
- **PRD-NFR-006 Observability:** operational logs include request/job/provider correlation IDs where available while redacting secrets/PII.
- **PRD-NFR-007 Testing:** typecheck, lint, unit/integration, build and applicable E2E are mandatory release gates.
- **PRD-NFR-008 Data integrity:** database constraints/triggers/RLS are authoritative for security-critical invariants, not browser validation alone.
- **PRD-NFR-009 Cost safety:** paid-provider execution cannot be triggered through an unvalidated browser-controlled payload or unconstrained retry loop.

## 24. Operational core baseline after Phase 7

The current operational core consists of:

1. Supabase Auth and organization membership
2. RBAC/RLS tenant foundation
3. Settings → Integrations with secure OpenAI and LTX credential storage
4. Knowledge Base lifecycle and authorization
5. Content Studio grounded canonical generation
6. EN/PL/HI artifact workflow
7. immutable Knowledge provenance snapshots
8. Scene Planning with Video Project, Visual Bible, versioned scenes/shots, deterministic QC and approval
9. durable approved-shot LTX generation with bounded retry/reconciliation
10. private generated-video import into organization-scoped storage and `media_assets`
11. unattended video-generation dispatcher
12. GitHub CI / release verification discipline

This operational core is not the full product. Phase 8 onward completes final assembly/media operations, generic approvals, publishing, scheduling, analytics and specialized modules.

## 25. Explicit non-goals for the current baseline

- generic autonomous web crawling
- unrestricted RAG over unknown third-party content
- customer-facing billing/subscriptions
- public multi-tenant signup marketplace
- production-scale GPU orchestration owned by PAK
- secrets stored in browser local storage or returned by read APIs
- treating provider result URLs as durable PAK media storage
- browser-controlled paid-provider payloads that bypass approved domain state

## 26. Product acceptance principle

Every implemented requirement must be traceable through the project traceability matrix to its UX surface, backend ownership, authorization rule, automated verification and release phase. Existing requirement IDs retain their original semantic meaning; new behavior receives new IDs. A rendered route or database table alone does not make a requirement implemented.