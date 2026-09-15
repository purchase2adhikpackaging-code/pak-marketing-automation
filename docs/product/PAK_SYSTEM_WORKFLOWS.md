# PAK Marketing Automation — System Workflow & State Machine Specification

**Document ID:** PAK-WF-001  
**Version:** 1.2  
**Status:** Current baseline through Organization Profile / Brand Kit / Knowledge ingestion foundation

## 1. Organization Profile workflow

1. Organization creation/backfill guarantees one Profile row at revision 1.
2. Organization members may read the authoritative Profile.
3. Only OWNER/ADMIN receive editable controls and may submit a mutation.
4. Server validates input, actor and membership.
5. Update uses expected revision / compare-and-set semantics.
6. Database revision guard requires exactly `old revision + 1` and preserves creation audit fields.
7. Trigger controls update actor/time.
8. Stale revision fails instead of silently overwriting.
9. EDITOR/REVIEWER/ANALYST remain read-only even if they attempt a direct Data API update.

## 2. Brand Kit workflow

1. Organization creation/backfill guarantees one Brand Kit row at revision 1.
2. Organization members may read Brand Kit metadata.
3. OWNER/ADMIN edit palette, typography, voice, logo rules, visual constraints and Media Library asset assignments.
4. Browser submits safe Media asset UUIDs, never signed URLs or raw storage paths.
5. `save_organization_brand_kit(...)` revalidates actor/role and expected Brand Kit revision.
6. Every referenced asset must be same-org, ACTIVE, IMAGE and image MIME.
7. Cross-org/unavailable assets fail without becoming Brand identity.
8. Brand Kit revision and semantic asset relationships are persisted atomically.
9. Active assets assigned to the Brand Kit cannot be silently archived while still referenced.
10. EDITOR/REVIEWER/ANALYST cannot mutate Brand Kit or asset links.

Semantic asset roles:
`PRIMARY_LOGO | LIGHT_LOGO | DARK_LOGO | BRAND_MARK | FAVICON | APPROVED_IMAGERY`.

## 3. Knowledge lifecycle

`DRAFT → ACTIVE → ARCHIVED → ACTIVE`

Delete is OWNER/ADMIN only and is not a normal lifecycle transition.

Rules:
- DRAFT is editable but not eligible for grounding.
- ACTIVE normal Knowledge is eligible for explicit selection.
- ACTIVE Core Knowledge is automatically grounded.
- ARCHIVED is retained for history but excluded from new grounding.
- Every successful business lifecycle/content update increments revision exactly once.
- stale revision writes fail rather than silently overwrite.
- only OWNER/ADMIN may insert `is_core=true` or change Core status; EDITOR may manage only normal Knowledge.

## 4. File Knowledge ingestion

Supported formats: PDF, DOCX, PPTX, TXT.

1. OWNER/ADMIN/EDITOR selects a local document in Knowledge Base.
2. Browser uses the existing private Media Library upload workflow.
3. Upload validates supported document type/size and returns a PAK `media_asset_id`; private object path/signed upload URL remain transport details.
4. Knowledge action receives organization ID, Media asset ID, format and optional source title.
5. Server validates actor and manager role.
6. Repository/source-integrity boundary verifies same-org ACTIVE DOCUMENT Media asset.
7. Server reads source bytes through the trusted private-media boundary and extracts bounded text.
8. Extraction finalizer records document source fingerprint/metadata and creates linked Knowledge atomically.
9. Resulting Knowledge is always `DRAFT`, `is_core=false` unless later explicitly changed by OWNER/ADMIN, and carries document lineage.
10. UI shows `Draft created for review` and separate Activate action.
11. Human verifies extracted content before activation.

Failure rules:
- cross-org source IDs fail; RLS may intentionally make them appear unavailable rather than disclose tenant existence;
- unsupported or malformed source fails safely;
- extraction failure never creates ACTIVE Knowledge;
- raw private storage path/signed URL is never accepted as durable source identity from browser input.

## 5. URL Knowledge ingestion

