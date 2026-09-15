# PAK Marketing Automation — UI/UX Design Specification

**Document ID:** PAK-UX-001  
**Version:** 1.3  
**Status:** Current baseline through Phase 8, Organization Identity / Brand / Knowledge foundation, and UI/UX Production Convergence

## 1. UX objective

PAK is an internal operations console, not a public marketing website. UX optimizes for clarity, traceability, safe actions, rapid review and predictable workflow state. Users should always understand:

- which organization they are operating in;
- their role/permission context;
- the authoritative state of the item;
- what action is available next;
- why a gated action is unavailable;
- whether institutional identity/Brand/Knowledge is editable or read-only;
- whether ingestion created a reviewable DRAFT versus approved ACTIVE Knowledge;
- whether an external integration is healthy;
- whether work is complete, queued, retrying, stale or blocked.

A route is not considered implemented merely because it renders. Primary journey, loading/empty/error/success states, authorization and responsive behavior must exist.

## 2. Current UI maturity

| Surface | Current maturity |
|---|---|
| Global shell/navigation | Implemented; grouped Operational / Administration / Roadmap navigation |
| Dashboard | Implemented production command center |
| Content Studio | Implemented; authoritative Profile/Brand/Core context is visible and server-resolved |
| Knowledge Base + Core/ingestion controls | Implemented |
| Settings landing + Organization Profile | Implemented |
| Settings → Brand Kit | Implemented |
| Settings → Integrations OpenAI/LTX | Implemented |
| Scene Planning | Implemented; Brand Kit defaults integrated and production stages surfaced |
| Approved-shot video generation controls | Implemented |
| Media Library | Implemented operational catalogue/detail/preview/upload/archive/delete surface |
| Approval Center / Publishing / Calendar / Analytics | Roadmap-governed |
| AI Representative / Campus / Podcast / Testimonials | Roadmap-governed |
| Manual Generation | Foundation/readiness only |

Truthful readiness screens are intentional product behavior for unimplemented modules; they must not simulate working workflows.

## 3. Global layout

- **UX-SHELL-001** Persistent desktop left navigation for primary modules.
- **UX-SHELL-002** Mobile navigation collapses into an accessible menu/disclosure.
- **UX-SHELL-003** Top-level context shows product name, active organization, signed-in user and role where applicable.
- **UX-SHELL-004** Destructive actions use explicit confirmation.
- **UX-SHELL-005** Async operations show idle/submitting/success/failed state and do not rely only on toast notifications.
- **UX-SHELL-006** Empty states explain the next action rather than showing blank tables.
- **UX-SHELL-007** Status labels use text in addition to visual styling; color alone cannot carry meaning.
- **UX-SHELL-008** Planned/foundation modules clearly state availability and implemented alternatives.

## 4. Navigation

Navigation is grouped by workflow maturity while retaining all governed routes:

- **Operational:** Dashboard, Content Studio, Scene Planning, Media Library, Knowledge Base.
- **Administration:** Settings.
- **Roadmap:** Approval Center, Publishing, Content Calendar, Analytics, AI Representative, Podcast, Campus / Locations, Student Testimonials and Manual Generation.

Settings exposes Organization Profile, Brand Kit and Integrations. Authorization remains server/database controlled. Hiding a control never substitutes for authorization. Roadmap routes remain visible and truthfully labelled rather than being hidden or simulated as implemented workflows.

## 5. Dashboard

- **UX-DASH-001** Display active organization, role and concise system state.
- **UX-DASH-002** Show authoritative institutional readiness, content, Knowledge, scene/video production, Media Library and integration state from server-side organization-scoped reads.
- **UX-DASH-003** Show OpenAI/LTX normalized integration metadata without exposing secrets.
- **UX-DASH-004** Resolve a deterministic next production action from authoritative workflow state rather than synthetic scores or browser guesses.
- **UX-DASH-005** Preserve safe error/no-workspace states when the authenticated account has no usable organization context.
- **UX-DASH-006** Do not display a fabricated numeric health score.

**Current maturity:** Implemented production command center.

## 6. Content Studio

### UX-CS-001 Composition form
Fields: organization selector when needed, topic, canonical language EN/PL/HI, approved selectable Knowledge, Additional context and Generate action.

