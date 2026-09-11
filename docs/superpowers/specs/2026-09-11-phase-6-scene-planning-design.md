# Phase 6 — Scene Planning Design

## Status
Approved by product owner via delegated CTO authority. Routine architecture, provider, sequencing, quality, and integration decisions do not require repeated approval. Escalate only material cost, brand-policy, or business-policy decisions.

## Goal
Build the creative planning brain between approved multilingual content and downstream AI video generation. Phase 6 converts a locked canonical script into a versioned, auditable, provider-neutral scene and shot plan that is production-ready for LTX in Phase 7 without allowing the video model to rewrite approved messaging.

## Product Standard
The target is international-grade institutional marketing, not a collection of AI-looking clips. Output should feel credible enough for LinkedIn, YouTube, Meta, partner presentations, and institutional campaigns: cinematic but believable, restrained camera language, consistent people and environments, clean pacing, strong narration discipline, and no gratuitous AI motion.

### First end-to-end test film
A 45–60 second institutional credibility film for Polish Railway Academy. The creative direction should emphasize railway professionalism, technical training, European operating context, safety culture, precision, modern learning, and international credibility without inventing unsupported claims. The test is intended to judge visual continuity, realism, pacing, audio synchronization, and overall professional finish—not merely whether clips can be generated.

## Architectural boundary
Phase 6 owns planning only. It may generate provider-neutral master prompts and audio/SFX intent, but it does not create external video jobs or persist provider response objects.

Canonical flow:

`Approved Content Artifact -> Video Project -> Visual Bible -> Scene Plan Version -> Scenes -> Shots`

Phase 7 begins after an approved shot plan:

`Approved Shot -> Provider Adapter -> LTX Request -> Generation Job -> Generated Asset`

## Core rules
1. Canonical narration is the source of truth.
2. No LTX/provider may rewrite approved narration.
3. Scene = narrative unit; shot = generation unit.
4. Scene boundaries follow meaning; shot boundaries follow camera/action changes.
5. Shot duration is adaptive. Default target is 5–10 seconds; provider constraints are enforced at adapter time. LTX currently supports up to 20 seconds per request, so Phase 6 should remain conservative and not hardwire provider-specific minimums/maximums into the domain model.
6. Provider-neutral master prompts are stored; LTX-specific request syntax belongs to Phase 7 adapters.
7. Plans are versioned. Approved plans are immutable.
8. Granular edits use copy-on-write versions rather than silently mutating an approved version.
9. A source-artifact change makes dependent plans STALE.
10. Expensive generation cannot begin from a plan that has not passed deterministic QC and approval.

## Data model

### video_projects
One row per source artifact / target production intent.

Core fields:
- id UUID
- organization_id UUID
- source_content_id UUID / source artifact identifier
- source_artifact_version or immutable source reference
- source_integrity_hash text
- language text
- title text
- purpose text
- target_platform text[]
- aspect_ratio enum/string
- target_duration_seconds numeric
- quality_profile enum: `STANDARD | PREMIUM | CINEMATIC`
- audience text/jsonb
- production_constraints jsonb
- status enum
- created_by UUID
- created_at / updated_at

### visual_bibles
One active visual bible per video project version lineage.

Structured sections:
- characters / recurring people
- identity descriptors and reference dependencies
- wardrobe
- locations / environment language
- props
- palette
- lighting language
- realism level
- cinematography language
- logo treatment
- typography treatment
- cultural constraints
- forbidden traits
- global negative constraints

The visual bible is creative continuity authority, not a provider request payload.

### scene_plan_versions
Immutable once approved.

Core fields:
- id
- organization_id
- video_project_id
- version_number
- source_integrity_hash
- parent_version_id nullable
- status: `DRAFT | PLANNING | QC_REQUIRED | REVIEW_REQUIRED | APPROVED | FAILED | STALE | SUPERSEDED`
- planner_provider / planner_model metadata
- creative_brief_snapshot jsonb
- visual_bible_snapshot jsonb
- total_duration_seconds
- narration_coverage_hash
- qc_summary jsonb
- created_by / approved_by
- timestamps

### scenes
Ordered narrative units.