1. OWNER/ADMIN/EDITOR supplies source title + HTTP/HTTPS URL.
2. Server validates actor/organization role.
3. URL safety rejects unsupported schemes, loopback, private, link-local, cloud-metadata and unsafe redirect destinations.
4. Server fetches bounded content and sanitizes/extracts text.
5. Source lineage is stored as canonical safe URL metadata; no private Media asset is required for URL source.
6. Finalizer persists extraction result and linked Knowledge in one transaction.
7. Resulting Knowledge is DRAFT only.
8. User explicitly reviews/activates later.

OCR, XLSX and CSV ingestion are not part of this workflow.

## 6. Shared organization generation-context resolution

Every relevant canonical generation uses one server-only context resolver.

Input from browser/caller:
- organization ID;
- optional selected Knowledge UUIDs;
- optional bounded task/additional context.

Resolver sequence:
1. load authoritative Organization Profile;
2. load authoritative Brand Kit;
3. load all same-org ACTIVE Core Knowledge deterministically;
4. normalize selected IDs by first-occurrence order;
5. load same-org selected Knowledge;
6. reject missing/cross-org/non-ACTIVE selections;
7. remove selected records already represented as Core;
8. compose bounded context in exact order:
   `Profile → Brand Kit → Core Knowledge → Selected Knowledge → Task context`;
9. emit exact revision/source metadata for provenance.

Browser-supplied Profile/Brand text is never authoritative.

## 7. Grounded canonical generation

1. User opens Content Studio.
2. Server resolves eligible organizations.
3. User supplies topic, canonical language, optional selected ACTIVE Knowledge IDs and optional Additional context.
4. Server validates input and actor/role.
5. Shared generation-context resolver loads Profile + Brand + Core + selected Knowledge.
6. Context is bounded before provider invocation.
7. Content item enters generation workflow.
8. Text provider generates canonical script using the authoritative composed context.
9. Content item stores safe generated/provider metadata.
10. `persist_content_generation_provenance(...)` atomically validates and writes:
    - exact Profile revision;
    - exact Brand Kit revision;
    - exact Core/selected Knowledge snapshots.
11. If provenance persistence fails, item is marked FAILED with safe provenance failure metadata and the source artifact is not exposed as successful.
12. If provenance succeeds, canonical source artifact is ensured.
13. UI returns canonical artifact and traceability metadata.

## 8. Canonical regeneration / translation

Canonical source regeneration and EN/PL/HI translation retain the existing artifact state model:
- source regeneration increments canonical revision;
- stale translations become STALE;
- translation target records the source revision used;
- failed generation does not erase the last successful canonical text.

## 9. Integration credential workflow

### Configure / replace
1. OWNER/ADMIN opens Settings → Integrations.
2. User enters provider secret in a write-only field.
3. Server validates actor/organization/role.
4. Privileged Vault boundary persists secret.
5. metadata/reference and audit rows update without returning raw secret.

### Remove / test
- removal requires confirmation and audit;
- connection tests resolve secret only in privileged runtime and return normalized health;
- LTX validation remains non-generation/read-only where supported.

## 10. Content Studio → Scene Planning handoff

Precondition: script artifact is GENERATED and eligible for planning.

1. Browser submits artifact identity, not trusted script body.
2. Server reloads artifact/content under organization authorization.
3. Server computes source-integrity hash.
4. `video_project` is created with source linkage and production brief defaults.
5. User enters persisted Scene Planning workspace.

## 11. Scene Planning with institutional Brand authority

Canonical hierarchy:
`Video Project → Visual Bible → Scene Plan Version → Scenes → Shots`.

