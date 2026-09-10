# PAK Marketing Automation — Master Product Requirements Document (PRD)

**Document ID:** PAK-PRD-001  
**Version:** 1.0  
**Status:** Baseline for review  
**Product:** Polska Akademia Kolejnictwa (PAK) Marketing Automation  
**Primary users:** PAK marketing, communications, reviewers, analysts, administrators, owners  

## 1. Product purpose

PAK Marketing Automation is a multi-tenant-ready internal marketing operating system for planning, generating, reviewing, publishing, and measuring multilingual railway-industry content. It must combine approved institutional knowledge, AI-assisted content generation, media/video production, approval workflows, publishing integrations, campaign automation, and analytics without exposing organization data or provider secrets to unauthorized users.

## 2. Product principles

- **PRD-GEN-001 — Grounded by default.** AI-generated content must be able to use only explicitly approved PAK knowledge records plus optional user context.
- **PRD-GEN-002 — Human control.** AI output remains editable and must never be auto-published without an explicit policy/approval path.
- **PRD-GEN-003 — Traceable output.** Generated content must retain immutable generation-time provenance for selected approved knowledge.
- **PRD-GEN-004 — Multilingual first.** Canonical content and translations must support EN, PL, and HI in the initial product baseline.
- **PRD-GEN-005 — Tenant isolation.** Every organization-owned resource must be organization-scoped and protected by database authorization.
- **PRD-GEN-006 — Server-side secrets.** Provider credentials must never be exposed back to browser clients after storage.
- **PRD-GEN-007 — Durable workflows.** Long-running generation, video, publishing, and synchronization operations must use durable jobs with retry/failure states.
- **PRD-GEN-008 — Evidence-based release.** Features are complete only when implementation, automated tests, and required runtime verification are green.

## 3. User roles

### PRD-RBAC-001 OWNER
Full organization administration, integrations, members, content, approval, publishing, analytics, knowledge and destructive actions.

### PRD-RBAC-002 ADMIN
Operational administration equivalent to OWNER except ownership-only governance functions that may be added later.

### PRD-RBAC-003 EDITOR
Create/edit content, manage Knowledge Base records, generate AI artifacts, use media tools, view analytics. No destructive organization/admin operations.

### PRD-RBAC-004 REVIEWER
Read approved knowledge, review generated content, approve/reject when assigned/authorized, view analytics. No knowledge mutation or publishing administration.

### PRD-RBAC-005 ANALYST
Read-only access to approved content/knowledge and analytics. No mutation privileges.

## 4. Information architecture / modules

The application shell contains the following modules:

1. Dashboard
2. Content Studio
3. AI Representative
4. Campus Locations
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

## 5. Dashboard

- **PRD-DASH-001** Show current organization and user role.
- **PRD-DASH-002** Show actionable workflow counts: drafts, pending review, failed jobs, scheduled publications.
- **PRD-DASH-003** Surface recent content, recent generation activity and integration health.
- **PRD-DASH-004** Never surface data from another organization.

## 6. Knowledge Base

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
- **PRD-KB-011** Auth-user FK nullification must not corrupt or fabricate the Knowledge revision history.

## 7. Content Studio

- **PRD-CS-001** User selects organization, topic and canonical language.
- **PRD-CS-002** User may select up to 20 ACTIVE Knowledge Base records.
- **PRD-CS-003** Browser submits Knowledge record IDs, never trusted Knowledge content.
- **PRD-CS-004** Server reloads selected records under organization authorization before calling an AI provider.
- **PRD-CS-005** Missing, cross-org, DRAFT or ARCHIVED selections fail before provider invocation.
- **PRD-CS-006** User may supply optional `Additional context` separate from approved Knowledge.
- **PRD-CS-007** Combined grounding context is capped at 12,000 characters before provider invocation.
- **PRD-CS-008** Canonical generation creates a content item and source script artifact.
- **PRD-CS-009** Generation-time Knowledge snapshots are immutable and server-created only.
- **PRD-CS-010** If snapshot persistence fails, the generated item must not remain successful-looking; it transitions to FAILED with a safe operational failure code.
- **PRD-CS-011** User-facing errors must not expose secrets, provider payloads, SQL errors or stack traces.

## 8. Multilingual content artifacts

