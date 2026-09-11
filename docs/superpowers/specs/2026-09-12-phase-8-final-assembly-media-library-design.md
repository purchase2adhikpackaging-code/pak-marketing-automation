# Phase 8 — Final Video Assembly & Media Library Expansion Design

**Date:** 2026-09-12  
**Status:** Design for implementation  
**Branch:** `phase-8/final-assembly-media-library`  
**Base:** `main@2966a3b016980531813fcb2c84b68a820b5cad01`

## 1. Purpose

Phase 8 closes two gaps in the synchronized PAK baseline:

1. turn an APPROVED, source-current Scene Plan whose shots have successful PAK-owned generated media into one deterministic final PAK-owned video asset; and
2. replace the Media Library readiness placeholder with an operational, tenant-safe media catalogue, upload, preview, lineage, archive and delete workflow.

This design implements:

- `PRD-VID-005`
- `PRD-VID-019`
- `PRD-MEDIA-001..006`
- `TRD-VID-005..006`
- `TRD-MEDIA-001..005`
- `UX-SCENE-003`
- `UX-MEDIA-001..004`

It preserves all Phase 6/7 boundaries. It does not redesign Scene Planning, LTX generation, Integration Vault, generic Approval Center, publishing, calendar, analytics, AI Representative, podcast, campuses, testimonials, or manual authoring.

## 2. Current foundation

Phase 7 already provides:

- APPROVED immutable Scene Plan versions with source-integrity hashes;
- ordered `scene_plan_scenes` and `scene_plan_shots`;
- tenant-scoped durable `jobs`;
- `video_generation_attempts` linked to plan/scene/shot and imported media;
- private `generated-media` storage;
- PAK-owned `media_assets` records for successfully imported generated clips;
- browser-safe server actions and Edge workers;
- strict paid-provider creation/retry boundaries;
- unattended dispatch infrastructure.

The current `/media-library` route is only a readiness page. `media_assets` is the authoritative media identity and must remain so.

## 3. Architectural choices

### 3.1 Chosen approach — dedicated container render worker

Final composition runs in a dedicated PAK render worker with FFmpeg/ffprobe available in a container runtime.

Control plane remains:

`Next.js UI/server action → Supabase RPC/DB → Supabase Edge worker boundary → PAK render worker → private Supabase Storage → media_assets`

The render worker does **not** receive the Supabase service-role key and does not write the database directly. It receives only short-lived signed input/output URLs, a bounded immutable render manifest, and an internal worker credential.

Why this is chosen:

- 90–180 second FFmpeg composition is long-running CPU/media work and does not belong inside a browser request;
- Supabase Edge is the wrong runtime for native FFmpeg execution;
- Vercel request execution is not the durable render authority and may be quota/duration constrained;
- browser FFmpeg/WASM would expose execution to client lifecycle, memory pressure and tampering;
- a third-party render API would introduce avoidable vendor lock-in and another paid-provider contract.

### 3.2 Rejected approaches

**FFmpeg inside Next/Vercel function** — rejected because render completion must not depend on a web request duration or Vercel execution quota.

**FFmpeg inside Supabase Edge** — rejected because native long-running media composition is not an appropriate Edge-function responsibility.

**Browser FFmpeg/WASM** — rejected because final asset correctness, tenancy and completion cannot depend on an open browser.

**Third-party render SaaS as Phase 8 authority** — rejected for the initial implementation because PAK can own a deterministic FFmpeg pipeline without introducing another provider credential/cost surface.

## 4. Final assembly domain model

### 4.1 `video_assemblies`

Add an organization-scoped assembly record representing one immutable component snapshot and its final output.

Logical fields:

- `id uuid PK`
- `organization_id uuid NOT NULL`
- `plan_version_id uuid NOT NULL`
- `job_id uuid NOT NULL`
- `state`: `QUEUED | PROCESSING | COMPLETED | FAILED | CANCELLED`
- `render_profile`: initially `PAK_MASTER_1080P_V1`
- `readiness_hash text NOT NULL`
- `source_integrity_hash text NOT NULL`
- `aspect_ratio`: initially only `16:9 | 9:16`
- `component_count integer > 0`
- `expected_duration_seconds numeric > 0`
- `final_media_asset_id uuid nullable`
- normalized failure code/message/retryability metadata where useful
- `created_by uuid`
- timestamps

Rules:

- parent plan and organization must match;
- lineage fields are immutable after creation;
- `COMPLETED` requires `final_media_asset_id`;
- final media must belong to the same organization;
- browser roles may read same-org assemblies but may not fabricate or directly mutate render execution state.

