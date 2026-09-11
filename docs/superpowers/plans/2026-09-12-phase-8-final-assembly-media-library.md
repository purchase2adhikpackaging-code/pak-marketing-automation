# Phase 8 Final Video Assembly & Media Library Expansion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a production-safe final-video assembly pipeline from approved Phase 7 shot media and replace the Media Library readiness page with an operational tenant-safe catalogue/upload/preview/lineage lifecycle.

**Architecture:** Next.js/server actions and Supabase own authorization, readiness, lineage, durable jobs, storage identities and finalization. FFmpeg execution lives in a dedicated stateless render worker that receives only short-lived signed media URLs plus an immutable render manifest and never receives Supabase service-role credentials. `media_assets` remains the single durable media identity for Phase 7 clips, operator uploads and Phase 8 final videos.

**Tech Stack:** Next.js 15, React 19, TypeScript 5.9, Zod 4, Supabase Postgres/RLS/Storage/Edge Functions, Vitest, Playwright, containerized FFmpeg/ffprobe.

**Spec:** `docs/superpowers/specs/2026-09-12-phase-8-final-assembly-media-library-design.md`

## Global Constraints

- Preserve existing Phase 6/7 Scene Planning, LTX, Integration Vault and `media_assets` identities.
- Every persisted Scene Plan shot is required for Phase 8 v1; do not infer optionality from JSON.
- Final render requires APPROVED + source-current + blocker-free plan and active completed media for every shot.
- Browser submits IDs and safe upload metadata only; it never controls provider/render command lines, arbitrary storage paths, service-role credentials or worker secrets.
- Final render profile is exactly `PAK_MASTER_1080P_V1`: 16:9=1920×1080, 9:16=1080×1920, 24fps, H.264/libx264, yuv420p, MP4 faststart, hard cuts, source audio stripped.
- Final assembly is visual-only in Phase 8; do not invent TTS, narration synthesis, music or transition mappings.
- `media_assets` remains authoritative; no duplicate media identity table.
- Existing generated assets remain in `generated-media`; operator uploads use private `media-library` bucket.
- Storage identity is `(organization_id, storage_bucket, storage_path)`.
- OWNER/ADMIN/EDITOR may enqueue final assembly/upload/archive; OWNER/ADMIN only may permanent-delete where lineage permits; REVIEWER/ANALYST are read-only.
- Long-running render work is durable and browser-independent.
- Every behavior change follows RED → GREEN TDD and exact-head verification before merge.

---

### Task 1: Media Asset Storage Identity and Operator Metadata

**Files:**
- Create: `supabase/migrations/202609120001_media_library_foundation.sql`
- Create: `src/modules/media/media-schema-sql.test.ts`
- Modify: `src/modules/media/storage-path.ts`
- Modify: `src/modules/media/storage-path.test.ts`

**Interfaces:**
- Consumes: existing `media_assets`, `generated-media` bucket, `buildMediaStoragePath()`.
- Produces: `storage_bucket`, `display_name`, `size_bytes`, `metadata`, creator/archive fields and bucket-aware uniqueness for later upload/assembly tasks.

- [ ] **Step 1: Write RED schema tests**

```ts
it("adds bucket-aware durable media identity and operator metadata", () => {
  const sql = readFileSync(migrationPath, "utf8");
  expect(sql).toContain("add column if not exists storage_bucket text");
  expect(sql).toContain("update public.media_assets");
  expect(sql).toContain("set storage_bucket = 'generated-media'");
  expect(sql).toContain("add column if not exists display_name text");
  expect(sql).toContain("add column if not exists size_bytes bigint");
  expect(sql).toContain("add column if not exists metadata jsonb");
  expect(sql).toContain("add column if not exists created_by uuid");
  expect(sql).toContain("add column if not exists archived_at timestamptz");
  expect(sql).toContain("add column if not exists archived_by uuid");
  expect(sql).toMatch(/unique[\s\S]*organization_id[\s\S]*storage_bucket[\s\S]*storage_path/i);
});
```