### UX-CS-002 Knowledge selector
Shows ACTIVE selectable non-core metadata, selected count and organization reset behavior. Core Knowledge is automatic and does not require user selection. The UI must not imply that deselecting an explicitly shown Core source disables authoritative Core grounding.

### UX-CS-003 Generation state
Generate enters pending state and prevents accidental duplicate submission. Failure remains visible with safe actionable message. Success displays canonical artifact and metadata.

### UX-CS-004 Artifact workspace
Display EN/PL/HI cards with language, canonical badge, status, revision, script, source-revision relationship and valid generation/refresh/retry controls.

### UX-CS-005 Stale translation
Clearly mark STALE translations after canonical regeneration and offer refresh.

### UX-CS-006 Traceability
Generated content may expose read-only Profile revision, Brand Kit revision and Knowledge sources used to authorized same-org users without exposing private storage URLs.

### UX-CS-007 Scene Planning handoff
A GENERATED artifact may expose `Create Scene Plan`; authoritative script/revision is server-resolved.

### UX-CS-008 Automatic identity grounding
The user does not paste or edit authoritative Organization Profile/Brand Kit content inside the generation form. Those inputs are resolved automatically server-side. Additional context remains visibly separate from institutional authority.

### UX-CS-009 Authoritative context visibility
The operator workspace exposes a read-only `Authoritative context` summary for current Profile revision, Brand Kit revision and automatically grounded Core Knowledge count. Explicit selected non-Core Knowledge remains a separate `0..20` selection concept; zero selected non-Core sources does not disable Core grounding.

**Current maturity:** Implemented.

## 7. Knowledge Base

### UX-KB-001 Management list
Show title, status, source type, source label, revision, Core badge where applicable and last update.

### UX-KB-002 Manual create form
Fields: Title, Content, Source label and Source reference for manual entry. New records begin DRAFT. Document/URL sources use the dedicated ingestion flow rather than a manual source-type selector.

### UX-KB-003 Edit form
Managers edit business fields with current revision visible.

### UX-KB-004 Lifecycle actions
DRAFT → Activate; ACTIVE → Archive; ARCHIVED → Activate; OWNER/ADMIN → Delete.

### UX-KB-005 Read-only role experience
REVIEWER/ANALYST see ACTIVE approved Knowledge only and no mutation controls.

### UX-KB-006 Conflict state
Revision conflict prompts reload rather than silent overwrite.

### UX-KB-007 Core Knowledge control
OWNER/ADMIN see `Mark Core` / `Remove Core` control and a visible Core Knowledge badge with clear automatic-grounding semantics. EDITOR may manage normal Knowledge but sees no Core mutation control. REVIEWER/ANALYST remain read-only.

### UX-KB-008 Document ingestion
Authorized managers may upload PDF, DOCX, PPTX or TXT. The file first uses the private Media Library upload path, then Knowledge ingestion receives the safe Media asset ID. The form exposes a `Document source title` input and upload progress/error state.

### UX-KB-009 URL ingestion
Authorized managers may submit a URL source title plus validated HTTP/HTTPS URL. URL safety/extraction failure returns a normalized message; provider/network internals are not exposed.

### UX-KB-010 DRAFT review handoff
Successful document/URL extraction displays an explicit review message such as `Draft created for review. Activate it only after verifying the extracted content.` The resulting record appears with DRAFT status and an explicit Activate action. No upload/extraction success state may visually imply publication/approval.

### UX-KB-011 Source provenance
Document/URL-generated records expose safe source label/reference metadata and linked lifecycle context without revealing private storage paths or signed URLs.

### UX-KB-012 Source-entry hierarchy
The operator surface visibly separates `Add manually` from `Ingest document or URL`, and explains DRAFT versus ACTIVE lifecycle semantics before mutation.

**Current maturity:** Implemented; lifecycle, Core RBAC and ingestion behavior are covered by unit/action/live proofs, with browser coverage using the repository's existing fixture gates.

## 8. Settings

### UX-SET-001 Integrations overview
Provider cards show provider name/purpose, safe state, masked hint, last verified time and role-appropriate actions.

### UX-SET-002 OpenAI configuration
API key is password/write-only. After save, clear input and display only safe masked metadata.

### UX-SET-003 Meta configuration
Meta remains a truthful `Planned · Phase 10` integration on the Settings landing until Phase 10 is implemented. No fake credential workflow is exposed.

