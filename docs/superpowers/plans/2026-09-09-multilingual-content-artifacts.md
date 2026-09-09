# PAK Multilingual Content Artifacts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Evolve Content Studio from one generated script into tenant-safe EN/PL/HI script artifacts with one canonical source, independent translations, deterministic staleness, concurrency-safe regeneration, and CI-safe multilingual UI/E2E behavior.

**Architecture:** Keep `content_items` as the workflow/topic parent and introduce `content_script_artifacts` as the canonical language-specific script store. Reuse the existing server-only `TextGenerationProvider` abstraction for both source generation and translation, while repository compare-and-set semantics prevent stale concurrent completions from overwriting newer revisions. Existing `content_items.generated_script` fields remain temporarily for backward compatibility, but all new multilingual reads/writes prefer script artifacts.

**Tech Stack:** Next.js 15, TypeScript, Zod 4, Supabase Postgres/Auth/RLS, OpenAI provider abstraction, Vitest, Playwright, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-09-09-multilingual-content-artifacts-design.md`

## Global Constraints

- PAK remains completely separate from Aurexis, Lovable, and every Lovable-attached Supabase project.
- Supported languages are exactly `EN`, `PL`, and `HI`.
- Script artifact statuses are exactly `PENDING`, `GENERATING`, `GENERATED`, `STALE`, and `FAILED`.
- Exactly one canonical source artifact may exist per content item once a source is established.
- `content_items` remains the parent identity/topic/context record.
- `content_script_artifacts` becomes the canonical language-specific script store for all code changed in this slice.
- Existing `content_items.generated_script` and provider fields remain in place during this slice; do not destructively remove them.
- OWNER, ADMIN, and EDITOR may create/update/generate script artifacts; REVIEWER and ANALYST may not mutate them.
- OWNER and ADMIN may delete script artifacts.
- RLS is the final tenant boundary.
- Repository mutations must scope by resource identifier and `organization_id`.
- Provider/API secrets remain server-only and must never enter browser payloads, database metadata, logs, or client errors.
- CI/E2E must use the deterministic fake provider and must not require or consume a real OpenAI API key.
- Do not implement scene planning, LTX/video generation, FFmpeg, approvals, publishing, analytics, embeddings/RAG, Knowledge Base ingestion, or autonomous scheduling in this slice.

---

## File Structure

### New files

- `supabase/migrations/202609090007_content_script_artifacts.sql` — artifact table, constraints, backfill, indexes, RLS, and tenant-parent integrity.
- `src/modules/content-studio/artifacts/types.ts` — artifact domain types and repository input/output contracts.
- `src/modules/content-studio/artifacts/schema.ts` — source-regeneration and translation request validation.
- `src/modules/content-studio/artifacts/schema.test.ts` — validation tests for EN/PL/HI and source/target rules.
- `src/modules/content-studio/artifacts/repository.ts` — Supabase artifact repository with compare-and-set completion semantics.
- `src/modules/content-studio/artifacts/repository.test.ts` — repository contract tests using injected persistence adapter/fake.
- `src/modules/content-studio/artifacts/translation-service.ts` — target translation workflow.
- `src/modules/content-studio/artifacts/translation-service.test.ts` — deterministic translation/staleness/failure tests.
- `src/modules/content-studio/artifacts/source-service.ts` — canonical source generation/regeneration workflow.
- `src/modules/content-studio/artifacts/source-service.test.ts` — source revision and translation invalidation tests.
- `src/app/(app)/content-studio/artifact-actions.test.ts` — authenticated/authorized action tests.
- `src/app/(app)/content-studio/multilingual-content-panel.tsx` — EN/PL/HI artifact cards and per-language actions.
- `src/app/(app)/content-studio/multilingual-content-panel.test.tsx` — component state/action tests.

### Modified files

- `src/lib/env/schema.ts` — make OpenAI key conditional on `AI_TEXT_PROVIDER=openai` and normalize blank model override.
- `src/lib/env/schema.test.ts` — fake/openai configuration tests and warning cleanup.
- `src/lib/env/server.ts` — continue explicit server-only reads.
- `.env.example` — retain fake default and blank optional model safely.
- `tests/rls/foundation-rls.sql` — extend tenant/role checks for script artifacts.
- `src/app/(app)/content-studio/actions.ts` — add source/translation actions while preserving current source-creation action compatibility.
- `src/app/(app)/content-studio/page.tsx` — load artifact-aware server state and render multilingual panel.
- `src/app/(app)/content-studio/content-studio-form.tsx` — hand newly generated source into artifact-aware UI path without provider details.
- `tests/e2e/content-studio.spec.ts` — multilingual card and deterministic fake-provider flow.
- `.github/workflows/ci.yml` — keep fake AI provider and harmless local public Supabase placeholders; do not add real OpenAI secrets.

---

### Task 1: Make Fake AI Configuration Truly Keyless

**Files:**
- Modify: `src/lib/env/schema.ts`
- Modify: `src/lib/env/schema.test.ts`
- Verify: `src/lib/env/server.ts`
- Verify: `.env.example`

**Interfaces:**
- Consumes: existing `parseServerEnv(input)` and `getServerEnv()`.
- Produces: `ServerEnv` where `OPENAI_API_KEY?: string` is valid for `AI_TEXT_PROVIDER="fake"`, but mandatory for `AI_TEXT_PROVIDER="openai"`; blank `OPENAI_TEXT_MODEL` normalizes to `undefined`.

- [ ] **Step 1: Add failing environment tests**

Add explicit tests equivalent to:

```ts
it("allows fake provider without an OpenAI key", () => {
  const env = parseServerEnv({
    SUPABASE_SERVICE_ROLE_KEY: "service-role",
    LTX_WORKER_SHARED_SECRET: "worker-secret",
    AI_TEXT_PROVIDER: "fake",
    OPENAI_TEXT_MODEL: "",
  });

  expect(env.AI_TEXT_PROVIDER).toBe("fake");
  expect(env.OPENAI_API_KEY).toBeUndefined();
  expect(env.OPENAI_TEXT_MODEL).toBeUndefined();
});