- [ ] **Step 2: Run RED**

Run: `npm test -- src/modules/media/media-schema-sql.test.ts src/modules/media/storage-path.test.ts`
Expected: FAIL because migration/bucket-aware helper do not exist.

- [ ] **Step 3: Implement migration and bucket-aware path helper**

Add `buildMediaObjectIdentity(organizationId, bucket, category, filename)` returning `{ bucket, path }`, reusing existing traversal validation. Migration must backfill all current rows to `generated-media`, make `storage_bucket` NOT NULL, replace the old `(organization_id, storage_path)` uniqueness with `(organization_id, storage_bucket, storage_path)`, add metadata/indexes and preserve existing Phase 7 rows.

- [ ] **Step 4: Run GREEN**

Run: `npm test -- src/modules/media/media-schema-sql.test.ts src/modules/media/storage-path.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/202609120001_media_library_foundation.sql src/modules/media/media-schema-sql.test.ts src/modules/media/storage-path.ts src/modules/media/storage-path.test.ts
git commit -m "feat: expand media asset storage identity"
```

---

### Task 2: Final Assembly Schema and Immutable Component Snapshot

**Files:**
- Create: `supabase/migrations/202609120002_video_assembly_schema.sql`
- Create: `src/modules/video/assembly/schema-sql.test.ts`
- Create: `src/modules/video/assembly/types.ts`

**Interfaces:**
- Consumes: `scene_plan_versions`, scenes/shots, `jobs`, `media_assets`.
- Produces: `video_assemblies`, `video_assembly_components`, stable assembly state types.

- [ ] **Step 1: Write RED schema/type tests**

```ts
expect(sql).toContain("create table if not exists public.video_assemblies");
expect(sql).toContain("create table if not exists public.video_assembly_components");
expect(sql).toContain("PAK_MASTER_1080P_V1");
expect(sql).toMatch(/state text not null[\s\S]*QUEUED[\s\S]*PROCESSING[\s\S]*COMPLETED[\s\S]*FAILED[\s\S]*CANCELLED/);
expect(sql).toContain("unique (assembly_id, shot_id)");
expect(sql).toContain("enable row level security");
```

Define:

```ts
export type VideoAssemblyState = "QUEUED" | "PROCESSING" | "COMPLETED" | "FAILED" | "CANCELLED";
export type FinalRenderProfile = "PAK_MASTER_1080P_V1";
```

- [ ] **Step 2: Run RED**

Run: `npm test -- src/modules/video/assembly/schema-sql.test.ts`
Expected: FAIL with missing migration/module.

- [ ] **Step 3: Implement schema**

`video_assemblies` must store org, approved plan, job, readiness/source hashes, profile, aspect ratio, component count, expected duration, final media, failure metadata and actor/timestamps. `video_assembly_components` must snapshot ordered scene/shot/media IDs, bucket/path/checksum/duration and reject cross-org lineage through a trigger. Authenticated users may SELECT same-org rows; browser INSERT/UPDATE/DELETE is not granted.

- [ ] **Step 4: Run GREEN**

Run: `npm test -- src/modules/video/assembly/schema-sql.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/202609120002_video_assembly_schema.sql src/modules/video/assembly/schema-sql.test.ts src/modules/video/assembly/types.ts
git commit -m "feat: add final video assembly lineage"
```

---

### Task 3: Server-Side Readiness and Deterministic Hash

**Files:**
- Create: `src/modules/video/assembly/readiness.ts`
- Create: `src/modules/video/assembly/readiness.test.ts`
- Create: `src/modules/video/assembly/hash.ts`
- Create: `src/modules/video/assembly/hash.test.ts`

**Interfaces:**
- Consumes: approved plan snapshot + ordered shot/media snapshots.
- Produces: `computeFinalAssemblyReadiness()` and `computeAssemblyReadinessHash()`.

- [ ] **Step 1: Write RED readiness tests**