### UX-SET-004 Test connection
Where safe, provider validation returns normalized health only.

### UX-SET-005 Secret removal
Remove requires confirmation and explains affected workflows.

### UX-SET-006 LTX configuration
LTX API key is password/write-only with OWNER/ADMIN mutation/test actions.

### UX-SET-007 Non-manager integration experience
EDITOR/REVIEWER/ANALYST receive no credential mutation controls/raw secrets.

### UX-SET-008 Organization Profile
The Profile form shows official name plus supported institutional/contact/legal fields. OWNER/ADMIN receive enabled inputs and `Save profile`; EDITOR/REVIEWER/ANALYST receive populated disabled/read-only fields with clear copy explaining the read-only state.

### UX-SET-009 Profile save state
Save uses optimistic revision semantics. Pending state prevents duplicate save; stale revision produces a reload/retry conflict rather than silent overwrite.

### UX-SET-010 Brand Kit
The Brand Kit form shows palette, typography, voice, logo-usage and visual constraints. OWNER/ADMIN may edit; non-managers see read-only populated state.

### UX-SET-011 Brand asset picker
Asset selection lists only safe same-org ACTIVE image Media assets. UI stores/selects Media asset identity, never signed URL/path as business state. Semantic roles include primary/light/dark logo, brand mark, favicon and approved imagery.

### UX-SET-012 Institutional identity clarity
Official logo assignment is presented as organizational identity, not a per-project creative preference. Scene Planning Visual Bible may refine presentation but does not replace the official logo asset.

### UX-SET-013 Three-domain landing
Settings landing summarizes Organization Profile and Brand Kit configured/not-configured state with current revision when available, and Integrations with normalized OpenAI/LTX state. Repository/query failures remain visible safe errors rather than being converted to `Not configured`. Raw API keys/secrets are never rendered.

**Current maturity:** Settings landing, Organization Profile, Brand Kit and OpenAI/LTX Integrations implemented; Meta remains Planned Phase 10.

## 9. Media Library

### UX-MEDIA-001 Library view
List organization assets with asset type, identity/name, origin, linked content/job, created time and state.

### UX-MEDIA-002 Upload
Uploads show progress and validation failure using controlled direct-storage paths where practical.

### UX-MEDIA-003 Asset detail
Show metadata, preview when supported and lineage; never expose raw storage credentials.

### UX-MEDIA-004 Generated media
Generated video references PAK-owned private Media identity, not provider URLs.

### UX-MEDIA-005 Brand/document reuse
Brand Kit image pickers and Knowledge document ingestion reuse Media Library asset identities instead of implementing parallel binary stores.

### UX-MEDIA-006 Operational catalogue semantics
The Media Library is an operational Phase 8 surface, not `Foundation only`. It presents only metadata that actually exists (asset type/source/status/lineage) and does not infer a category when authoritative metadata is absent.

**Current maturity:** Implemented operational catalogue/detail/preview/upload/archive/delete surface used by Brand, Knowledge and video workflows.

## 10. Scene Planning

### UX-SCENE-001 Scene list
Each scene shows sequence/order, estimated duration, narration/script portion, visual direction and generation/media state where applicable.

### UX-SCENE-002 Editing
Authorized editors may adjust permitted visual direction/timing fields before provider generation; source narration remains read-only.

### UX-SCENE-003 Readiness
Final render CTA remains unavailable with explicit reasons until required components are complete and QA-ready.

### UX-SCENE-004 Entry states
No-project route shows truthful Content Studio handoff; invalid/unavailable project IDs show safe non-leaking states.

### UX-SCENE-005 Production Brief and Visual Bible
Authorized editors may define project creative direction before/during draft planning; approved lifecycle restricts mutation.

### UX-SCENE-006 Manual edit constraints
Narration source text is read-only; manual shot edits visibly mark human modification and invalidate prior QC.

### UX-SCENE-007 Reordering
Move/reorder controls submit complete ordered identifier sets and preserve accessible feedback.

### UX-SCENE-008 Granular AI replan
Replan works only on authorized editable versions; human-modified shots are protected by default.

### UX-SCENE-009 QC
Expose blocker/warning/info state and valid QC actions.

### UX-SCENE-010 Review and approval
Controls depend on role/lifecycle; approved plans are read-only and further edits create a new version.

### UX-SCENE-011 Source freshness
Stale/source-changed plan state is visible and disables provider-generation actions until current approval exists.