it("requires an OpenAI key when the OpenAI provider is selected", () => {
  expect(() =>
    parseServerEnv({
      SUPABASE_SERVICE_ROLE_KEY: "service-role",
      LTX_WORKER_SHARED_SECRET: "worker-secret",
      AI_TEXT_PROVIDER: "openai",
      OPENAI_TEXT_MODEL: "gpt-5.6-luna",
    }),
  ).toThrow();
});

it("accepts OpenAI when a key is present", () => {
  const env = parseServerEnv({
    SUPABASE_SERVICE_ROLE_KEY: "service-role",
    OPENAI_API_KEY: "server-secret",
    LTX_WORKER_SHARED_SECRET: "worker-secret",
    AI_TEXT_PROVIDER: "openai",
    OPENAI_TEXT_MODEL: "gpt-5.6-luna",
  });

  expect(env.OPENAI_API_KEY).toBe("server-secret");
});
```

- [ ] **Step 2: Run the targeted tests and verify RED**

Run: `npm run test:run -- src/lib/env/schema.test.ts`

Expected: at least the fake-without-key or blank-model test fails under the current unconditional schema.

- [ ] **Step 3: Implement conditional server validation**

Use a blank-to-undefined preprocessor and a schema-level refinement:

```ts
const optionalTrimmedString = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.string().trim().min(1).optional(),
);

export const serverEnvSchema = z
  .object({
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
    OPENAI_API_KEY: optionalTrimmedString,
    LTX_WORKER_SHARED_SECRET: z.string().min(1),
    AI_TEXT_PROVIDER: z.enum(["fake", "openai"]).default("fake"),
    OPENAI_TEXT_MODEL: optionalTrimmedString,
  })
  .superRefine((env, ctx) => {
    if (env.AI_TEXT_PROVIDER === "openai" && !env.OPENAI_API_KEY) {
      ctx.addIssue({
        code: "custom",
        path: ["OPENAI_API_KEY"],
        message: "OPENAI_API_KEY is required when AI_TEXT_PROVIDER=openai",
      });
    }
  });
```

Keep `src/lib/env/server.ts` server-only and explicitly reading the same variables. Remove the unused-variable lint pattern in `schema.test.ts` rather than suppressing the rule.

- [ ] **Step 4: Run tests, typecheck, and lint**

Run:

```bash
npm run test:run -- src/lib/env/schema.test.ts
npm run typecheck
npm run lint
```

Expected: targeted tests pass; no new type errors; the existing `AI_TEXT_PROVIDER` unused warning is gone.

- [ ] **Step 5: Commit**

```bash
git add src/lib/env/schema.ts src/lib/env/schema.test.ts src/lib/env/server.ts .env.example
git commit -m "fix: make fake AI provider configuration keyless"
```

---

### Task 2: Define Script Artifact Domain Types and Validation

**Files:**
- Create: `src/modules/content-studio/artifacts/types.ts`
- Create: `src/modules/content-studio/artifacts/schema.ts`
- Create: `src/modules/content-studio/artifacts/schema.test.ts`

**Interfaces:**
- Consumes: `ContentLanguage` from `src/modules/content-studio/types.ts`.
- Produces:

```ts
export type ScriptArtifactStatus = "PENDING" | "GENERATING" | "GENERATED" | "STALE" | "FAILED";