```ts
expect(computeFinalAssemblyReadiness({ ...fixture, planStatus: "DRAFT" }).reasons).toContain("PLAN_NOT_APPROVED");
expect(computeFinalAssemblyReadiness({ ...fixture, sourceFresh: false }).reasons).toContain("SOURCE_STALE");
expect(computeFinalAssemblyReadiness({ ...fixture, shots: [] }).reasons).toContain("NO_SHOTS");
expect(computeFinalAssemblyReadiness({ ...fixture, shots: [{ ...shot, media: null }] }).reasons).toContain("SHOT_MEDIA_MISSING");
expect(computeFinalAssemblyReadiness(fixture)).toEqual({ ready: true, reasons: [] });
```

Hash test must prove ordered tuples affect SHA-256 and stable same input returns same `sha256:<hex>`.

- [ ] **Step 2: Run RED**

Run: `npm test -- src/modules/video/assembly/readiness.test.ts src/modules/video/assembly/hash.test.ts`
Expected: FAIL missing modules.

- [ ] **Step 3: Implement pure domain functions**

Use no database/client code. Reason union exactly:

```ts
export type AssemblyBlockReason =
  | "PLAN_NOT_APPROVED"
  | "SOURCE_STALE"
  | "QC_BLOCKER_PRESENT"
  | "NO_SHOTS"
  | "SHOT_MEDIA_MISSING"
  | "MEDIA_NOT_ACTIVE"
  | "UNSUPPORTED_ASPECT_RATIO"
  | "ASSEMBLY_ALREADY_RUNNING";
```

Hash canonical payload must include schema version `final-assembly-v1`, render profile, org ID, plan version ID, source hash, aspect ratio and ordered component tuples.

- [ ] **Step 4: Run GREEN**

Run: `npm test -- src/modules/video/assembly/readiness.test.ts src/modules/video/assembly/hash.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/video/assembly/readiness.ts src/modules/video/assembly/readiness.test.ts src/modules/video/assembly/hash.ts src/modules/video/assembly/hash.test.ts
git commit -m "feat: add final render readiness model"
```

---

### Task 4: Atomic Final Assembly Enqueue Boundary

**Files:**
- Create: `supabase/migrations/202609120003_video_assembly_enqueue.sql`
- Create: `src/modules/video/assembly/enqueue-sql.test.ts`
- Create: `src/modules/video/assembly/repository.ts`
- Create: `src/modules/video/assembly/enqueue.ts`
- Create: `src/modules/video/assembly/enqueue.test.ts`

**Interfaces:**
- Consumes: Tasks 1–3 schema/domain rules.
- Produces: `enqueueFinalVideoAssembly({ organizationId, planVersionId, profile }) -> { assemblyId, jobId, reused, mediaAssetId? }`.

- [ ] **Step 1: Write RED SQL/service tests**

Assert RPC `enqueue_final_video_assembly(uuid, uuid, text)` is `SECURITY DEFINER`, authenticates `auth.uid()`, requires OWNER/ADMIN/EDITOR, requires APPROVED/current/blocker-free plan, derives all shot media server-side, requires at least one shot, selects only COMPLETED attempts + ACTIVE VIDEO media, computes deterministic readiness hash, creates `FINAL_VIDEO_ASSEMBLY`, inserts component snapshots, and returns/reuses idempotent assembly.

Also assert generic jobs INSERT/UPDATE policies exclude both `VIDEO_SHOT_GENERATION` and `FINAL_VIDEO_ASSEMBLY`.

- [ ] **Step 2: Run RED**