### 4.2 `video_assembly_components`

Snapshot every required shot/media input used by the render.

Logical fields:

- `id uuid PK`
- `organization_id uuid NOT NULL`
- `assembly_id uuid NOT NULL`
- `ordinal integer >= 0`
- `scene_id uuid NOT NULL`
- `shot_id uuid NOT NULL`
- `media_asset_id uuid NOT NULL`
- `media_checksum text NOT NULL`
- `duration_seconds numeric > 0`
- `storage_bucket text NOT NULL`
- `storage_path text NOT NULL`
- timestamps

Constraints:

- unique `(assembly_id, ordinal)`;
- unique `(assembly_id, shot_id)`;
- component organization must match assembly, scene, shot and media organizations;
- component records are immutable snapshots after enqueue.

### 4.3 Required-shot rule

The current Scene Plan schema has no explicit optional-shot flag. Phase 8 therefore treats **every persisted shot in an APPROVED plan as required**. It must not infer optionality from free-form `generation_requirements` JSON.

If optional-shot semantics are needed later, they require an explicit schema/requirement change.

## 5. Readiness calculation

Final-render readiness is computed server-side from authoritative persisted state. Browser state cannot declare a plan ready.

A plan is READY only when all of the following are true:

1. caller belongs to the organization;
2. plan exists in that organization;
3. plan status is `APPROVED`;
4. plan source-integrity hash still matches its current canonical script artifact;
5. no BLOCKER QC finding exists for the plan;
6. plan contains at least one scene and at least one shot;
7. every persisted shot has a completed Phase 7 generation attempt with a non-null `media_asset_id`;
8. each selected media asset belongs to the same organization, is `VIDEO`, `ACTIVE`, and has a private storage identity plus checksum;
9. only supported plan aspect ratios are used (`16:9` or `9:16` in Phase 8 v1);
10. no component references a missing/archived/failed asset.

The read model returns normalized reasons rather than a single boolean, for example:

- `PLAN_NOT_APPROVED`
- `SOURCE_STALE`
- `QC_BLOCKER_PRESENT`
- `NO_SHOTS`
- `SHOT_MEDIA_MISSING`
- `MEDIA_NOT_ACTIVE`
- `UNSUPPORTED_ASPECT_RATIO`
- `ASSEMBLY_ALREADY_RUNNING`

The UI must surface actionable readiness reasons and must not render an enabled Final Render CTA when blocked.

## 6. Readiness hash and idempotency

Assembly identity depends on the exact approved plan and exact component media set.

Compute a deterministic SHA-256 readiness hash over canonical serialized values:

- schema/render-profile version;
- organization ID;
- plan version ID;
- source integrity hash;
- plan aspect ratio;
- ordered component tuples of:
  - scene ID;
  - shot ID;
  - media asset ID;
  - media checksum;
  - media duration.

The final job idempotency key is:

`final-video:{planVersionId}:{readinessHash}:{renderProfile}`

Behavior:

- same plan + same media set + same render profile reuses the existing assembly/job;
- if the existing assembly is COMPLETED, the existing final media asset is returned;
- if it is QUEUED/PROCESSING, no duplicate render is created;
- component changes, new plan version or render-profile revision produce a new hash/new assembly;
- failed retry uses the same assembly/job according to bounded job retry policy rather than creating a duplicate lineage row.

## 7. Enqueue boundary

Add one authenticated RPC/server boundary for final assembly creation. The browser submits only:

- `organizationId`
- `planVersionId`
- fixed allowlisted render profile

The database/server derives all scenes, shots and media inputs itself.

OWNER/ADMIN/EDITOR may enqueue. REVIEWER/ANALYST may read status/media but may not enqueue.

The enqueue transaction:

1. verifies actor and role;
2. locks/reads plan and authoritative source;
3. computes readiness;
4. selects one completed active PAK media asset for every shot;
5. computes readiness hash;
6. returns existing assembly when idempotency matches;
7. otherwise inserts `FINAL_VIDEO_ASSEMBLY` job;
8. inserts `video_assemblies`;
9. inserts immutable `video_assembly_components` in scene/shot order;
10. returns IDs only.

Generic authenticated `jobs` policies must exclude direct creation/update of `FINAL_VIDEO_ASSEMBLY` jobs, matching the Phase 7 paid-generation hardening pattern.

## 8. Render execution protocol

### 8.1 Worker relationship

The render worker is a trusted compute worker but not a database administrator.

It authenticates to a dedicated Supabase Edge endpoint using an internal high-entropy worker credential. That credential is never sent to browsers and is stored only in secure backend/worker configuration.

