# Publishing Visual Production Standard Design

## Scope

This design applies only to the Publishing Production Runner / textbook factory. It must not alter Marketing Automation, Scene Planning, Approval Center, video generation, or unrelated PAK product surfaces.

## Goal

Make professional visual production a release-blocking property of every generated textbook, using the user-approved Polish Railway Academy Textbook Preview as the visual benchmark while preserving academic content integrity and existing security/tenant boundaries.

## Visual contract

Every releasable textbook MUST contain:

1. A full-page front cover built around a realistic, subject-relevant railway image and PAK identity, programme/subject code, title, textbook designation and edition.
2. A full-page back cover built around a realistic railway image and institutional/contact treatment.
3. A visual plan created before final manuscript serialization. Every chapter must declare at least one pedagogically relevant visual.
4. Technical concepts must prefer accurate labeled technical diagrams/illustrations where labels improve learning (bogie, wheelset, track, braking, signalling, traction, interfaces, etc.).
5. Practical/workshop/case-study content must use realistic contextual railway/workshop photography where appropriate.
6. Visual assets are first-class book assets with stable asset id, kind, chapter/placement, caption, alt text, provenance, realism requirement, technical-label requirement, media type, dimensions and byte size. Runtime HTML must embed resolved bytes/data URIs or another renderer-safe representation; arbitrary persisted signed URLs are forbidden.
7. Placeholder images, unresolved assets, low-resolution assets, missing captions/alt text/provenance, and missing mandatory cover/chapter visuals block release.
8. The PDF renderer must wait for image decode before printing and must print backgrounds.
9. QA must prove front cover, back cover, chapter visual coverage and asset integrity before QA_PASSED.
10. Existing D01-101 academic manuscript should be reused for the visual revision wherever possible; visual regeneration must not silently rewrite approved academic claims.

## Architecture

Add a focused `visual-production` domain inside `src/modules/publishing-factory`. The visual planner derives required placements from the blueprint/manuscript. A resolver/provider boundary supplies realistic/technical image assets and records provenance. The manuscript serializer receives a resolved visual bundle and emits deterministic semantic `<figure>` / cover sections. The renderer validates and waits for all images. A dedicated visual QA gate runs before release and contributes blocking issues to the existing compiler QA result.

The first implementation must remain provider-neutral: the factory contract must not hard-code a new paid API or expose a secret. Existing media/provider infrastructure may be adapted behind the resolver boundary. If no capable image provider/approved asset exists, the job must stop in a clear visual-assets-required state rather than publish a text-only book.

## Domain model

`BookVisualPlan` contains `frontCover`, `backCover`, and `chapterVisuals` keyed by chapter id.

`BookVisualRequirement` contains:
- `id`
- `placement`: `front-cover | back-cover | chapter-opener | technical-diagram | practical-photo | case-study-photo`
- `chapterId?: string`
- `subjectPrompt`
- `caption`
- `altText`
- `realistic: boolean`
- `labelsRequired: boolean`

`ResolvedBookVisual` extends the requirement with:
- `assetId`
- `mimeType` restricted to supported raster image types
- `width`
- `height`
- `byteLength`
- `sourceKind`: `generated | approved-library | licensed-source`
- `provenance`
- renderer-safe `dataUri`

No external signed URL is persisted as business identity.

## Quality gates

Visual QA is blocking. At minimum it checks:
- exactly one front cover and one back cover;
- every manuscript chapter has at least one resolved visual;
- every visual is realistic when the requirement says realistic;
- technical labeled requirements report labels present;
- caption, alt text and provenance are non-empty;
- supported MIME type;
- minimum print dimensions: cover >= 1600x2400 pixels; internal photographic/technical visual >= 1200 pixels on its long edge unless an explicitly vector-safe technical representation is introduced later;
- non-trivial byte length;
- no placeholder markers or unresolved URLs;
- serialized HTML contains the planned figure ids;
- renderer reports all images decoded before PDF generation.

Failure yields QA_FAILED and no publication row/artifact release.

## Rendering

Front and back cover sections use full A4 bleed-like page composition within the existing printable page model, navy/red PAK identity, photographic background, legible overlay, and no ordinary running header/footer. Internal figures use consistent caption and callout treatment. Existing content/table typography remains intact unless required for figure placement.

## Checkpointing and production runner

Visual plan and resolved visual manifest become checkpoint artifacts so a retry does not regenerate already-approved assets. The bounded D01 worker remains direct-queue and concurrency-safe. No auto-portfolio behavior is introduced.

## D01-101 migration

After factory gates pass in preview, enqueue/regenerate only D01-101 as a new revision. Reuse its approved manuscript/checkpoints where compatible, generate/resolve the missing visual assets, render, run content/layout/visual/PDF QA, then release only if every gate passes. Previous publication stays available as revision history.

## Verification

TDD covers planner/domain validation, serializer figures/covers, renderer image readiness, visual QA blocking behavior, compiler integration, checkpoint persistence and D01 production wiring. Exact-head CI, Vercel Chromium PDF health, and one controlled D01-101 production E2E are required before merge/release.

## Security and non-regression

No service-role key in Vercel/browser. Preserve broker/Vault boundary, RLS/RBAC/tenant isolation, current direct bounded worker semantics, existing academic QA, existing Library revision history, and current PR #43 convergence. No Marketing Automation files are in scope.