Run: `npm test -- src/modules/video/assembly/enqueue-sql.test.ts src/modules/video/assembly/enqueue.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement RPC/repository/service**

Repository uses user-scoped Supabase client and only calls the RPC; browser/server service never composes authoritative component payload itself.

- [ ] **Step 4: Run GREEN**

Run: `npm test -- src/modules/video/assembly/enqueue-sql.test.ts src/modules/video/assembly/enqueue.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/202609120003_video_assembly_enqueue.sql src/modules/video/assembly/enqueue-sql.test.ts src/modules/video/assembly/repository.ts src/modules/video/assembly/enqueue.ts src/modules/video/assembly/enqueue.test.ts
git commit -m "feat: add atomic final assembly enqueue"
```

---

### Task 5: Render Worker Protocol and Edge Claim/Finalize Boundary

**Files:**
- Create: `supabase/migrations/202609120004_video_assembly_worker.sql`
- Create: `supabase/functions/video-assembly-worker/index.ts`
- Create: `src/modules/video/assembly/worker-contract.ts`
- Create: `src/modules/video/assembly/worker-contract.test.ts`
- Create: `src/modules/video/assembly/worker-edge-security.test.ts`

**Interfaces:**
- Consumes: queued `FINAL_VIDEO_ASSEMBLY` jobs/components.
- Produces: authenticated `claim` and `complete|fail` Edge protocol with signed URLs and immutable manifest.

- [ ] **Step 1: Write RED contract/security tests**

Manifest:

```ts
export type FinalAssemblyRenderManifest = {
  schemaVersion: "final-assembly-render-v1";
  assemblyId: string;
  jobId: string;
  organizationId: string;
  renderProfile: "PAK_MASTER_1080P_V1";
  aspectRatio: "16:9" | "9:16";
  expiresAt: string;
  output: { signedUploadUrl: string; bucket: "generated-media"; path: string };
  components: Array<{
    ordinal: number;
    shotId: string;
    mediaAssetId: string;
    signedDownloadUrl: string;
    checksum: string;
    durationSeconds: number;
  }>;
};
```

Security test asserts worker secret is read server-side, constant-time compared, no service-role key returned, no browser JWT fallback for worker capability, max component count bounded, signed URL expiry bounded, and DB lineage is revalidated before signing.

- [ ] **Step 2: Run RED**

Run: `npm test -- src/modules/video/assembly/worker-contract.test.ts src/modules/video/assembly/worker-edge-security.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement migration + Edge endpoint**

Create Vault-held `pak/video-assembly/worker` secret and service-role-only claim/finalize RPCs. Edge endpoint with `verify_jwt=false` accepts only worker token and operations `claim`, `complete`, `fail`. Claim leases one due job, validates same-org active components, creates signed GET URLs and deterministic signed upload URL. Completion verifies lease/output path and atomically creates/upserts final `media_assets`, links assembly, completes job.

- [ ] **Step 4: Run GREEN**

Run: `npm test -- src/modules/video/assembly/worker-contract.test.ts src/modules/video/assembly/worker-edge-security.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/202609120004_video_assembly_worker.sql supabase/functions/video-assembly-worker/index.ts src/modules/video/assembly/worker-contract.ts src/modules/video/assembly/worker-contract.test.ts src/modules/video/assembly/worker-edge-security.test.ts
git commit -m "feat: add final assembly worker boundary"
```

---

### Task 6: Containerized FFmpeg Render Worker

**Files:**
- Create: `workers/video-assembly/Dockerfile`
- Create: `workers/video-assembly/package.json`
- Create: `workers/video-assembly/tsconfig.json`
- Create: `workers/video-assembly/src/index.ts`
- Create: `workers/video-assembly/src/render.ts`
- Create: `workers/video-assembly/src/render.test.ts`
- Create: `workers/video-assembly/src/ffprobe.ts`
- Create: `workers/video-assembly/src/ffprobe.test.ts`

**Interfaces:**
- Consumes: Task 5 worker manifest.
- Produces: deterministic MP4 upload + normalized complete/fail callback.

- [ ] **Step 1: Write RED command/validation tests**

Test pure command construction rather than invoking real FFmpeg in unit tests:

```ts
expect(buildRenderProfile({ aspectRatio: "16:9" })).toMatchObject({ width: 1920, height: 1080, fps: 24 });
expect(buildFfmpegArgs(profile, inputs, output)).toContain("libx264");
expect(buildFfmpegArgs(profile, inputs, output)).toContain("yuv420p");
expect(buildFfmpegArgs(profile, inputs, output)).toContain("+faststart");
expect(buildFfmpegArgs(profile, inputs, output)).toContain("-an");
```