- **PRD-ML-001** Supported initial languages are exactly `EN`, `PL`, `HI`.
- **PRD-ML-002** Each content item has one current artifact per language.
- **PRD-ML-003** Exactly one artifact is canonical/source.
- **PRD-ML-004** Artifact states: `PENDING`, `GENERATING`, `GENERATED`, `STALE`, `FAILED`.
- **PRD-ML-005** Translation records the source revision used.
- **PRD-ML-006** Regenerating source increments its revision; older translations become STALE.
- **PRD-ML-007** Translation must never target the canonical language.
- **PRD-ML-008** Failed regeneration does not erase the last successful script.

## 9. Scene planning & video production

- **PRD-VID-001** Long-form videos are scene-based; target final durations are 90–180 seconds unless content format specifies otherwise.
- **PRD-VID-002** Scene plan derives from an approved/generated script artifact.
- **PRD-VID-003** Scene entities store sequence, narration/text, visual direction, duration, provider status and media linkage.
- **PRD-VID-004** Video-provider integration is provider-neutral; LTX is the primary planned provider, not hard-coded into domain contracts.
- **PRD-VID-005** Final render may start only when required scenes are successful and readiness/QA passes.
- **PRD-VID-006** Scene/provider failures use durable retryable jobs and explicit terminal failure.
- **PRD-VID-007** Generated media assets are organization-scoped and traceable to source content/scenes.

## 10. AI Representative

- **PRD-AIR-001** Provide an AI-presenter workflow for approved PAK messaging.
- **PRD-AIR-002** Must use approved content/knowledge inputs, not unrestricted institutional claims.
- **PRD-AIR-003** Avatar/voice/provider credentials remain server-side.
- **PRD-AIR-004** Outputs enter the same review/publishing governance path as other content.

## 11. Campus Locations

- **PRD-CAMP-001** Maintain structured campus/location content and reusable approved facts.
- **PRD-CAMP-002** Location-specific generation can reference Knowledge Base records and approved campus metadata.
- **PRD-CAMP-003** Public-facing addresses/contact details require explicit source records and review.

## 12. Podcast

- **PRD-POD-001** Generate podcast concepts/scripts from approved Knowledge and user briefs.
- **PRD-POD-002** Support episode metadata, script artifact, media assets and review status.
- **PRD-POD-003** Audio provider abstraction must be replaceable without changing podcast domain state.

## 13. Manual Generation

- **PRD-MAN-001** Allow users to create content without AI provider calls.
- **PRD-MAN-002** Manual content must use the same organization, artifact, approval and publishing model.
- **PRD-MAN-003** Manual edits preserve audit and revision state.

## 14. Student Testimonials

- **PRD-TST-001** Manage testimonial source, consent/status, text/media assets and publication eligibility.
- **PRD-TST-002** Generated adaptations must not alter the factual substance of an approved testimonial.
- **PRD-TST-003** Personally identifiable information is shown only to authorized roles and only where operationally required.

## 15. Media Library

- **PRD-MEDIA-001** Media assets are organization-scoped.
- **PRD-MEDIA-002** Support images, video, audio and documents with metadata, origin and lifecycle.
- **PRD-MEDIA-003** Media may link to content items and video scenes.
- **PRD-MEDIA-004** Upload/read/delete authorization follows explicit roles and storage policies.
- **PRD-MEDIA-005** Provider-generated assets retain provider/job metadata where operationally necessary.

## 16. Approval Center

- **PRD-APR-001** Content requiring review has explicit review state.
- **PRD-APR-002** Authorized reviewers can approve, reject, or request changes.
- **PRD-APR-003** Approval events are immutable audit records.
- **PRD-APR-004** Publication may enforce approval prerequisites by channel/content policy.
- **PRD-APR-005** Revisions after approval invalidate prior approval when substantive content changes.

## 17. Content Calendar

- **PRD-CAL-001** Calendar displays planned/scheduled content by date/channel/status.
- **PRD-CAL-002** Users can schedule or reschedule eligible content.
- **PRD-CAL-003** Calendar state references publishing/scheduling records; it must not duplicate authoritative workflow state.

## 18. Publishing