export type ScriptArtifact = {
  id: string;
  organizationId: string;
  contentItemId: string;
  language: "EN" | "PL" | "HI";
  isSource: boolean;
  status: ScriptArtifactStatus;
  scriptText?: string;
  revision: number;
  sourceRevision?: number;
  provider?: string;
  providerModel?: string;
  providerMetadata?: Record<string, unknown>;
  failureMetadata?: Record<string, unknown>;
  createdBy?: string;
  generatedAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type GenerateTranslationRequest = {
  organizationId: string;
  contentItemId: string;
  targetLanguage: "EN" | "PL" | "HI";
};

export type RegenerateSourceRequest = {
  organizationId: string;
  contentItemId: string;
};
```

- [ ] **Step 1: Write failing validation tests**

Cover:
- EN/PL/HI target languages accepted;
- DE rejected;
- invalid UUIDs rejected;
- translation schema rejects a request once domain validation determines target equals source language;
- source regeneration requires organization/content UUIDs.

For request-boundary schemas, implement:

```ts
export const generateTranslationRequestSchema = z.object({
  organizationId: z.string().uuid(),
  contentItemId: z.string().uuid(),
  targetLanguage: z.enum(["EN", "PL", "HI"]),
});

export const regenerateSourceRequestSchema = z.object({
  organizationId: z.string().uuid(),
  contentItemId: z.string().uuid(),
});
```

Keep the source-language comparison in the domain service because the source language is resolved server-side, not trusted from the browser.

- [ ] **Step 2: Run targeted test and verify RED**

Run: `npm run test:run -- src/modules/content-studio/artifacts/schema.test.ts`

Expected: FAIL because artifact types/schemas do not exist.

- [ ] **Step 3: Implement types and schemas exactly as above**

Do not add DE or arbitrary language strings. Do not add approval fields or scene references.

- [ ] **Step 4: Run targeted tests and typecheck**

Run:

```bash
npm run test:run -- src/modules/content-studio/artifacts/schema.test.ts
npm run typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/content-studio/artifacts/types.ts src/modules/content-studio/artifacts/schema.ts src/modules/content-studio/artifacts/schema.test.ts
git commit -m "feat: define multilingual script artifact domain"
```

---

### Task 3: Add Artifact Migration, Backfill, Integrity, and RLS

**Files:**
- Create: `supabase/migrations/202609090007_content_script_artifacts.sql`
- Modify: `tests/rls/foundation-rls.sql`

**Interfaces:**
- Consumes: `public.content_items`, `public.is_org_member(uuid)`, `public.has_org_role(uuid,text[])`.
- Produces: `public.content_script_artifacts` with organization-scoped RLS and backfilled source rows.

- [ ] **Step 1: Extend the SQL harness first**

Add assertions/transactions that prove:
- same-org member SELECT succeeds;
- cross-org SELECT returns no row;
- OWNER/ADMIN/EDITOR INSERT/UPDATE succeeds;
- REVIEWER/ANALYST mutation fails;
- artifact organization differing from parent organization is rejected;
- duplicate `(content_item_id, language)` is rejected;
- a second `is_source=true` row for the same content item is rejected.

- [ ] **Step 2: Add the migration**

Create the table with explicit constraints:

```sql
create table if not exists public.content_script_artifacts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  content_item_id uuid not null references public.content_items(id) on delete cascade,
  language text not null check (language in ('EN','PL','HI')),
  is_source boolean not null default false,
  status text not null default 'PENDING'
    check (status in ('PENDING','GENERATING','GENERATED','STALE','FAILED')),
  script_text text,
  revision integer not null default 1 check (revision >= 1),
  source_revision integer check (source_revision is null or source_revision >= 1),
  provider text,
  provider_model text,
  provider_metadata jsonb,
  failure_metadata jsonb,
  created_by uuid references auth.users(id) on delete set null,
  generated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (content_item_id, language),
  constraint content_script_generated_has_text check (
    status <> 'GENERATED' or nullif(btrim(script_text), '') is not null
  ),
  constraint content_script_source_revision_shape check (
    (is_source and source_revision is null)
    or (not is_source)
  )
);