The worker uses a pull protocol:

1. request one due assembly work item;
2. Edge/service-role boundary claims the job with lease/`SKIP LOCKED` semantics;
3. Edge revalidates assembly/job/org/component lineage;
4. Edge creates short-lived signed GET URLs for each private input object;
5. Edge creates a short-lived signed upload URL for the deterministic final output object;
6. Edge returns an immutable render manifest;
7. worker downloads/verifies inputs, renders, uploads output;
8. worker reports success/failure to Edge;
9. Edge finalizes DB/media state atomically where DB state is concerned and releases the lease.

The worker never receives raw provider result URLs, LTX credentials, Supabase service-role credentials, or browser session tokens.

### 8.2 Render manifest

Manifest contains only bounded non-secret execution data:

- manifest schema version;
- assembly/job IDs;
- organization ID;
- aspect ratio;
- render profile;
- ordered components with signed URL, expected checksum and expected duration;
- signed output upload URL;
- output object path;
- expiry timestamp.

Manifest must have a maximum component count and URL expiry. Worker rejects expired or malformed manifests.

### 8.3 Output path

Use the existing private `generated-media` bucket rather than creating a second identity system.

Final object path:

`{organizationId}/final-video/{planVersionId}-{readinessHashPrefix}.mp4`

`media_assets` remains the final durable media identity.

## 9. Deterministic FFmpeg profile

Initial profile: `PAK_MASTER_1080P_V1`.

- 16:9 → 1920×1080
- 9:16 → 1080×1920
- 24 fps
- H.264 / `libx264`
- `yuv420p`
- MP4 `+faststart`
- deterministic ordered concatenation
- hard cuts in v1
- provider/source clip audio is stripped in v1

Why hard cuts/audio stripping in v1:

- Scene Plan transition text is creative intent, not yet a typed render transition contract;
- inventing transition mappings would silently change timing/creative meaning;
- Phase 7 intentionally disables provider-generated audio to preserve canonical narration authority;
- Phase 8 baseline contains no approved TTS/music-provider contract.

Phase 8 therefore produces the **final visual master** from approved shot media. Narration/TTS/music generation is not silently invented in this phase. A later explicit audio contract can extend the render manifest without changing media identity or assembly lineage.

### 9.1 Input validation

For every component the worker:

- downloads only from provided signed URL;
- enforces bounded file size;
- computes SHA-256 and matches the expected PAK checksum;
- runs ffprobe;
- requires valid video stream;
- rejects empty/corrupt input;
- normalizes frame rate and output dimensions with scale/pad rather than uncontrolled stretching.

### 9.2 Final QA

Before success report:

- output exists and is non-empty;
- ffprobe reports one valid video stream;
- dimensions match profile;
- frame rate is valid;
- duration is positive and within a bounded tolerance of summed rendered component duration;
- output SHA-256 is computed;
- upload completed successfully.

## 10. Finalization and retry

On successful worker report, Edge/service-role boundary:

1. verifies job lease/assembly identity;
2. verifies deterministic output path;
3. creates/upserts final `media_assets` row with:
   - organization;
   - `asset_type = VIDEO`;
   - source `GENERATED`;
   - bucket/path;
   - mime `video/mp4`;
   - duration/dimensions/checksum;
   - generating job ID;
   - active status;
   - Phase 8 lineage metadata;
4. links `video_assemblies.final_media_asset_id`;
5. marks assembly COMPLETED;
6. marks job COMPLETED with safe result metadata.

Retry policy:

- bounded maximum three render attempts for infrastructure/transient failures;
- validation/checksum/corrupt-input errors are terminal until source media changes;
- lease expiry permits safe reclaim when no success was finalized;
- deterministic output path + assembly idempotency make repeated upload/finalize safe;
- a worker outcome that is genuinely ambiguous must be reconciled against output-object existence before rerendering.

## 11. Media Library schema expansion

`media_assets` remains authoritative but needs enough metadata for an operator product.

Add/backfill logical fields:

- `storage_bucket text` — existing Phase 7 generated rows backfill `generated-media`;
- `display_name text`;
- `size_bytes bigint nullable`;
- `metadata jsonb NOT NULL default {}` for safe non-secret lineage/display metadata;
- `created_by uuid nullable`;
- `archived_at timestamptz nullable`;
- `archived_by uuid nullable`.

Do not duplicate assets into a second media table.

Indexes should support:

- organization + created time pagination;
- organization + status;
- organization + asset type;
- organization + source;
- generating job lookup.

## 12. Media upload/storage design

