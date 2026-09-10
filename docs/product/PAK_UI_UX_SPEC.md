# PAK Marketing Automation — UI/UX Design Specification

**Document ID:** PAK-UX-001  
**Version:** 1.0  
**Status:** Baseline for review

## 1. UX objective

The product is an internal operations console, not a public marketing website. UX must optimize for clarity, traceability, safe actions, rapid review, and predictable workflow state. Users should always know: which organization they are in, what state an item is in, what action is available next, and whether an external integration is healthy.

## 2. Global layout

- **UX-SHELL-001** Persistent desktop left navigation for the 14 modules.
- **UX-SHELL-002** Mobile navigation collapses into an accessible menu/drawer.
- **UX-SHELL-003** Top-level context shows product name, active organization, signed-in user and role.
- **UX-SHELL-004** Destructive actions use explicit confirmation.
- **UX-SHELL-005** Async operations show `idle / submitting / success / failed` states and do not rely only on toast notifications.
- **UX-SHELL-006** Empty states explain the next action rather than showing blank tables.
- **UX-SHELL-007** Status labels use text in addition to visual styling; color alone cannot carry meaning.

## 3. Navigation

Primary navigation order is fixed for the baseline:

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

Navigation items that the user cannot use may be disabled/hidden only when doing so does not conceal relevant read-only state. Role authorization remains server/database controlled.

## 4. Dashboard screen

### UX-DASH-001 Header
Display active organization, role and concise system state.

### UX-DASH-002 Action cards
Show counts/links for:
- Draft content
- Awaiting approval
- Failed/retrying jobs
- Scheduled publications
- Integration issues

### UX-DASH-003 Recent activity
Chronological activity: content generation, review decisions, publish outcomes, integration changes. Never show raw secret changes beyond metadata like provider/action/actor/time.

## 5. Content Studio

### UX-CS-001 Composition form
Fields:
- Organization selector when user belongs to multiple organizations
- Topic
- Canonical language: EN / PL / HI
- Approved Knowledge Base sources selector
- Additional context
- Generate action

### UX-CS-002 Knowledge selector
- Shows metadata only: title, source type, source label, revision.
- Never renders full Knowledge content merely for selection.
- Displays `Selected X / 20`.
- Prevents selecting >20.
- Changing organization clears selection.
- Only ACTIVE sources appear.

### UX-CS-003 Generation state
Generate button enters pending state and prevents accidental duplicate submission. Failure stays on the form and shows safe actionable message. Success displays the canonical artifact and metadata.

### UX-CS-004 Artifact workspace
Display EN/PL/HI cards with:
- language
- canonical/source badge when applicable
- status
- revision
- generated script
- translation/source revision relationship
- Generate / Refresh / Retry action where valid

### UX-CS-005 Stale translation
Clearly mark a translation STALE after canonical source regeneration and offer refresh.

### UX-CS-006 Traceability
A generated item can expose a read-only `Sources used` drawer/detail view showing Knowledge source title, source metadata and revision snapshot. Full content snapshots may be visible only to authorized same-org users when needed for audit.

## 6. Knowledge Base

### UX-KB-001 Management list
Show title, status, source type, source label, revision and last update.

### UX-KB-002 Create form
Fields:
- Title
- Content
- Source type: Manual / Document / URL
- Source label
- Source reference

New records begin as DRAFT.

### UX-KB-003 Edit form
Managers can edit title, content, source type, source label and source reference. Current revision is visible.

### UX-KB-004 Lifecycle actions
- DRAFT → Activate
- ACTIVE → Archive
- ARCHIVED → Activate
- OWNER/ADMIN → Delete

Actions use current revision to detect stale edits.

### UX-KB-005 Read-only role experience
REVIEWER/ANALYST see ACTIVE records only and no mutation controls.

### UX-KB-006 Conflict state
If revision changed since page load, show a conflict message and prompt the user to reload rather than silently overwrite.

## 7. Settings

Settings tabs/sections:
- Organization
- Members
- Integrations
- Operational configuration

### UX-SET-001 Integrations overview
Provider cards display:
- Provider name/logo text
- Purpose
- `Not configured / Configured / Invalid` status
- Last verified time
- Last changed by/time
- Configure / Replace / Remove action based on role

### UX-SET-002 OpenAI configuration
Configuration form contains `API key` as password input. It is write-only from user perspective. After save, the UI clears the input and shows only masked metadata such as `Configured ••••abcd` if a safe suffix is explicitly stored.

Never preload the stored key back into the browser.

### UX-SET-003 Meta configuration
Provider form may include:
- App ID
- App Secret
- Access token
- Page/business/account identifiers
- WhatsApp phone number ID / business account ID where applicable
- Webhook verification metadata

Secret fields are write-only; non-secret identifiers may be readable/editable.

### UX-SET-004 Test connection
Where provider supports a safe validation operation, `Test connection` invokes server-side provider validation and returns only normalized health/result state.