create unique index if not exists content_script_one_source_idx
  on public.content_script_artifacts (content_item_id)
  where is_source;
```

Enforce parent-organization equality with a trigger/function that reads the parent `content_items.organization_id` and raises a deterministic exception when it differs. Do not rely only on application code.

- [ ] **Step 3: Add non-destructive backfill**

Backfill only rows with non-empty legacy scripts and skip conflicts:

```sql
insert into public.content_script_artifacts (
  organization_id,
  content_item_id,
  language,
  is_source,
  status,
  script_text,
  revision,
  provider,
  provider_model,
  provider_metadata,
  failure_metadata,
  created_by,
  generated_at,
  created_at,
  updated_at
)
select
  ci.organization_id,
  ci.id,
  ci.language,
  true,
  'GENERATED',
  ci.generated_script,
  1,
  ci.provider,
  ci.provider_model,
  ci.provider_metadata,
  null,
  ci.created_by,
  ci.updated_at,
  ci.created_at,
  ci.updated_at
from public.content_items ci
where nullif(btrim(ci.generated_script), '') is not null
on conflict (content_item_id, language) do nothing;
```

Do not delete or null legacy content columns.

- [ ] **Step 4: Add indexes and RLS**

Indexes:

```sql
create index if not exists content_script_artifacts_org_content_idx
  on public.content_script_artifacts (organization_id, content_item_id);

create index if not exists content_script_artifacts_org_status_idx
  on public.content_script_artifacts (organization_id, status);
```

Policies:
- SELECT `is_org_member(organization_id)`;
- INSERT/UPDATE `has_org_role(organization_id, array['OWNER','ADMIN','EDITOR'])` and `created_by is null or created_by=auth.uid()` on insert;
- DELETE `has_org_role(organization_id, array['OWNER','ADMIN'])`.

- [ ] **Step 5: Review migration ordering and run the SQL harness where the repository test environment permits**

Expected: migration number `007` follows existing `006`; no references to later migrations; RLS harness assertions pass in the configured Supabase/Postgres test environment. If the local harness cannot execute without an external database, record that as unexecuted rather than claiming it passed; CI must still parse/build all application code.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/202609090007_content_script_artifacts.sql tests/rls/foundation-rls.sql
git commit -m "feat: add tenant-safe script artifact persistence"
```

---

### Task 4: Implement Concurrency-Safe Artifact Repository

**Files:**
- Create: `src/modules/content-studio/artifacts/repository.ts`
- Create: `src/modules/content-studio/artifacts/repository.test.ts`

**Interfaces:**
- Consumes: `ScriptArtifact` and Supabase server client.
- Produces:

```ts
export type StartArtifactGenerationInput = {
  id: string;
  organizationId: string;
  expectedRevision: number;
};

export type CompleteArtifactGenerationInput = {
  id: string;
  organizationId: string;
  expectedRevision: number;
  scriptText: string;
  provider: string;
  providerModel: string;
  providerMetadata?: Record<string, unknown>;
  sourceRevision?: number;
};

export interface ScriptArtifactRepository {
  listForContent(organizationId: string, contentItemId: string): Promise<ScriptArtifact[]>;
  getSource(organizationId: string, contentItemId: string): Promise<ScriptArtifact | null>;
  getByLanguage(organizationId: string, contentItemId: string, language: "EN" | "PL" | "HI"): Promise<ScriptArtifact | null>;
  ensureSourceFromLegacy(organizationId: string, contentItemId: string, actorUserId: string): Promise<ScriptArtifact>;
  ensureTarget(organizationId: string, contentItemId: string, language: "EN" | "PL" | "HI", actorUserId: string): Promise<ScriptArtifact>;
  startGeneration(input: StartArtifactGenerationInput): Promise<ScriptArtifact>;
  completeGeneration(input: CompleteArtifactGenerationInput): Promise<ScriptArtifact>;
  failGeneration(id: string, organizationId: string, expectedRevision: number, failureMetadata: Record<string, unknown>): Promise<ScriptArtifact>;
  markTranslationsStale(organizationId: string, contentItemId: string, newerSourceRevision: number): Promise<void>;
}
```

- [ ] **Step 1: Write repository contract tests with an injected storage adapter/fake**

Test exact behaviors:
- all reads scope by organization and content item;
- `ensureTarget` returns existing row rather than creating a duplicate;
- `startGeneration` only succeeds for the expected revision and allowed starting states;
- `completeGeneration` performs compare-and-set on `id + organization_id + revision + status=GENERATING`;
- stale completion throws `AppError("CONFLICT", ...)` (or the closest existing stable conflict code if `AppError` has a fixed union; inspect `app-error.ts` before implementation);
- completion increments `revision` exactly once;
- `markTranslationsStale` excludes `is_source=true` and only marks translations with older `source_revision`.

