# PAK Marketing Automation — UI/UX Design Specification

**Document ID:** PAK-UX-001  
**Version:** 1.1  
**Status:** Current baseline after Phase 7

## 1. UX objective

PAK is an internal operations console, not a public marketing website. UX optimizes for clarity, traceability, safe actions, rapid review and predictable workflow state. Users should always understand:

- which organization they are operating in;
- their role/permission context;
- the authoritative state of the item;
- what action is available next;
- why a gated action is unavailable;
- whether an external integration is healthy;
- whether work is complete, queued, retrying, stale or blocked.

A route is not considered implemented merely because it renders. Primary journey, loading/empty/error/success states, authorization and responsive behavior must exist.

Existing UX requirement IDs retain their original meaning; additions introduced by Scene Planning/LTX use new IDs.

## 2. Current UI maturity

| Surface | Current maturity |
|---|---|
| Global shell/navigation | Implemented |
| Content Studio | Implemented |
| Knowledge Base | Implemented |
| Scene Planning | Implemented |
| Approved-shot video generation controls | Implemented |
| Settings → Integrations OpenAI/LTX | Implemented |
| Dashboard | Partial |
| Media Library | Foundation/readiness only |
| Approval Center | Planned/readiness only |
| Publishing | Planned/readiness only |
| Content Calendar | Planned/readiness only |
| Analytics | Planned/readiness only |
| AI Representative / Campus / Podcast / Testimonials | Planned/readiness only |
| Manual Generation | Foundation/readiness only |

Truthful readiness screens are intentional product behavior for unimplemented modules; they must not simulate working workflows.

## 3. Global layout

- **UX-SHELL-001** Persistent desktop left navigation for the primary modules; current baseline has 15 items after adding Scene Planning.
- **UX-SHELL-002** Mobile navigation collapses into an accessible menu/disclosure.
- **UX-SHELL-003** Top-level context shows product name, active organization, signed-in user and role where applicable.
- **UX-SHELL-004** Destructive actions use explicit confirmation.
- **UX-SHELL-005** Async operations show idle/submitting/success/failed state and do not rely only on toast notifications.
- **UX-SHELL-006** Empty states explain the next action rather than showing blank tables.
- **UX-SHELL-007** Status labels use text in addition to visual styling; color alone cannot carry meaning.
- **UX-SHELL-008** Planned/foundation modules clearly state availability, roadmap phase and links to implemented alternatives.

## 4. Navigation

Current primary navigation order:

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

Authorization remains server/database controlled. Hiding a navigation item must not conceal relevant read-only state or substitute for authorization.

## 5. Dashboard

### UX-DASH-001 Header
Display active organization, role and concise system state.

### UX-DASH-002 Action cards
Show counts/links for Draft content, Awaiting approval, Failed/retrying jobs, Scheduled publications and Integration issues as their authoritative domains become available.

### UX-DASH-003 Recent activity
Show chronological generation/review/publish/integration metadata activity without exposing secret values.

**Current maturity:** Partial until later workflow domains provide complete signals.

## 6. Content Studio

### UX-CS-001 Composition form
Fields: organization selector when needed, topic, canonical language EN/PL/HI, approved Knowledge sources, Additional context and Generate action.

### UX-CS-002 Knowledge selector
Shows metadata only; never full Knowledge content merely for selection; displays `Selected X / 20`; prevents >20; clears on organization switch; ACTIVE sources only.

### UX-CS-003 Generation state
Generate enters pending state and prevents accidental duplicate submission. Failure remains visible with safe actionable message. Success displays canonical artifact and metadata.

### UX-CS-004 Artifact workspace
Display EN/PL/HI cards with language, canonical badge, status, revision, script, source-revision relationship and valid generation/refresh/retry controls.

### UX-CS-005 Stale translation
Clearly mark STALE translations after canonical regeneration and offer refresh.

### UX-CS-006 Traceability
Generated content can expose read-only `Sources used` metadata/snapshots to authorized same-org users.

### UX-CS-007 Scene Planning handoff
A GENERATED artifact may expose `Create Scene Plan`; handoff navigates to a persisted project while authoritative script/revision is server-resolved.

**Current maturity:** Implemented.

## 7. Knowledge Base

### UX-KB-001 Management list
Show title, status, source type, source label, revision and last update.

### UX-KB-002 Create form
Fields: Title, Content, Source type, Source label, Source reference. New records begin DRAFT.

### UX-KB-003 Edit form
Managers edit business fields with current revision visible.

### UX-KB-004 Lifecycle actions
DRAFT → Activate; ACTIVE → Archive; ARCHIVED → Activate; OWNER/ADMIN → Delete.

### UX-KB-005 Read-only role experience
REVIEWER/ANALYST see ACTIVE records only and no mutation controls.

### UX-KB-006 Conflict state
Revision conflict prompts reload rather than silent overwrite.

**Current maturity:** Implemented.

## 8. Settings