### 12.1 Upload bucket

Create a private `media-library` bucket for operator uploads/imports. Existing generated assets remain in `generated-media`.

Allowed baseline categories:

- image
- video
- audio
- document

MIME and file-size allowlists are enforced before signed upload issuance and verified again at finalization.

### 12.2 Direct signed upload flow

OWNER/ADMIN/EDITOR may upload.

1. browser requests upload session with safe metadata: filename, MIME, size, asset type;
2. server/Edge validates role and allowlists;
3. backend derives organization-prefixed object path and returns short-lived signed upload URL;
4. browser uploads bytes directly to Storage;
5. browser calls finalize using upload/session ID only;
6. backend verifies object exists, path/org/MIME/size match the issued session;
7. backend creates `media_assets` record;
8. session becomes finalized and cannot create a second asset.

Browser does not choose an arbitrary storage path and does not directly insert authoritative media lineage.

A small `media_upload_sessions` table is allowed to make this two-step flow idempotent/auditable:

- organization;
- actor;
- expected path/MIME/size/type;
- state `ISSUED | FINALIZED | EXPIRED | FAILED`;
- media asset ID nullable;
- expiry/timestamps.

## 13. Media read/preview

All media list/detail queries are organization-scoped and paginated.

List filters:

- asset type;
- source;
- status;
- optional display-name search;
- cursor pagination by `(created_at, id)`.

Asset detail shows:

- display name;
- type/MIME/dimensions/duration/size;
- source;
- status;
- created time;
- generating job where applicable;
- generation/assembly lineage where applicable;
- safe checksum/technical metadata where useful.

Preview/download uses short-lived signed GET URLs created only after same-org membership authorization. Raw service-role credentials never enter the browser.

## 14. Archive and delete

Roles:

- OWNER/ADMIN/EDITOR may upload;
- OWNER/ADMIN/EDITOR may archive assets where product lineage permits;
- permanent delete is OWNER/ADMIN only;
- REVIEWER/ANALYST are read-only.

Rules:

- archive changes authoritative media status and hides it from default active lists;
- an asset referenced by active video-generation or final-assembly lineage cannot be permanently deleted;
- permanent delete is an authenticated backend/Edge operation, not direct browser Storage deletion;
- delete is idempotent: missing object after a previous successful delete is treated as already removed, then DB cleanup may continue;
- storage operation and DB deletion use verified organization/bucket/path values from the media row, never browser-supplied paths.

Direct authenticated `media_assets` INSERT/UPDATE/DELETE policies should be hardened so authoritative lifecycle mutation goes through validated server/RPC/Edge boundaries rather than arbitrary row writes.

## 15. Scene Planning UI changes

For an APPROVED/current plan add a **Final Video** production card.

States:

- `Blocked` — show normalized readiness reasons;
- `Ready` — OWNER/ADMIN/EDITOR can `Generate Final Video`;
- `Queued` / `Rendering` — display durable status, no duplicate CTA;
- `Failed` — normalized failure + retry when backend says safe;
- `Complete` — link to PAK media identity and `Open in Media Library`.

A per-shot COMPLETED state must never be presented as a complete final film.

## 16. Media Library UI

Replace the readiness page with an operational route.

Desktop:

- page header + Upload action;
- filter bar;
- paginated table/list;
- type icon/preview thumbnail where safe;
- name/type/source/status;
- linked generation/job/assembly context;
- created time;
- actions.

Mobile:

- stacked asset cards with the same authoritative state/actions;
- no desktop-only critical operation.

Asset detail may be a dedicated route or drawer, but URL-addressable detail is preferred for operator workflows and future Approval/Publishing integration.

Upload UX:

- file selection;
- client-side prevalidation for fast feedback;
- signed direct upload progress;
- finalize state;
- clear normalized failure without leaking storage internals.

## 17. Authorization matrix

| Capability | OWNER | ADMIN | EDITOR | REVIEWER | ANALYST |
|---|---:|---:|---:|---:|---:|
| List/view media | ✓ | ✓ | ✓ | ✓ | ✓ |
| Signed preview/download | ✓ | ✓ | ✓ | ✓ | ✓ |
| Upload media | ✓ | ✓ | ✓ | — | — |
| Archive media | ✓ | ✓ | ✓ | — | — |
| Permanent delete | ✓ | ✓ | — | — | — |
| Enqueue final assembly | ✓ | ✓ | ✓ | — | — |
| Read assembly status/final asset | ✓ | ✓ | ✓ | ✓ | ✓ |

RLS remains the final read boundary. Privileged mutations use narrowly scoped server/Edge functions with explicit role/lineage checks.