- [ ] **Step 2: Run targeted tests and verify RED**

Run: `npm run test:run -- src/modules/content-studio/artifacts/repository.test.ts`

Expected: FAIL because the repository does not exist.

- [ ] **Step 3: Implement row mapping and tenant-scoped Supabase queries**

Use an explicit `ScriptArtifactRow` boundary and map snake_case database fields to camelCase domain fields. Every update must include `.eq("organization_id", input.organizationId)`.

For generation completion, use compare-and-set filters equivalent to:

```ts
.update({
  status: "GENERATED",
  script_text: input.scriptText,
  revision: input.expectedRevision + 1,
  source_revision: input.sourceRevision ?? null,
  provider: input.provider,
  provider_model: input.providerModel,
  provider_metadata: input.providerMetadata ?? null,
  failure_metadata: null,
  generated_at: now,
  updated_at: now,
})
.eq("id", input.id)
.eq("organization_id", input.organizationId)
.eq("revision", input.expectedRevision)
.eq("status", "GENERATING")
.select(ARTIFACT_COLUMNS)
.maybeSingle();
```

If no row is returned, throw a normalized conflict instead of retrying the write blindly.

- [ ] **Step 4: Implement stale invalidation**

Use filters that do not touch the source row:

```ts
.update({ status: "STALE", updated_at: now })
.eq("organization_id", organizationId)
.eq("content_item_id", contentItemId)
.eq("is_source", false)
.eq("status", "GENERATED")
.lt("source_revision", newerSourceRevision);
```

- [ ] **Step 5: Run targeted tests, typecheck, and lint**

```bash
npm run test:run -- src/modules/content-studio/artifacts/repository.test.ts
npm run typecheck
npm run lint
```

Expected: PASS without unsafe direct Supabase result casts beyond one explicit `unknown -> ScriptArtifactRow` boundary.

- [ ] **Step 6: Commit**

```bash
git add src/modules/content-studio/artifacts/repository.ts src/modules/content-studio/artifacts/repository.test.ts
git commit -m "feat: add concurrency-safe script artifact repository"
```

---

### Task 5: Implement Translation Workflow Service

**Files:**
- Create: `src/modules/content-studio/artifacts/translation-service.ts`
- Create: `src/modules/content-studio/artifacts/translation-service.test.ts`

**Interfaces:**
- Consumes: `ScriptArtifactRepository`, `TextGenerationProvider`, `GenerateTranslationRequest`.
- Produces:

```ts
export type TranslationDependencies = {
  repository: ScriptArtifactRepository;
  provider: TextGenerationProvider;
  actorUserId: string;
};

export async function generateTranslationArtifact(
  request: GenerateTranslationRequest,
  dependencies: TranslationDependencies,
): Promise<ScriptArtifact>;
```

- [ ] **Step 1: Write failing workflow tests**

Cover:
1. missing source rejects with safe domain error;
2. source must have `status="GENERATED"` and non-empty text;
3. target language equal to source language rejects before provider call;
4. successful translation starts only target artifact, calls provider once, and persists source revision;
5. idempotency key contains content item, target language, source revision, and target operation revision;
6. regenerating PL does not mutate HI/EN rows;
7. provider failure calls `failGeneration` with normalized metadata and does not leak an injected string such as `sk-secret-do-not-leak`;
8. stale compare-and-set completion surfaces conflict instead of overwriting a newer result.

- [ ] **Step 2: Run targeted tests and verify RED**

Run: `npm run test:run -- src/modules/content-studio/artifacts/translation-service.test.ts`

Expected: FAIL because service does not exist.

- [ ] **Step 3: Implement translation instructions and workflow**

Build instructions equivalent to:

```ts
function buildTranslationInstructions(sourceLanguage: string, targetLanguage: string): string {
  return [
    `Translate the supplied PAK script from ${sourceLanguage} to ${targetLanguage}.`,
    "Preserve meaning, factual claims, names, figures, railway terminology, and PAK-specific terms.",
    "Do not add unsupported facts, certifications, guarantees, or marketing claims.",
    "Return only the complete translated script.",
  ].join(" ");
}
```

Provider request:

```ts
{
  topic: `Translate PAK script to ${request.targetLanguage}`,
  knowledgeContext: source.scriptText,
  language: request.targetLanguage,
  systemInstructions: buildTranslationInstructions(source.language, request.targetLanguage),
  idempotencyKey: `content:${request.contentItemId}:translation:${request.targetLanguage}:source:${source.revision}:target:${target.revision}`,
}
```

