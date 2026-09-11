# PAK Marketing Automation — UI/UX Design Specification

**Document ID:** PAK-UX-001  
**Version:** 1.1  
**Status:** Current baseline after Phase 7

## 1. UX objective

PAK is an internal operations console, not a public marketing website. UX optimizes for clarity, traceability, safe actions, rapid review and predictable workflow state. Users should always understand:

- which organization they are operating in;
- their current role/permission context;
- the authoritative state of the item;
- what action is available next;
- why a gated action is unavailable;
- whether an external integration is healthy;
- whether work is complete, queued, retrying, stale or blocked.

A route is not considered implemented merely because it renders. Primary journey, loading/empty/error/success states, authorization and responsive behavior must exist.

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

- **UX-SHELL-001** Persistent desktop left navigation for 15 primary modules.
- **UX-SHELL-002** Mobile navigation collapses into an accessible disclosure/menu.
- **UX-SHELL-003** Top-level context shows product/workspace identity plus active organization/user/role where applicable.
- **UX-SHELL-004** Destructive actions require explicit confirmation.
- **UX-SHELL-005** Async operations expose visible idle/submitting/success/failed state and do not rely only on transient toasts.
- **UX-SHELL-006** Empty states explain the next valid action.
- **UX-SHELL-007** Status uses text in addition to visual styling; color alone never carries meaning.
- **UX-SHELL-008** Planned/foundation modules clearly state availability, roadmap phase and implemented alternatives.

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
Ultimately show counts/links for:
- draft content;
- awaiting approval;
- failed/retrying jobs;
- scheduled publications;
- integration issues.

### UX-DASH-003 Recent activity
Chronological activity should include content generation, review decisions, provider/job outcomes and integration metadata changes without exposing secret values.

**Current maturity:** Partial until Approval/Publishing/Calendar provide authoritative data.

## 6. Content Studio

### UX-CS-001 Composition form
Fields:
- Organization selector when user belongs to multiple organizations;
- Topic;
- Canonical language EN / PL / HI;
- Approved Knowledge sources;
- Additional context;
- Generate action.

### UX-CS-002 Knowledge selector
- metadata only: title, source type, source label, revision;
- never renders full Knowledge content merely for selection;
- `Selected X / 20`;
- maximum 20;
- changing organization clears selection;
- ACTIVE sources only.

### UX-CS-003 Generation state
Generate action enters pending state and prevents accidental duplicate submission. Failure remains visible with a safe actionable message. Success displays canonical artifact and metadata.

### UX-CS-004 Artifact workspace
Display EN/PL/HI artifact cards with language, canonical badge, status, revision, script, source-revision relationship and valid generate/refresh/retry controls.

### UX-CS-005 Stale translation
STALE translations are visibly differentiated and offer refresh.

### UX-CS-006 Traceability
Generated content can expose read-only source provenance metadata to authorized same-org users.

### UX-CS-007 Scene Planning handoff
A GENERATED artifact may show `Create Scene Plan`. Handoff navigates to the persisted project; script identity/content is resolved server-side rather than copied from browser state.

**Current maturity:** Implemented.

## 7. Knowledge Base

### UX-KB-001 Management list
Show title, status, source type, source label, revision and last update.

### UX-KB-002 Create form
Fields: title, content, source type, source label, source reference. New records begin DRAFT.

### UX-KB-003 Edit form
Managers edit business fields with visible current revision.

### UX-KB-004 Lifecycle actions
- DRAFT → Activate
- ACTIVE → Archive
- ARCHIVED → Activate
- OWNER/ADMIN → Delete

### UX-KB-005 Read-only role experience
REVIEWER/ANALYST see ACTIVE records only and no mutation controls.

### UX-KB-006 Conflict state
Revision conflict shows an explicit reload/retry path instead of silent overwrite.

**Current maturity:** Implemented.

## 8. Scene Planning

Scene Planning is a first-class module in the current product baseline.

### UX-SCENE-001 Entry states
Without a project query, show a truthful empty state linking back to Content Studio. Invalid/unavailable project IDs show safe non-leaking states.