- [ ] **Step 2: Run RED**

Run in worker directory: `npm test`
Expected: FAIL.

- [ ] **Step 3: Implement worker**

Worker loops with backoff: claim manifest → download bounded inputs → checksum verify → ffprobe → normalize/concat hard cuts → ffprobe output → upload signed URL → report complete. No DB SDK/service key. Terminal checksum/corrupt-input failures report non-retryable; transport/worker infrastructure failures report retryable.

- [ ] **Step 4: Run GREEN and container smoke**

Run: `npm test`
Then build container and render two tiny fixture clips generated inside test command with FFmpeg color sources. Expected final MP4 1920×1080/24fps and positive duration.

- [ ] **Step 5: Commit**

```bash
git add workers/video-assembly
git commit -m "feat: add containerized ffmpeg assembly worker"
```

---

### Task 7: Media Upload Sessions and Private Storage Finalization

**Files:**
- Create: `supabase/migrations/202609120005_media_upload_sessions.sql`
- Create: `supabase/functions/media-library/index.ts`
- Create: `src/modules/media/upload-contract.ts`
- Create: `src/modules/media/upload-contract.test.ts`
- Create: `src/modules/media/upload-edge-security.test.ts`

**Interfaces:**
- Consumes: Task 1 media identity.
- Produces: `issue-upload`, `finalize-upload`, signed preview/download operations.

- [ ] **Step 1: Write RED tests**

Allowed v1 limits are explicit:

```ts
export const MEDIA_UPLOAD_LIMITS = {
  IMAGE: 25 * 1024 * 1024,
  VIDEO: 512 * 1024 * 1024,
  AUDIO: 100 * 1024 * 1024,
  DOCUMENT: 50 * 1024 * 1024,
} as const;
```

Allow MIME families: `image/*`, `video/*`, `audio/*`, plus `application/pdf` and Office/OpenXML document MIME allowlist. Reject executable/script/html MIME types.

- [ ] **Step 2: Run RED**

Run: `npm test -- src/modules/media/upload-contract.test.ts src/modules/media/upload-edge-security.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement private bucket/session/Edge flow**

Create private `media-library` bucket; `media_upload_sessions` states `ISSUED|FINALIZED|EXPIRED|FAILED`; browser cannot choose object path; path is `{org}/uploads/{sessionId}/{normalizedFilename}`. Finalize verifies object metadata before inserting one `media_assets` row and is idempotent.

- [ ] **Step 4: Run GREEN**

Run: `npm test -- src/modules/media/upload-contract.test.ts src/modules/media/upload-edge-security.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/202609120005_media_upload_sessions.sql supabase/functions/media-library/index.ts src/modules/media/upload-contract.ts src/modules/media/upload-contract.test.ts src/modules/media/upload-edge-security.test.ts
git commit -m "feat: add controlled media uploads"
```

---

### Task 8: Media Catalogue, Detail, Signed Preview, Archive/Delete Service

**Files:**
- Create: `src/modules/media/repository.ts`
- Create: `src/modules/media/repository.test.ts`
- Create: `src/modules/media/read-model.ts`
- Create: `src/modules/media/read-model.test.ts`
- Create: `src/app/(app)/media-library/actions.ts`
- Create: `src/app/(app)/media-library/actions.test.ts`

**Interfaces:**
- Consumes: Task 1 + Task 7 schema/Edge flow.
- Produces: paginated list/detail, signed preview, archive, permanent delete actions.

- [ ] **Step 1: Write RED tests**

Repository list input:

```ts
type MediaListQuery = {
  organizationId: string;
  assetType?: "IMAGE" | "VIDEO" | "AUDIO" | "DOCUMENT";
  source?: "UPLOAD" | "GENERATED" | "IMPORT";
  status?: "ACTIVE" | "ARCHIVED" | "FAILED";
  search?: string;
  cursor?: { createdAt: string; id: string };
  limit?: number;
};
```

Tests prove limit max 50, same-org scoping, default ACTIVE, deterministic `(created_at,id)` cursor, no service-role client in Next repository, archive role check, delete OWNER/ADMIN only, and delete is blocked when active assembly/generation lineage requires retention.

- [ ] **Step 2: Run RED**

Run: `npm test -- src/modules/media/repository.test.ts src/modules/media/read-model.test.ts src/app/(app)/media-library/actions.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement repository/actions**