- **PRD-PUB-001** Initial architecture supports Meta properties and is extensible to other channels.
- **PRD-PUB-002** Provider/channel credentials are stored through the Integration Vault.
- **PRD-PUB-003** Publishing is durable-job based with idempotency.
- **PRD-PUB-004** Record provider publication ID, timestamps, status and normalized error metadata.
- **PRD-PUB-005** Failed publish may be retried without duplicate posts where provider semantics permit.
- **PRD-PUB-006** Browser clients never receive raw provider secrets.

## 19. Analytics

- **PRD-AN-001** Provide content, channel, campaign and publication performance metrics.
- **PRD-AN-002** Metrics ingestion is organization-scoped.
- **PRD-AN-003** Store normalized metrics plus source/provider timestamps.
- **PRD-AN-004** Analytics UI must distinguish fresh, delayed and unavailable data.
- **PRD-AN-005** ANALYST role is read-only.

## 20. Settings & Integration Vault

- **PRD-SET-001** Settings contains organization, members, integrations and operational configuration.
- **PRD-SET-002** Integration UI supports OpenAI first and generic provider credential schemas thereafter.
- **PRD-SET-003** Credentials are written only through authenticated server-side actions/endpoints.
- **PRD-SET-004** Raw secret values are never returned after storage.
- **PRD-SET-005** UI shows `Not configured`, `Configured`, `Invalid` or equivalent health state without revealing value.
- **PRD-SET-006** OWNER/ADMIN may create/replace/delete integration credentials; EDITOR may use configured integrations but cannot retrieve secrets.
- **PRD-SET-007** Credential use is organization-scoped and auditable.
- **PRD-SET-008** OpenAI key must be usable by Content Studio without a Vercel redeploy after being saved in PAK Settings.
- **PRD-SET-009** Future Meta credentials may contain app ID, app secret, access token, page/business/account IDs and webhook metadata as provider-specific fields.

## 21. Durable jobs

- **PRD-JOB-001** States: `QUEUED`, `PROCESSING`, `COMPLETED`, `FAILED`, `RETRYING`, `CANCELLED`.
- **PRD-JOB-002** Worker claim is not callable by anonymous/authenticated browser roles.
- **PRD-JOB-003** Jobs support idempotency keys, attempt count and lease/claim semantics.
- **PRD-JOB-004** Provider errors are normalized before persistence/UI display.

## 22. Non-functional requirements

- **PRD-NFR-001 Security:** strict organization isolation, least privilege, server-only provider secrets, no secret logging.
- **PRD-NFR-002 Reliability:** durable long-running jobs, idempotent external actions, recoverable failure states.
- **PRD-NFR-003 Performance:** normal interactive pages target responsive server/client interaction; large media and AI operations must not block request lifetimes unnecessarily.
- **PRD-NFR-004 Accessibility:** keyboard-usable forms, semantic labels, visible focus, readable status/error text.
- **PRD-NFR-005 Responsive UX:** core administration workflows must work on modern desktop and mobile browsers.
- **PRD-NFR-006 Observability:** operational logs must include request/job/provider correlation IDs while redacting secrets/PII.
- **PRD-NFR-007 Testing:** typecheck, lint, unit/integration, build and applicable E2E are mandatory release gates.
- **PRD-NFR-008 Data integrity:** database constraints/triggers/RLS are authoritative for security-critical invariants, not browser validation alone.

## 23. MVP baseline

MVP is considered operational when the following are usable end-to-end on a hosted staging environment:

1. Supabase Auth and organization membership
2. Settings → Integrations with secure OpenAI credential storage
3. Knowledge Base lifecycle and authorization
4. Content Studio grounded canonical generation
5. EN/PL/HI artifact workflow
6. Media Library foundation
7. Scene Planning foundation
8. Approval Center foundation
9. Publishing integration foundation
10. Dashboard/operational status

## 24. Explicit non-goals for the current baseline

- generic autonomous web crawling
- unrestricted RAG over unknown third-party content
- customer-facing billing/subscriptions
- public multi-tenant signup marketplace
- production-scale GPU orchestration owned by PAK
- secrets stored in browser local storage or returned by read APIs

## 25. Product acceptance principle

Every implemented requirement must be traceable through the project traceability matrix to its UX surface, backend ownership, authorization rule, automated verification and release phase. New work that has no PRD/TRD requirement ID must first update the baseline documentation.