Current Settings implementation is Integration-focused. Organization, Members and broader operational configuration remain roadmap work unless separately implemented.

### UX-SET-001 Integrations overview
Provider cards show provider name/purpose, Not configured / Configured / Invalid / Disabled state, safe masked hint, last verified time and role-appropriate actions.

### UX-SET-002 OpenAI configuration
API key is password/write-only. After save, clear input and display only safe masked metadata. Supported models are allowlisted.

### UX-SET-003 Meta configuration
Future Meta form may include App ID, App Secret, access token, page/business/account identifiers and webhook verification metadata. Secret fields remain write-only; non-secret IDs may be readable/editable.

### UX-SET-004 Test connection
Where a provider supports safe validation, `Test connection` invokes server-side/Edge validation and returns normalized health only.

### UX-SET-005 Secret removal
Remove requires confirmation and explains affected workflows.

### UX-SET-006 LTX configuration
LTX API key is password/write-only with Save / Remove / Enable / Disable / Test actions for OWNER/ADMIN. Current Test Connection uses a no-generation read-only provider lookup where possible.

### UX-SET-007 Non-manager experience
EDITOR/REVIEWER/ANALYST receive no credential mutation controls or raw secret values; safe provider availability may be shown when operationally useful.

**Current maturity:** OpenAI/LTX Integrations implemented; broader Settings partial.

## 9. Media Library

### UX-MEDIA-001 Library view
Baseline supports/targets a list view with asset type, identity/name, origin, linked content/job, created time and processing state.

### UX-MEDIA-002 Upload
Uploads show progress and validation failure; large files use controlled direct-storage paths where practical.

### UX-MEDIA-003 Asset detail
Show metadata, preview when supported, lineage/content links and safe provider/job state; never expose raw storage credentials.

### UX-MEDIA-004 Generated media
Phase 7-generated video already creates PAK-owned private `media_assets`; Phase 8 Media Library must surface those records rather than invent alternate identity.

**Current maturity:** Backend/generated-video foundation only; operator surface remains Phase 8.

## 10. Scene Planning

The original UX-SCENE IDs keep their original intent; additional Scene Planning behavior uses new IDs.

### UX-SCENE-001 Scene list
Each scene shows sequence/order, estimated duration, narration/script portion, visual direction and current generation/media state where applicable. The normalized current UI may show shots nested under each scene.

### UX-SCENE-002 Editing
Authorized editors may adjust permitted visual direction/timing fields before provider generation. Script-derived narration remains source-linked/read-only and provenance is preserved.

### UX-SCENE-003 Readiness
Final render CTA remains unavailable with explicit reasons until all required components are complete and QA-ready. Until Phase 8 implements final assembly, UI must not imply per-shot generation is a finished film.

### UX-SCENE-004 Entry states
No-project route shows a truthful Content Studio handoff state. Invalid/unavailable project IDs show safe non-leaking states.

### UX-SCENE-005 Production Brief and Visual Bible
Authorized editors may define project brief and Visual Bible state before/during draft planning; approved lifecycle restricts mutation.

### UX-SCENE-006 Manual edit constraints
Scene/shot forms expose only permitted editable fields. Narration source text is read-only. Manual shot edits visibly mark human modification and invalidate prior QC.

### UX-SCENE-007 Reordering
Move/reorder controls submit complete ordered identifier sets and preserve accessible feedback.

### UX-SCENE-008 Granular AI replan
`Replan Scene` / `Replan Shot` work only on authorized editable versions. Human-modified shots are protected by default and require explicit opt-in for AI replacement.

### UX-SCENE-009 QC
Expose blocker/warning/info state and `Run QC` when valid. A QC-required plan cannot misleadingly advance to review before QC reruns.

### UX-SCENE-010 Review and approval
Review/approve controls depend on role and lifecycle; warnings may require acknowledgement. Approved plans are read-only; further edits create a new version.

### UX-SCENE-011 Source freshness
Stale/source-changed plan state is visible and disables provider-generation actions until a current approved plan exists.

**Current maturity:** Implemented.

## 11. Approved-shot video generation

### UX-VID-001 Generate control
Only an APPROVED, source-current shot for OWNER/ADMIN/EDITOR exposes generation controls; UI submits identifiers only.

### UX-VID-002 State display
Display normalized PAK state such as queued, submitting/submitted, processing, import pending, completed, failed/retryable and terminal/unknown submission. Do not expose raw provider payload/result URL.

### UX-VID-003 Refresh/reconcile
Safe refresh/reconciliation does not cause duplicate provider submission.

### UX-VID-004 Retry
Retry appears only when authoritative backend state says retry is safe and within attempt limits.

### UX-VID-005 Completed media
Completed state references PAK-owned media identity, not provider URL.

### UX-VID-006 LTX dependency
Missing/invalid/disabled LTX produces actionable normalized integration state, not provider internals.