Sequence:
1. resolve source server-side;
2. validate current source;
3. reject target==source;
4. ensure target row;
5. start generation with target current revision;
6. call provider;
7. complete with `sourceRevision=source.revision`;
8. on provider failure, persist normalized failure against the started revision and throw safe `AppError`.

- [ ] **Step 4: Run targeted tests and typecheck**

```bash
npm run test:run -- src/modules/content-studio/artifacts/translation-service.test.ts
npm run typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/content-studio/artifacts/translation-service.ts src/modules/content-studio/artifacts/translation-service.test.ts
git commit -m "feat: add multilingual translation workflow"
```

---

### Task 6: Implement Canonical Source Regeneration and Staleness

**Files:**
- Create: `src/modules/content-studio/artifacts/source-service.ts`
- Create: `src/modules/content-studio/artifacts/source-service.test.ts`
- Modify only if required for compatibility: `src/modules/content-studio/service.ts`

**Interfaces:**
- Consumes: `ScriptArtifactRepository`, `ContentItemRepository`, `TextGenerationProvider`, `RegenerateSourceRequest`.
- Produces:

```ts
export type SourceRegenerationDependencies = {
  artifactRepository: ScriptArtifactRepository;
  contentRepository: ContentItemRepository;
  provider: TextGenerationProvider;
  actorUserId: string;
};

export async function regenerateSourceArtifact(
  request: RegenerateSourceRequest,
  dependencies: SourceRegenerationDependencies,
): Promise<ScriptArtifact>;
```

- [ ] **Step 1: Write failing source-regeneration tests**

Cover:
- source artifact resolved server-side;
- previous script text is not explicitly cleared before provider success;
- successful source completion increments source revision;
- source `sourceRevision` remains undefined/null;
- after success, `markTranslationsStale` receives the new source revision;
- failed provider call records FAILED but does not mutate translation statuses;
- stale source completion cannot invalidate translations because completion itself conflicts first.

- [ ] **Step 2: Run targeted tests and verify RED**

Run: `npm run test:run -- src/modules/content-studio/artifacts/source-service.test.ts`

Expected: FAIL because service does not exist.

- [ ] **Step 3: Add a parent read method if needed**

Extend `ContentItemRepository` minimally with:

```ts
getById(id: string, organizationId: string): Promise<ContentItem | null>;
```

Implement with both `.eq("id", id)` and `.eq("organization_id", organizationId)`.

- [ ] **Step 4: Implement source workflow**

Use the parent topic/context plus existing source language to generate replacement source text through the existing provider. The idempotency key must be revision-aware:

```ts
`content:${request.contentItemId}:source:${source.language}:revision:${source.revision}`
```

After `completeGeneration` returns the new artifact, call:

```ts
await artifactRepository.markTranslationsStale(
  request.organizationId,
  request.contentItemId,
  completed.revision,
);
```

Do not mark translations stale on failed source regeneration.

- [ ] **Step 5: Keep legacy parent compatibility narrow**

If existing UI/service still expects `content_items.status/generated_script`, update legacy parent fields only as a compatibility mirror after successful source generation. Artifact data is canonical for new code. Do not create a second translation representation on `content_items`.

- [ ] **Step 6: Run source + existing Content Studio tests**

```bash
npm run test:run -- src/modules/content-studio/artifacts/source-service.test.ts src/modules/content-studio/service.test.ts
npm run typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/modules/content-studio/artifacts/source-service.ts src/modules/content-studio/artifacts/source-service.test.ts src/modules/content-studio/repository.ts src/modules/content-studio/service.ts
git commit -m "feat: add canonical source regeneration workflow"
```

---

### Task 7: Add Authenticated Source and Translation Server Actions

**Files:**
- Modify: `src/app/(app)/content-studio/actions.ts`
- Create: `src/app/(app)/content-studio/artifact-actions.test.ts`

**Interfaces:**
- Consumes: artifact schemas and workflow services.
- Produces:

```ts
export type ScriptArtifactActionResult =
  | { ok: true; artifact: ScriptArtifact }
  | { ok: false; error: string };

export async function generateTranslationAction(input: unknown): Promise<ScriptArtifactActionResult>;
export async function regenerateSourceAction(input: unknown): Promise<ScriptArtifactActionResult>;
```

- [ ] **Step 1: Write failing action tests**