Use server user session for DB reads/mutations. Signed preview calls `media-library` Edge operation after membership authorization. Delete removes Storage object only through trusted Edge boundary and deletes DB record only when lineage-safe.

- [ ] **Step 4: Run GREEN**

Run the same test command. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/media src/app/(app)/media-library/actions.ts src/app/(app)/media-library/actions.test.ts
git commit -m "feat: add media library domain services"
```

---

### Task 9: Operational Media Library UI

**Files:**
- Modify: `src/app/(app)/media-library/page.tsx`
- Create: `src/app/(app)/media-library/media-library-client.tsx`
- Create: `src/app/(app)/media-library/media-library-client.test.tsx`
- Create: `src/app/(app)/media-library/media-detail.tsx`
- Create: `src/app/(app)/media-library/media-upload.tsx`
- Modify: `src/components/app-shell/module-readiness.ts`

**Interfaces:**
- Consumes: Task 8 actions/read model.
- Produces: catalogue/filter/detail/preview/upload/archive/delete operator experience.

- [ ] **Step 1: Write RED RTL tests**

Test states: loading, empty, rows/cards, filters, generated asset lineage, preview action, upload progress/failure, role-hidden mutation controls, archive confirmation, delete confirmation, cursor/load-more and signed URL never rendered before explicit preview action.

- [ ] **Step 2: Run RED**

Run: `npm test -- src/app/(app)/media-library/media-library-client.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement UI**

Desktop table + responsive stacked cards; no giant thumbnails by default. Generated Phase 7/8 assets show safe lineage badges. Remove Media Library from foundation/readiness-only config after route becomes operational.

- [ ] **Step 4: Run GREEN**

Run same test. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/(app)/media-library src/components/app-shell/module-readiness.ts
git commit -m "feat: build operational media library"
```

---

### Task 10: Scene Planning Final Render Read Model and Actions

**Files:**
- Create: `src/app/(app)/scene-planning/final-assembly-actions.ts`
- Create: `src/app/(app)/scene-planning/final-assembly-actions.test.ts`
- Create: `src/modules/video/assembly/read-repository.ts`
- Create: `src/modules/video/assembly/read-repository.test.ts`

**Interfaces:**
- Consumes: Tasks 3–5 assembly domain.
- Produces: ID-only `enqueueFinalAssemblyAction()` plus safe status/read model.

- [ ] **Step 1: Write RED authorization/input tests**

Zod input exactly organizationId, planVersionId, profile enum. OWNER/ADMIN/EDITOR may enqueue; REVIEWER/ANALYST rejected before RPC. Read model returns readiness reasons + assembly state + final media ID, never raw signed URLs/storage credentials.

- [ ] **Step 2: Run RED**

Run: `npm test -- src/app/(app)/scene-planning/final-assembly-actions.test.ts src/modules/video/assembly/read-repository.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement action/read repository**

Follow existing Phase 7 server-action pattern and user-scoped Supabase authorization.

- [ ] **Step 4: Run GREEN**

