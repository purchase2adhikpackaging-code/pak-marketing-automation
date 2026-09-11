# PAK Marketing Automation — Development Roadmap

**Document ID:** PAK-RM-001  
**Version:** 1.0  
**Status:** Baseline for review

## Governance rule

No new feature slice starts without mapped PRD/TRD/UX/DB requirements and acceptance criteria. Each slice uses: design/spec → implementation plan → TDD → CI → runtime verification where applicable → PR review → merge.

## Phase 0 — Master baseline and implementation audit

Deliverables:
- Master PRD
- Master TRD
- UI/UX specification
- Backend schema
- System workflows
- Integration specification
- Roadmap
- Traceability matrix
- Existing implementation gap audit

Exit criteria:
- documentation reviewed as one baseline;
- requirement IDs stable enough for implementation mapping;
- existing code classified Implemented / Partial / Missing / Redesign.

## Phase 1 — Platform foundation — IMPLEMENTED

Scope:
- Next.js/TypeScript shell
- Supabase foundation
- organization membership/RBAC
- durable jobs foundation
- media/video provider abstractions
- initial scene/media schema
- errors/logging
- CI/E2E baseline

Status: implemented and merged; must still be reconciled against this master baseline.

## Phase 2 — AI Content Studio foundation — IMPLEMENTED

Scope:
- provider-neutral text generation
- OpenAI adapter
- fake provider
- content item persistence
- initial Content Studio generation UI/action

Status: implemented and merged.

## Phase 3 — Multilingual artifacts — IMPLEMENTED

Scope:
- EN/PL/HI artifacts
- canonical source relationship
- translation source revision
- stale translation model
- regeneration controls

Status: implemented and merged.

## Phase 4 — Knowledge Base grounding — IMPLEMENTED

Scope:
- DRAFT/ACTIVE/ARCHIVED records
- source metadata
- role-aware visibility/mutations
- deterministic selector
- server-side grounding
- immutable provenance snapshots
- live Supabase RLS/runtime verification

Status: implemented and merged after review hardening.

## Phase 5 — Integration Vault & real staging deployment — NEXT

Requirements:
- PRD-SET-001..009
- TRD-SEC-001..009
- INT-GEN-001..007
- INT-OAI-001..007

Deliverables:
- integration_connections
- encrypted integration_secrets
- immutable integration_audit_events
- server-only credential resolver
- Settings → Integrations UI
- OpenAI configure/replace/remove/test flow
- Content Studio runtime resolver uses saved organization OpenAI key
- Next.js staging deployment connected to PAK Supabase
- real Chrome manual verification

Exit criteria:
- user can open hosted PAK Settings in Chrome;
- OWNER/ADMIN can save OpenAI key without exposing it back to browser;
- Content Studio generates using the stored credential;
- no secret appears in HTML/client state/logs;
- staging smoke test and live RLS/security probes pass.

## Phase 6 — Scene Planning — IMPLEMENTED

Requirements:
- PRD-VID-001..003
- UX-SCENE-001..003
- TRD-VID-002/006

Delivered:
- persisted Content Studio script-artifact handoff into Scene Planning
- tenant-scoped video projects and versioned Visual Bible state
- versioned scene/shot plan graph with exact canonical narration linkage
- provider-neutral structured planner with strict server-side validation
- deterministic QC for source freshness, narration coverage, timing, references, and generation requirements
- manual scene/shot editing and reordering with QC invalidation
- granular one-scene / one-shot replanning with human-modified protection
- role-gated review, warning acknowledgement, approval, and copy-on-write editing
- database RLS, parent-organization guards, lifecycle guards, approved-version immutability, and reviewer mutation constraints
- immutable provider-neutral handoff contract for Phase 7
- no video-provider execution, provider URLs, or provider job IDs in Phase 6

Verification:
- exact-head typecheck, lint, unit, production build, and Playwright release gate
- live PAK Supabase migrations and RLS/function privilege probes
- live anonymous negative visibility probe
- Supabase security/performance advisor review with Phase 6 advisor findings hardened before release

Exit criteria:
- persisted generated artifacts can create, edit, replan, QC, review, and approve deterministic scene/shot plans;
- approved plans are immutable and source-bound;
- only approved, current plans expose a Phase 7-ready provider-neutral handoff.

## Phase 7 — Video generation provider integration — NEXT

Requirements:
- PRD-VID-004..007
- INT-VID-001..005
- TRD-JOB/VID requirements

Deliverables:
- real LTX adapter or selected primary provider
- credential configuration through Integration Vault
- submit/status/result reconciliation
- per-scene durable jobs
- media import/linkage
- retry/error mapping

Exit criteria:
- one scene can be generated end-to-end on staging;
- provider failure/retry paths verified;
- no provider secret exposure.

## Phase 8 — Final video assembly & Media Library expansion

Deliverables:
- final assembly job
- scene ordering and media readiness validation
- final video asset
- Media Library previews/lineage
- download/access authorization

## Phase 9 — Approval Center

Requirements:
- PRD-APR-001..005
- UX-APR-001..003

Deliverables:
- approval_requests
- immutable approval_events
- exact artifact/revision review
- approve/request-changes/reject
- supersede approval after content revision

## Phase 10 — Publishing foundation + Meta

Requirements:
- PRD-PUB-001..006
- INT-META-001..007
- UX-PUB-001..003

Deliverables:
- Meta integration credential schema/forms
- publication_targets
- publication_attempts
- durable publish jobs
- idempotency/reconciliation
- initial Facebook/Instagram publishing path
- WhatsApp only where product use case is explicitly defined and compliant

## Phase 11 — Content Calendar

Deliverables:
- scheduled publication projection
- timezone-safe scheduling
- reschedule/cancel
- calendar/list UX

## Phase 12 — Analytics

Deliverables:
- metric sync jobs
- provider watermarks
- normalized daily metrics
- freshness/error UX
- analyst read-only dashboard

## Phase 13 — AI Representative

Deliverables:
- approved-script selection
- representative profile/provider abstraction
- generation job
- media lineage
- review/publishing integration

## Phase 14 — Podcast

Deliverables:
- episode workspace
- script/knowledge flow
- audio provider abstraction
- media output
- approval/publishing linkage

## Phase 15 — Campus Locations

Deliverables:
- structured campus/location records
- approved facts
- location-specific content templates/workflows

## Phase 16 — Student Testimonials

Deliverables:
- testimonial records
- consent/publication state
- restricted data boundary
- media linkage
- adapted-content governance

## Phase 17 — Manual Generation completion

Deliverables:
- rich manual authoring path using shared artifact/revision/approval model
- no AI dependency

## Release policy

For every phase:
1. create feature branch;
2. write/approve slice design if architecture changes;
3. write implementation plan;
4. TDD RED/GREEN for behavior changes;
5. run typecheck/lint/unit/build/E2E;
6. run live Supabase RLS/runtime probes for auth/schema/security changes;
7. resolve all review threads;
8. merge only exact green head;
9. deploy to staging;
10. manual Chrome verification for user-visible workflows before production promotion.