For both actions test:
- invalid input returns validation error without invoking workflow;
- unauthenticated actor rejected;
- missing membership rejected;
- REVIEWER and ANALYST rejected;
- OWNER/ADMIN/EDITOR accepted;
- raw provider/persistence exception is normalized to a safe message;
- action passes only actor ID plus parsed business input into service.

- [ ] **Step 2: Run targeted tests and verify RED**

Run: `npm run test:run -- 'src/app/(app)/content-studio/artifact-actions.test.ts'`

Expected: FAIL because actions are absent.

- [ ] **Step 3: Refactor shared authorization without changing semantics**

Extract a small server-local helper in `actions.ts` or a focused sibling module only if it reduces duplication:

```ts
async function requireGenerationActor(
  organizationId: string,
): Promise<{ actorId: string } | { error: string }>;
```

It must still query Supabase Auth and `organization_memberships`; do not trust role data from the browser.

- [ ] **Step 4: Implement both actions**

Instantiate:
- `SupabaseScriptArtifactRepository`;
- existing `SupabaseContentItemRepository` where source regeneration needs parent content;
- `createTextGenerationProvider()`.

Return only `ScriptArtifact` and safe error text. Do not return provider raw payloads.

- [ ] **Step 5: Run action tests and existing action regression tests**

```bash
npm run test:run -- 'src/app/(app)/content-studio/artifact-actions.test.ts' 'src/app/(app)/content-studio/actions.test.ts'
npm run typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add 'src/app/(app)/content-studio/actions.ts' 'src/app/(app)/content-studio/artifact-actions.test.ts'
git commit -m "feat: add multilingual Content Studio actions"
```

---

### Task 8: Build the Multilingual Content Studio UI

**Files:**
- Create: `src/app/(app)/content-studio/multilingual-content-panel.tsx`
- Create: `src/app/(app)/content-studio/multilingual-content-panel.test.tsx`
- Modify: `src/app/(app)/content-studio/page.tsx`
- Modify: `src/app/(app)/content-studio/content-studio-form.tsx`

**Interfaces:**
- Consumes: server-loaded `ScriptArtifact[]`, `generateTranslationAction`, `regenerateSourceAction`.
- Produces: one EN, one PL, and one HI card with source/status/revision/text/actions.

- [ ] **Step 1: Write failing component tests**

Test:
- exactly three cards labeled English, Polish, Hindi;
- source card visibly says `Canonical source`;
- status labels render `PENDING`, `GENERATING`, `GENERATED`, `STALE`, `FAILED` safely;
- stale card shows a clear `Source changed — refresh translation` message;
- missing target offers `Generate translation`;
- stale/failed target offers `Refresh translation` or `Retry translation`;
- corresponding action disabled while that artifact is generating;
- source card offers `Regenerate source` but never `Generate translation` to itself;
- safe action error displays without stack/provider internals.

- [ ] **Step 2: Run component test and verify RED**

Run: `npm run test:run -- 'src/app/(app)/content-studio/multilingual-content-panel.test.tsx'`

Expected: FAIL because component does not exist.

- [ ] **Step 3: Implement the panel as a focused client component**

Use a fixed language descriptor array:

```ts
const LANGUAGES = [
  { code: "EN", label: "English" },
  { code: "PL", label: "Polish" },
  { code: "HI", label: "Hindi" },
] as const;
```

Do not expose provider/model controls. Provider metadata is not needed for the end-user card.

- [ ] **Step 4: Make page loading artifact-aware**

Keep `export const dynamic = "force-dynamic"`.

After resolving the authenticated user and allowed organization memberships, load artifact data only for a server-selected/current content item that belongs to the organization. If the current screen still represents a new, unsaved generation form with no selected content item, render the generation form first and mount the multilingual panel only after a content item exists.

Do not accept an arbitrary organization/content pair from URL/client state without server membership checks.

- [ ] **Step 5: Bridge initial source generation into artifact canonical storage**

After the existing `generateContentAction` succeeds, ensure the generated source is represented by the backfill-compatible artifact path (prefer calling `ensureSourceFromLegacy` server-side rather than duplicating fields in the client). Return or reload the artifact-aware state so the generated language becomes the canonical source card.

- [ ] **Step 6: Run component, action, and existing Content Studio tests**