### Draft generation
1. Authorized OWNER/ADMIN/EDITOR edits Production Brief / Visual Bible.
2. Server reloads current source artifact and current Brand Kit.
3. Brand Kit maps institutional defaults: palette, typography, brand voice, logo usage/visual constraints and official logo asset identity.
4. Explicit Visual Bible project styling remains creative-direction authority where specified.
5. Official logo asset identity remains separate institutional authority and cannot be replaced/redrawn/substituted by Visual Bible creative state.
6. Structured planner receives institutional Brand + effective Visual Bible + authoritative narration.
7. Strict schema validates output and exact narration spans.
8. Draft graph persists atomically with Brand Kit revision/institutional brand snapshot and Visual Bible snapshot.
9. Plan enters QC_REQUIRED before review.

### Manual edit / replan / QC / approval
Existing rules remain:
- narration remains source-linked/read-only;
- manual shot changes mark human modification and invalidate stale QC;
- granular replans cannot mutate outside scope and protect human-modified shots by default;
- deterministic QC checks source freshness, ordering, timing, narration coverage and generation requirements;
- blockers prevent approval; warnings may require acknowledgement;
- approved versions are immutable; later changes use new-version/copy-on-write semantics.

## 12. Approved-shot video generation

Preconditions:
- OWNER/ADMIN/EDITOR;
- approved/current plan;
- no blocker QC;
- valid shot lineage and supported generation profile.

Browser submits identifiers only. Authenticated enqueue reconstructs trusted prompt/model/duration/aspect ratio from persisted approved state, creates idempotent durable job/attempt lineage, and normal browser roles cannot directly insert/update provider attempts.

Provider submit/reconcile/import retains the established state model:
`QUEUED → SUBMITTING → SUBMITTED ↔ PROCESSING → IMPORT_PENDING → COMPLETED`
with bounded FAILED/retry behavior and `SUBMISSION_UNKNOWN` protected from blind automatic resubmission.

Provider result URL remains ephemeral; completion requires import into private PAK Media Library identity.

## 13. Final video assembly

Implemented Phase 8 workflow:
1. approved/current/blocker-free plan is checked;
2. every required shot/component must resolve to successful PAK-owned media;
3. deterministic `FINAL_VIDEO_ASSEMBLY` job captures immutable component snapshot and render profile;
4. privileged worker claims job;
5. worker downloads signed private inputs, runs FFmpeg/ffprobe under PAK render profile, uploads signed output and finalizes result;
6. final output becomes an organization-scoped Media Library asset with checksum/lineage;
7. job succeeds only after durable final media persistence.

Browser never receives worker privilege or Supabase service-role credential.

## 14. Global retry/failure rules

- validation/auth/permission failures: no retry;
- credential/permission provider failure: terminal and integration health may become INVALID;
- rate limit/transient 5xx/network failure: bounded retry where duplicate side effect is safe;
- ambiguous external submit: reconcile/manual handling, never blind duplicate;
- known completed/idempotent reference: reconcile rather than repeat side effect;
- max attempts are job-type policy, never infinite retry.

No failed step may leave a success-looking authoritative state.

Examples:
- failed identity/Knowledge provenance cannot leave canonical generation success-looking;
- extraction cannot auto-activate Knowledge;
- stale source blocks provider spend;
- provider completion is not job completion until private media import succeeds;
- final assembly is not complete until final PAK media persistence succeeds.

## 15. Live rollout / verification workflow

Security-sensitive schema rollout follows:
1. inspect remote migration history;
2. apply only missing forward migrations in order;
3. never rewrite/reapply already-applied migrations;
4. exercise OWNER/ADMIN/EDITOR/REVIEWER and cross-org boundaries with reversible synthetic fixtures;
5. verify immutable provenance/ACLs/private storage behavior;
6. rollback/remove fixtures and prove zero residue;
7. run Supabase security/performance advisors;
8. any live-discovered defect receives RED regression test + new forward migration + exact-head CI.

This slice used that workflow to add ACL hardening, Core INSERT authorization and RLS initplan performance hardening.

## 16. Roadmap workflows

Generic Approval Center, Publishing, Content Calendar, Analytics and specialized AI Representative/Podcast/Campus/Testimonial workflows remain governed by their dedicated roadmap slices. Scene Planning approval remains its own domain-specific approval authority and is not replaced by future generic approval state.