**Current maturity:** Implemented per-shot controls; final assembly remains governed by UX-SCENE-003 / Phase 8.

## 12. AI Representative

### UX-AIR-001 Workflow
Select approved content → representative/avatar/voice profile → preview configuration → generate job → review output.

### UX-AIR-002 Safety/traceability
Display approved script/version lineage.

**Current maturity:** Planned/readiness route.

## 13. Podcast

### UX-POD-001 Episode workspace
Title, objective, audience, approved Knowledge, language, format/duration; concept/script → audio/media → review.

**Current maturity:** Planned/readiness route.

## 14. Manual Generation

### UX-MAN-001 Editor
Create/edit a content artifact without AI; clearly mark Manual origin while preserving shared revision/approval/publishing behavior.

**Current maturity:** Foundation/readiness route; completion Phase 17.

## 15. Student Testimonials

### UX-TST-001 Record list
Show display/person label, consent/publication eligibility, content/media availability and lifecycle.

### UX-TST-002 Restricted data
Operational PII is not rendered in list views unless necessary; authorized detail only.

**Current maturity:** Planned/readiness route.

## 16. Campus / Locations

### UX-CAMP-001 Records
Provide structured location identity/facts with lifecycle and source linkage.

### UX-CAMP-002 Reuse
Approved location records may feed Knowledge/creative continuity workflows.

**Current maturity:** Planned/readiness route.

## 17. Content Calendar

### UX-CAL-001 Calendar
Baseline may start with date-grouped scheduled publication list before richer month/week views.

### UX-CAL-002 Reschedule
Rescheduling updates authoritative schedule and clearly displays timezone.

**Current maturity:** Planned/readiness route.

## 18. Approval Center

### UX-APR-001 Queue
Filters: Awaiting review / Changes requested / Approved / Rejected.

### UX-APR-002 Review screen
Show exact artifact/revision, source/translation status, Knowledge provenance, media previews and publication intent.

### UX-APR-003 Review actions
Approve / Request changes / Reject require explicit action; request/reject require comment; decisions become immutable audit history.

### UX-APR-004 Relationship to Scene Planning
Scene Planning's existing plan-level approval remains domain-specific behavior. Generic Approval Center integrates rather than overwrites that lifecycle.

**Current maturity:** Generic module missing; planned Phase 9.

## 19. Publishing

### UX-PUB-001 Channel cards
Show configured channels and health without secrets.

### UX-PUB-002 Publish workflow
Select eligible approved content, target channel/account, schedule/publish-now, preview normalized payload, submit.

### UX-PUB-003 Attempt status
Show durable publish status, safe external reference, timestamp and retry when safe.

**Current maturity:** Planned/readiness route.

## 20. Analytics

### UX-AN-001 Summary
KPIs: publications, reach/impressions, engagement, clicks/views where provider supports them.

### UX-AN-002 Freshness
Every metric panel indicates source/channel and last synchronization time.

### UX-AN-003 Empty/error state
Differentiate no data, integration missing, provider delay and synchronization failure.

**Current maturity:** Planned/readiness route.

## 21. Forms and validation

- Inline field errors near inputs.
- Server errors shown in a persistent form-level region.
- Buttons disabled only when action cannot proceed; workflow gates explain why.
- Password/secret inputs default obscured and never preload stored values.
- Never display full access tokens/API keys in confirmations.
- Unsaved edit state should not silently disappear during context switching.
- Provider/API internals are normalized before display.
- Paid-provider controls are unavailable when approval/source/integration prerequisites fail.

## 22. Responsive behavior

### Desktop
Persistent navigation, multi-column workspaces where useful, dense but readable administrative information.

### Mobile
Single-column critical flows, accessible navigation disclosure, cards instead of horizontal-table dependency and no critical control requiring horizontal overflow.

Current release verification includes mobile Scene Planning smoke at a narrow viewport. Content Studio, Knowledge Base, Scene Planning and Settings/Integrations should remain usable in modern mobile Chrome.

## 23. Accessibility baseline

- Semantic labels associated with inputs.
- Keyboard access to navigation, forms, disclosure controls and dialogs.
- Focus management for modal/dialog interactions where used.
- Error messages programmatically associated with invalid fields where practical.
- Status represented by text, not color alone.
- Readable typography and mobile-appropriate tap targets.
- Pending async operations exposed through visible status regions/labels.

## 24. Design-system direction

The current product is a technical, industrial, premium operations console with dark neutral operational surfaces, restrained contrast accents and dense-but-readable information hierarchy. Railway/engineering character may appear in branding, but workflow state clarity has priority over decoration.

Future visual refreshes may alter theme without changing semantic hierarchy, status meaning, accessibility or workflow-gate behavior.

## 25. UX acceptance rule

A screen is implemented only when its primary journey, loading/empty/error/success states, authorization behavior and responsive interaction are defined and verified. A readiness/placeholder page is intentionally Planned/Foundation only and must never be counted as implementation of the corresponding PRD workflow.