### UX-SET-005 Secret removal
Remove requires confirmation and explains affected workflows.

## 8. Media Library

### UX-MEDIA-001 Library view
Grid/list toggle may be added later; baseline must support list view with asset type, name, origin, linked content, created time, processing state.

### UX-MEDIA-002 Upload
Uploads show progress and validation failure. Large files should upload directly to controlled storage paths rather than through oversized server-action bodies where avoidable.

### UX-MEDIA-003 Asset detail
Show metadata, preview when supported, lineage/content links and provider/job state. Raw storage credentials are never exposed.

## 9. Scene Planning

### UX-SCENE-001 Scene list
Each scene shows sequence, estimated duration, narration/script portion, visual direction, generation status and linked media.

### UX-SCENE-002 Editing
Authorized editor may adjust visual direction and duration before generation. Script-derived source text should preserve link/revision provenance.

### UX-SCENE-003 Readiness
Final render CTA is disabled with explicit reasons until all required scenes are complete and QA-ready.

## 10. AI Representative

### UX-AIR-001 Workflow
Select approved content → representative/avatar/voice profile → preview configuration → generate job → review output.

### UX-AIR-002 Safety/traceability
Display which approved script/version produced the representative media.

## 11. Podcast

### UX-POD-001 Episode workspace
Fields: title, objective, audience, approved Knowledge sources, language, format/duration. Output progresses from concept/script to generated audio/media and review.

## 12. Manual Generation

### UX-MAN-001 Editor
User can create/edit a content artifact without invoking AI. UI must make `Manual` origin clear while preserving same downstream approval/publishing workflow.

## 13. Student Testimonials

### UX-TST-001 Record list
Show person/display label, consent/publication eligibility state, content/media availability and lifecycle.

### UX-TST-002 Restricted data
Operational PII is not rendered in list views unless necessary; expose through authorized detail views only.

## 14. Content Calendar

### UX-CAL-001 Calendar
Month/week views can be phased; baseline should support date-grouped scheduled publication list with channel/status.

### UX-CAL-002 Reschedule
Rescheduling updates authoritative schedule state and clearly displays timezone.

## 15. Approval Center

### UX-APR-001 Queue
Filters: Awaiting review / Changes requested / Approved / Rejected.

### UX-APR-002 Review screen
Show content artifact, revision, source/translation status, Knowledge provenance summary, media previews and publication intent.

### UX-APR-003 Review actions
Approve / Request changes / Reject require explicit action; request/reject requires comment. Every decision becomes immutable audit history.

## 16. Publishing

### UX-PUB-001 Channel cards
Show configured channels and health without exposing secrets.

### UX-PUB-002 Publish workflow
Select eligible approved content, target channel/account, schedule/publish-now, preview normalized payload, submit.

### UX-PUB-003 Attempt status
Show QUEUED/PROCESSING/SUCCEEDED/FAILED-style publishing status mapped from durable job/provider state, external post/reference ID, timestamp and retry action when safe.

## 17. Analytics

### UX-AN-001 Summary
KPIs: publications, reach/impressions, engagement, clicks/views where provider supports them.

### UX-AN-002 Freshness
Every metric panel indicates source/channel and last synchronization time.

### UX-AN-003 Empty/error state
Differentiate: no data yet, integration missing, provider delay and synchronization failure.

## 18. Forms and validation

- Inline field errors near inputs.
- Server errors shown in a persistent form-level region.
- Buttons disabled only when action truly cannot proceed; explain why for workflow gates.
- Password/secret inputs default to obscured.
- Never display full access tokens/API keys in confirmation screens.
- Unsaved edit state should not be silently lost when switching organization/context.

## 19. Responsive behavior

### Desktop
Persistent navigation, two-column workspaces where useful, tables for high-density administration.

### Mobile
Single-column flows, sticky primary action when beneficial, cards instead of wide tables, no horizontal dependency for critical controls.

Core Content Studio, Knowledge Base, Approval Center and Settings/Integrations workflows must be fully usable in modern mobile Chrome.

## 20. Accessibility baseline

- Semantic labels associated with inputs.
- Keyboard access to navigation, forms, dialogs and selectors.
- Focus moves into dialogs and returns to trigger on close.
- Error messages are programmatically associated with invalid fields where practical.
- Status is represented by text, not color alone.
- Minimum readable body typography and tap-target sizing appropriate for mobile admin workflows.

## 21. Design-system direction

PAK UI should feel technical, industrial and premium rather than consumer-social. Favor neutral/light operational surfaces, strong typographic hierarchy, restrained accent usage, dense-but-readable data presentation, and railway/engineering visual language where branding is used. Functional state clarity always takes priority over decoration.

## 22. UX acceptance rule

A screen is not considered implemented because a route renders. It is implemented only when its primary user journey, loading/empty/error/success states, authorization behavior and responsive interaction are all defined and verified.