### UX-SCENE-002 Production Brief and Visual Bible
Authorized editors may define project brief and Visual Bible fields before/during draft planning. Approved plan lifecycle restricts mutation appropriately.

### UX-SCENE-003 Scene/shot hierarchy
Scene cards are collapsible and show:
- scene order/title/role;
- duration;
- canonical narration span;
- creative direction;
- ordered shots.

Shot detail shows:
- duration;
- narration as read-only canonical source span;
- creative direction;
- generation specification/master prompt;
- camera motion and continuity/generation metadata;
- human-modified indicator where applicable.

### UX-SCENE-004 Manual editing
OWNER/ADMIN/EDITOR may edit permitted draft fields only. Narration source text is not an editable provider prompt surrogate. Manual mutations invalidate prior QC and return workflow to QC-required state.

### UX-SCENE-005 Reordering
Move/reorder actions submit complete ordered identifier sets and preserve accessible feedback/state.

### UX-SCENE-006 Granular AI replan
`Replan Scene` / `Replan Shot` operate only on authorized editable versions. Human-modified shots are protected by default; explicit opt-in is required before AI may replace them.

### UX-SCENE-007 QC
Expose blocker/warning/info counts and a `Run QC` action when valid. Plans requiring QC cannot falsely advance through a misleading review action.

### UX-SCENE-008 Review and approval
Review/approve controls depend on role and lifecycle. Warnings may require explicit acknowledgement. Approved plans are read-only; editing creates a new version/copy-on-write path.

### UX-SCENE-009 Source freshness
Stale/source-changed plan state is visible and disables provider-generation actions until a current approved plan exists.

**Current maturity:** Implemented.

## 9. Approved-shot video generation

### UX-VID-001 Generate control
Only an APPROVED, source-current shot for OWNER/ADMIN/EDITOR exposes generation controls. UI submits identifiers only.

### UX-VID-002 State display
Normalize and display PAK job/attempt state such as:
- queued;
- submitting/submitted;
- processing;
- import pending;
- completed;
- failed/retryable;
- terminal/unknown submission.

Do not expose raw provider payloads or provider result URLs.

### UX-VID-003 Refresh/reconcile
User may request safe refresh/reconciliation for an existing attempt without causing a duplicate provider submission.

### UX-VID-004 Retry
Retry is shown only when backend state says it is safe/retryable and attempt limits permit it. UI does not implement retry policy independently.

### UX-VID-005 Completed media
Completed state references the PAK-owned media asset, not the provider URL.

### UX-VID-006 LTX dependency
When LTX is not configured/valid/enabled, show an actionable normalized integration message rather than provider internals.

### UX-VID-007 Final assembly
Final assembled video controls are not present until Phase 8 implements readiness/assembly. The UI must not imply that per-shot generation equals a finished film.

**Current maturity:** Per-shot controls implemented; final assembly missing.

## 10. Settings

Current Settings implementation is Integration-focused. Organization, Members and broader operational-configuration sections remain roadmap work unless separately implemented.

### UX-SET-001 Integrations overview
Provider cards display:
- provider name;
- purpose;
- Not configured / Configured / Invalid / Disabled state;
- masked safe hint where stored;
- last verified time;
- role-appropriate actions.

### UX-SET-002 OpenAI configuration
Password/write-only API-key input. After save, clear the input and display only masked metadata. Supported model selection is allowlisted.

### UX-SET-003 LTX configuration
Password/write-only API-key input with Save / Remove / Enable / Disable / Test actions for OWNER/ADMIN.

The test action performs a no-spend authenticated provider validation where possible and returns normalized health only.

### UX-SET-004 Meta configuration
Future provider form may include App ID, App Secret, access token, page/business/account identifiers and webhook verification metadata. Secret fields remain write-only.

### UX-SET-005 Secret removal
Removal requires confirmation and explains affected workflows.

### UX-SET-006 Non-manager experience
EDITOR/REVIEWER/ANALYST must not receive credential mutation controls or raw secret values. Where integration availability is useful, expose safe status only.

**Current maturity:** OpenAI/LTX Integrations implemented; broader Settings sections partial.

## 11. Media Library