```bash
npm run test:run -- 'src/app/(app)/content-studio/multilingual-content-panel.test.tsx' 'src/app/(app)/content-studio/actions.test.ts' 'src/app/(app)/content-studio/artifact-actions.test.ts'
npm run typecheck
npm run lint
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add 'src/app/(app)/content-studio/multilingual-content-panel.tsx' 'src/app/(app)/content-studio/multilingual-content-panel.test.tsx' 'src/app/(app)/content-studio/page.tsx' 'src/app/(app)/content-studio/content-studio-form.tsx' 'src/app/(app)/content-studio/actions.ts'
git commit -m "feat: add multilingual Content Studio interface"
```

---

### Task 9: Add Deterministic Multilingual E2E Coverage

**Files:**
- Modify: `tests/e2e/content-studio.spec.ts`
- Verify/modify only if needed: `.github/workflows/ci.yml`
- Verify: `playwright.config.ts`

**Interfaces:**
- Consumes: fake provider, Content Studio UI/actions.
- Produces: browser-level proof that multilingual UI is renderable and fake translation behavior is deterministic without OpenAI credits.

- [ ] **Step 1: Extend E2E tests**

At minimum assert:
- Content Studio renders English/Polish/Hindi cards in the artifact-aware state;
- source language is visibly identified;
- a target translation fake-provider path completes and displays generated text/status when the test harness has deterministic authenticated/Supabase fixture support;
- if the existing E2E harness intentionally has no live Supabase/auth fixture, keep mutation behavior covered at server-action/component level and make browser E2E prove the three-card shell without inventing fake authentication security bypasses.

Do not weaken production auth/RLS to make Playwright convenient.

- [ ] **Step 2: Verify CI environment remains fake-only**

`.github/workflows/ci.yml` must keep:

```yaml
env:
  AI_TEXT_PROVIDER: fake
```

and harmless local placeholders for public Supabase config if needed to boot the web server. Do not add `OPENAI_API_KEY` to CI.

- [ ] **Step 3: Run full local verification where available**

```bash
npm run typecheck
npm run lint
npm run test:run
npm run build
npx playwright install chromium
npm run test:e2e
```

Expected: all commands pass. If Playwright browser installation is already present, installation may be skipped; do not claim E2E success without the actual `npm run test:e2e` result.

- [ ] **Step 4: Commit**

```bash
git add tests/e2e/content-studio.spec.ts .github/workflows/ci.yml playwright.config.ts
git commit -m "test: cover multilingual Content Studio workflow"
```

---

### Task 10: Final Integration Review and Draft PR

**Files:**
- Review all files changed since `main`.
- No production file should be changed in this task unless review finds a concrete defect; any defect fix receives its own focused commit and reruns affected tests.

**Interfaces:**
- Consumes: all previous task outputs.
- Produces: reviewable draft PR from `feat/multilingual-content-artifacts` to `main`.

- [ ] **Step 1: Run full verification from the feature head**

```bash
npm run typecheck
npm run lint
npm run test:run
npm run build
npm run test:e2e
```

Expected: all pass. Record exact test counts/results from real output.

- [ ] **Step 2: Review security and tenancy invariants**

Confirm by code review:
- no OpenAI key/client imported into client components;
- no provider raw error crosses actions;
- every artifact mutation is organization-scoped;
- target==source is rejected server-side;
- old request completion is compare-and-set protected;
- source success, not source failure, triggers stale translation invalidation;
- legacy generated script columns were not destructively removed;
- RLS policies match OWNER/ADMIN/EDITOR mutation and OWNER/ADMIN delete requirements.

- [ ] **Step 3: Review migration safety**

Confirm migration `007`:
- follows existing migration order;
- is non-destructive;
- backfill is idempotent/conflict-safe;
- parent organization equality is DB-enforced;
- unique source constraint is partial/indexed correctly;
- no live Supabase deployment is claimed merely because the SQL exists in Git.

- [ ] **Step 4: Open a draft PR**

Title:

```text
feat: add multilingual Content Studio artifacts
```

PR summary must state:
- EN/PL/HI distinct artifacts;
- canonical source + independent target translations;
- source-revision staleness;
- concurrency-safe compare-and-set writes;
- RLS/tenant scope;
- fake-provider zero-credit CI;
- explicit non-goals: scenes/LTX/FFmpeg/approval/publishing.

- [ ] **Step 5: Treat GitHub Actions as release evidence**

Do not mark the PR ready until the PR-triggered CI verifies install/typecheck/lint/unit/build/Playwright E2E on the actual PR head. If a gate fails, inspect the exact failed step/log, patch only the actual defect, and rerun.

- [ ] **Step 6: Final review before ready/merge**

Check changed filenames, PR patch, review threads, and current head SHA. Only a green, unchanged head with no unresolved blocking review findings can move to Ready for review and later merge.