### UX-SCENE-012 Institutional Brand defaults
Scene Planning automatically receives current Brand Kit institutional palette/typography/logo treatment where the project Visual Bible does not explicitly define presentation. UI does not ask users to re-enter official organization identity for each project.

### UX-SCENE-013 Official-logo authority
Where institutional brand context is displayed, official logo asset identity is distinct from Visual Bible creative direction. Project styling may refine placement/treatment but must not imply that a different logo becomes official.

### UX-SCENE-014 Production-stage hierarchy
The workspace presents the implemented production flow as four stages: `Plan`, `Review & approve`, `Generate shots`, `Assemble`. This hierarchy is presentation-only and does not alter lifecycle/RBAC authority. A completed final assembly may link to `/media-library`; unsupported asset deep links are not invented.

**Current maturity:** Implemented.

## 11. Approved-shot video generation

- **UX-VID-001** Only an APPROVED, source-current shot for OWNER/ADMIN/EDITOR exposes generation controls; UI submits identifiers only.
- **UX-VID-002** Display normalized PAK generation states, never raw provider result URLs.
- **UX-VID-003** Safe refresh/reconciliation does not duplicate provider submission.
- **UX-VID-004** Retry appears only when authoritative backend state says retry is safe.
- **UX-VID-005** Completed state references PAK-owned media identity.
- **UX-VID-006** Missing/invalid/disabled LTX produces normalized integration state.

**Current maturity:** Implemented.

## 12. Roadmap module UX

AI Representative, Podcast, Campus/Locations, Student Testimonials, Content Calendar, generic Approval Center, Publishing and Analytics retain their existing normative UX requirements and truthful readiness behavior until their respective governed implementation slices. Manual Generation remains a foundation/readiness workflow pending its dedicated completion phase.

## 13. Forms and validation

- Inline field errors near inputs.
- Server errors shown in a persistent form-level region.
- Buttons disabled only when action cannot proceed; workflow gates explain why.
- Password/secret inputs default obscured and never preload stored values.
- Never display full access tokens/API keys in confirmations.
- Unsaved edit state should not silently disappear during context switching.
- Provider/API internals are normalized before display.
- Paid-provider controls are unavailable when approval/source/integration prerequisites fail.
- Ingestion success is visually distinguished from Knowledge activation/approval.
- Read-only Profile/Brand state remains visible rather than hidden from non-manager organization members.

## 14. Responsive behavior

### Desktop
Persistent grouped navigation, multi-column workspaces where useful, dense but readable administrative information.

### Mobile
Single-column critical flows, accessible grouped navigation disclosure, cards instead of horizontal-table dependency and no critical control requiring horizontal overflow.

Dashboard, Content Studio, Knowledge Base, Settings/Profile, Settings/Brand Kit, Scene Planning, Media Library and Settings/Integrations should remain usable in modern mobile Chrome.

## 15. Accessibility baseline

- Semantic labels associated with inputs.
- Keyboard access to navigation, forms, disclosure controls and dialogs.
- Focus management for modal/dialog interactions where used.
- Error messages programmatically associated with invalid fields where practical.
- Status represented by text, not color alone.
- Readable typography and mobile-appropriate tap targets.
- Pending async operations exposed through visible status regions/labels.
- Disabled/read-only controls retain understandable labels and explanatory text.

## 16. Design-system direction

The product is a technical, industrial, premium operations console with dark neutral operational surfaces, restrained contrast accents and dense-but-readable hierarchy. Railway/engineering character may appear in branding, but workflow state clarity has priority over decoration.

Future visual refreshes may alter theme without changing semantic hierarchy, status meaning, accessibility or workflow-gate behavior.

## 17. UX acceptance rule

A screen is implemented only when its primary journey, loading/empty/error/success states, authorization behavior and responsive interaction are defined and verified. A readiness/placeholder page is intentionally Planned/Foundation only and must never be counted as implementation of the corresponding PRD workflow. For ingestion, `DRAFT created` and `Knowledge activated` are always distinct user states.

The browser E2E suite uses the repository's existing development-only fixture gates and does not fabricate organization/domain rows solely to force success-state rendering. Success-state UI branches are verified deterministically at component/service level; browser tests additionally prove truthful no-workspace/recovery behavior, navigation and roadmap boundaries.