Run same test. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/(app)/scene-planning/final-assembly-actions.ts src/app/(app)/scene-planning/final-assembly-actions.test.ts src/modules/video/assembly/read-repository.ts src/modules/video/assembly/read-repository.test.ts
git commit -m "feat: expose final assembly server actions"
```

---

### Task 11: Scene Planning Final Render UI

**Files:**
- Create: `src/app/(app)/scene-planning/final-render-controls.tsx`
- Create: `src/app/(app)/scene-planning/final-render-controls.test.tsx`
- Modify: existing Scene Planning workspace/editor component that currently renders Phase 7 shot controls.

**Interfaces:**
- Consumes: Task 10 read model/actions.
- Produces: UX-SCENE-003 readiness panel and Generate Final Video/status/final-media navigation.

- [ ] **Step 1: Write RED UI tests**

Assert blocked plans show explicit normalized reasons and no enabled render button; READY approved current plan shows button only for OWNER/ADMIN/EDITOR; QUEUED/PROCESSING disables duplicate enqueue; COMPLETED shows PAK media identity/link to Media Library; no implication of narration/audio because output is visual master.

- [ ] **Step 2: Run RED**

Run: `npm test -- src/app/(app)/scene-planning/final-render-controls.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement UI**

Add compact final-render section after shot-generation state, preserving current editor/replan behavior.

- [ ] **Step 4: Run GREEN**

Run same test. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/(app)/scene-planning/final-render-controls.tsx src/app/(app)/scene-planning/final-render-controls.test.tsx src/app/(app)/scene-planning/*workspace* src/app/(app)/scene-planning/*editor*
git commit -m "feat: add final render controls"
```

---

### Task 12: E2E, Live Supabase, Worker Deployment, Governance and Release

**Files:**
- Create/modify: Playwright Phase 8 specs under existing `tests/e2e` or repo E2E directory.
- Modify: `docs/product/PAK_DEVELOPMENT_ROADMAP.md`
- Modify: `docs/product/PAK_TRACEABILITY_MATRIX.md`
- Modify: `docs/product/PAK_BACKEND_SCHEMA.md` if implementation adds fields/functions beyond synchronized logical contract.
- Modify: `docs/product/PAK_MASTER_TRD.md` only if deployed worker/runtime choice changes from approved design.

**Interfaces:**
- Consumes: all Phase 8 tasks.
- Produces: exact-head release evidence and live production deployment.

- [ ] **Step 1: Add deterministic E2E coverage**

Use fake/stubbed final assembly status for browser E2E. Cover Media Library list/upload interaction without external paid APIs; final render CTA blocked/ready/completed states; role restrictions.

- [ ] **Step 2: Run full local/CI gate**

Run:

```bash
npm run typecheck
npm run lint
npm run test:run
npm run build
npm run test:e2e
```

Expected: all green.

- [ ] **Step 3: Apply migrations live in order**

Apply `202609120001` through `202609120005` only after exact repo tests are green. Stop on first migration error. Verify migration history, RLS enabled, browser privilege negative cases, cross-tenant rejection and bucket privacy.

- [ ] **Step 4: Deploy Edge functions**

Deploy `video-assembly-worker` with self-auth internal worker token boundary and `media-library` with user/role authorization as designed. Verify unauthorized worker request = 401 and unauthorized tenant/media operations fail.

- [ ] **Step 5: Deploy render worker**

Deploy container with FFmpeg/ffprobe to approved compute environment. Configure only worker endpoint/token; do not give it Supabase service-role key. Run real two-clip fixture render through live claim → signed inputs → render → upload → finalize path.

- [ ] **Step 6: Run live Supabase advisors and runtime probes**

Security/performance findings introduced by Phase 8 must be fixed or explicitly justified before merge.

- [ ] **Step 7: Update governance docs**

Mark Phase 8 implemented only after real live worker fixture render and Media Library storage/RLS smoke succeed. Otherwise keep Phase 8 in-progress and document the exact external blocker.

- [ ] **Step 8: Open/update PR and final review**

PR must list exact migration IDs, Edge versions, worker deployment evidence, E2E/CI SHA and any external constraints. Resolve review threads.

- [ ] **Step 9: Merge exact green head and verify `main`**

Use expected-head merge. Re-read `main` SHA and production runtime state before completion claim.