## 18. Failure handling

Normalized failure families:

### Readiness
- plan not approved/current;
- QC blocker;
- missing shot media;
- archived/failed media;
- unsupported aspect ratio.

### Upload
- unsupported MIME/type;
- file too large;
- signed URL expired;
- object verification mismatch;
- finalize conflict.

### Render
- input download failure;
- checksum mismatch;
- corrupt/invalid video;
- FFmpeg failure;
- worker unavailable;
- output verification failure;
- output upload failure;
- completion/finalization failure.

Raw FFmpeg stderr, storage internals, signed URLs, internal worker token and service-role information are never returned to browser UI.

## 19. Testing strategy

### Unit/domain

- readiness reason calculation;
- deterministic component ordering;
- readiness hash/idempotency;
- render profile normalization;
- safe error mapping;
- media filter/query schemas;
- authorization helpers.

### SQL/schema

- new tables/constraints/indexes/RLS;
- same-org parentage guards;
- authenticated direct mutation denial;
- enqueue-only assembly creation;
- component immutability;
- completed assembly requires same-org final media;
- referenced asset delete denial.

### Worker

- render manifest validation;
- checksum verification;
- FFmpeg command construction;
- terminal/transient classification;
- deterministic output path;
- fixture integration test using short generated clips and ffprobe verification.

CI does not need real LTX because Phase 8 consumes PAK-owned fixture media.

### UI/E2E

- blocked final-render reasons;
- ready/enqueue state;
- running/completed final render state using fake worker path;
- Media Library list/filter/detail;
- upload/finalize happy path with deterministic test storage abstraction;
- role-based mutation visibility;
- mobile critical workflows.

### Live release gates

- migrations applied to connected PAK Supabase in repository order;
- RLS/function privilege probes;
- private bucket checks;
- advisor review;
- final-assembly Edge boundary deployed and unauthorized request denied;
- render worker deployed to an approved container runtime;
- real smoke using deterministic non-LTX fixture clips produces a valid final PAK media asset;
- exact-head typecheck, lint, unit, build and Playwright green before merge.

Phase 8 is **not production-complete** if the render worker is only coded but not deployed/verified. External container-host availability must be reported as an operational blocker rather than misrepresented as completion.

## 20. Migration/implementation shape

Expected forward migrations (names may be adjusted only before first application):

1. `video_final_assemblies` — assembly + components + RLS/guards;
2. `video_final_assembly_enqueue` — readiness/idempotent enqueue RPC + job policy hardening;
3. `media_library_metadata` — media metadata/backfill/indexes/policy hardening;
4. `media_upload_sessions` — controlled signed-upload session lineage;
5. `video_final_assembly_completion` — final media/assembly/job completion boundary;
6. any performance/security hardening discovered by live advisors as forward migrations.

Expected code areas:

- `src/modules/video/assembly/*`
- `src/modules/media/*`
- `src/app/(app)/scene-planning/*` final-video read/actions/UI
- `src/app/(app)/media-library/*`
- `supabase/functions/video-assembly/*`
- `supabase/functions/media-library/*`
- `workers/video-render/*` containerized FFmpeg worker
- E2E/tests/docs/traceability updates.

## 21. Non-goals

Phase 8 does not add:

- TTS/narration synthesis;
- music generation/licensing;
- creative transition inference from free-form Scene Plan text;
- subtitles/captions;
- generic Approval Center;
- publishing/calendar/analytics;
- a second media identity table;
- a second video-generation provider;
- direct browser access to private buckets or worker credentials.

These require explicit later requirements rather than hidden scope expansion.

## 22. Exit criteria

Phase 8 may be called complete only when:

1. an APPROVED, source-current, blocker-free plan with complete shot media resolves READY;
2. blocked plans expose deterministic reasons and cannot enqueue;
3. final assembly enqueue is tenant/role validated and idempotent;
4. a deployed render worker can consume an immutable manifest and produce verified MP4 output;
5. final output is imported as one organization-scoped PAK `media_assets` record with component lineage;
6. duplicate clicks/retries cannot create duplicate final output identity for the same readiness hash;
7. Media Library lists existing Phase 7 generated assets plus Phase 8 final/uploaded assets;
8. operator upload, preview, archive and authorized delete work through private storage boundaries;
9. REVIEWER/ANALYST cannot mutate media or enqueue renders;
10. RLS/storage/security negative probes pass live;
11. exact-head CI including production build and Playwright is green;
12. a real deployed-worker assembly smoke produces a valid playable PAK-owned final video asset.