Core fields:
- id
- scene_plan_version_id
- ordinal
- title
- narrative_role (`HOOK`, `SETUP`, `EXPLANATION`, `PROOF`, `TRANSITION`, `CTA`, `OTHER`)
- narration_text / exact source span metadata
- narrative_objective
- emotional_objective
- duration_seconds
- continuity_context jsonb
- creative_direction text

### shots
Ordered generation units.

Core fields:
- id
- scene_id
- ordinal
- duration_seconds
- narration_text
- narration_start_char / narration_end_char exact canonical [start,end) source span (nullable only for silent shots)
- creative_direction text
- master_visual_prompt text
- negative_constraints text/jsonb
- subject_refs jsonb
- location_refs jsonb
- composition
- shot_size
- camera_angle
- lens_intent
- camera_motion
- subject_motion
- environment_motion
- depth_of_field_intent
- lighting
- mood
- transition_in
- transition_out
- ambience_intent
- sfx_intent
- music_intent
- aspect_ratio
- continuity_state jsonb
- generation_requirements jsonb
- human_modified boolean

## Audio authority
The canonical narration remains authoritative. Provider-generated audio may be used for ambience, room tone, natural environmental sound, SFX, or music intent. If later using LTX Audio-to-Video, the supplied canonical narration track is an input condition; LTX must not replace the approved words.

## Planner intelligence
Default planner model: `gpt-5.6-terra` for high-quality scene/shot reasoning. `gpt-5.6-luna` remains a cost-saving alternative.

Planner receives only:
- exact approved content artifact
- production brief
- target duration/platform/aspect ratio
- visual bible
- current plan context for granular replans

Planner does not independently rewrite facts from the Knowledge Base. Grounding happened upstream in Content Studio.

Planner output must be strict structured data validated server-side before persistence.

## Continuity engine
Continuity is first-class domain state.

The planner maintains:
- recurring subject identity
- wardrobe state
- location state
- time-of-day
- prop state
- screen direction when relevant
- lighting state
- camera grammar
- palette / visual motif
- prior-shot action end-state

Shots inherit defaults from Visual Bible and scene continuity context. Shot-specific overrides are explicit.

## Quality-control engine
QC runs before review/approval and again whenever a dependent field changes.

Severity:
- BLOCKER: prevents approval
- WARNING: requires acknowledgement or deliberate override
- INFO: advisory

Deterministic checks include:
- source artifact still matches integrity fingerprint
- 100% narration coverage
- no narration overlap/duplication
- no missing narration segments
- total planned runtime within configured tolerance
- each shot has positive duration
- shot order and scene order are contiguous
- required generation fields present
- aspect ratio consistency
- visual bible references resolve
- continuity contradictions
- duplicate/near-duplicate consecutive visual ideas
- contradictory camera instructions
- impossible motion combinations
- unsupported dialogue invented by the planner
- logo/text requirements that video generators are likely to render unreliably are flagged for post-production overlay
- human-edited fields are never silently overwritten by AI replan

## Workflow

### Create project
Content Studio exposes a real downstream action on an approved artifact: `Create Scene Plan`.

Server flow:
1. authorize actor and organization membership
2. verify source artifact is valid/approved for planning
3. snapshot immutable artifact identity/hash
4. create video project
5. capture production brief
6. create/seed visual bible

### Generate plan
`Generate Scene Plan` server flow:
1. authorize
2. validate project
3. lock source artifact identity
4. assemble script + brief + visual bible
5. call planner
6. validate strict response schema
7. normalize ordering/duration representation
8. persist a DRAFT version transactionally
9. run deterministic QC
10. transition to QC_REQUIRED or REVIEW_REQUIRED depending on findings

The AI never writes directly to database tables.

### Granular editing
Supported operations:
- manual shot edit
- manual scene edit
- replan one shot
- replan one scene
- reorder within allowed structure
- adjust duration
- update visual bible
- rerun QC

Changing a global visual-bible field flags dependent draft shots for re-evaluation. Approved versions remain immutable and may be cloned to a new draft.

### Approval
Only `APPROVED` versions are eligible for Phase 7 generation.

No `Generate Video` action exists for unapproved plans.