### UX-MEDIA-001 Library view
Phase 8 baseline should provide list/catalogue view with asset type, name/identifier, origin, linked job/content, created time and processing/lifecycle state.

### UX-MEDIA-002 Upload
Uploads show progress and validation failures. Large files should upload directly to controlled storage paths rather than oversized server-action payloads.

### UX-MEDIA-003 Asset detail
Show preview, metadata, checksum/lineage where useful, content/job links and safe provider generation state.

### UX-MEDIA-004 Generated media
Phase 7 generated video already creates PAK-owned private media records. Phase 8 must surface them without inventing alternate media identity.

**Current maturity:** Backend/generated-video foundation only; operator surface remains Phase 8.

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
Create/edit an artifact without invoking AI. Clearly label Manual origin while preserving shared revision/approval/publishing behavior.

**Current maturity:** Foundation/readiness route; completion Phase 17.

## 15. Student Testimonials

### UX-TST-001 Record list
Show display label, consent/publication eligibility, content/media availability and lifecycle.

### UX-TST-002 Restricted data
Operational PII is not rendered in list views unless necessary; authorized detail only.

**Current maturity:** Planned/readiness route.

## 16. Campus / Locations

### UX-CAMP-001 Records
Provide structured location identity/facts with lifecycle and source linkage.

### UX-CAMP-002 Reuse
Approved location records can feed Knowledge/creative continuity workflows.

**Current maturity:** Planned/readiness route.

## 17. Content Calendar

### UX-CAL-001 Calendar/list
Baseline may start with date-grouped scheduled publication list before richer month/week views.

### UX-CAL-002 Reschedule
Rescheduling updates authoritative publishing schedule and displays timezone.

**Current maturity:** Planned/readiness route.

## 18. Approval Center

### UX-APR-001 Queue
Filters: Awaiting review / Changes requested / Approved / Rejected.

### UX-APR-002 Review screen
Show exact content/artifact revision, translation/source state, Knowledge provenance, media previews and publication intent.

### UX-APR-003 Review actions
Approve / Request changes / Reject require explicit action; request/reject require comment. Decisions become immutable audit history.

### UX-APR-004 Relationship to Scene Planning
Scene Planning's existing plan-level approval remains valid domain-specific behavior. Generic Approval Center must integrate rather than overwrite that lifecycle.

**Current maturity:** Generic module missing; planned Phase 9.

## 19. Publishing

### UX-PUB-001 Channel cards
Show configured channels and health without exposing secrets.

### UX-PUB-002 Publish workflow
Select eligible approved content, target account/channel, schedule/publish-now, preview normalized payload, submit.

### UX-PUB-003 Attempt status
Show durable publish status, external safe reference, timestamp and retry when safe.

**Current maturity:** Planned/readiness route.

## 20. Analytics

### UX-AN-001 Summary
KPIs by available provider: publications, reach/impressions, engagement, clicks/views.

### UX-AN-002 Freshness
Every metric panel indicates source/channel and last synchronization time.

### UX-AN-003 Empty/error state
Differentiate no data, missing integration, provider delay and synchronization failure.

**Current maturity:** Planned/readiness route.

## 21. Forms and validation

- Inline field errors near inputs.
- Server errors remain visible in a persistent form/action region.
- Buttons disable only when action cannot proceed; workflow gates explain why.
- Secret inputs default to obscured and are never preloaded with stored values.
- Confirmation screens never display full access tokens/API keys.
- Unsaved edit state should not be silently lost during context switching.
- Provider/API error internals are normalized before display.
- Paid-provider controls must not render as active when approval/source/integration prerequisites fail.

## 22. Responsive behavior

### Desktop
Persistent navigation, multi-column workspaces where useful, dense but readable administrative information.

### Mobile
Single-column critical flows, accessible navigation disclosure, cards instead of horizontal-table dependency, no critical control requiring horizontal overflow.

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

A screen is implemented only when its primary user journey, loading/empty/error/success states, authorization behavior and responsive interaction are defined and verified. A readiness/placeholder page is intentionally classified as Planned/Foundation only and must never be counted as implementation of the corresponding PRD workflow.