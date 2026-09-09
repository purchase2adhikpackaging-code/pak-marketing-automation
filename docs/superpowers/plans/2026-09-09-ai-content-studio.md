# AI Content Studio Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the first tenant-scoped, server-only OpenAI-backed Content Studio script-generation workflow with deterministic fake-provider tests and CI-safe E2E behavior.

**Architecture:** Introduce a provider-neutral text generation contract, a server-only OpenAI adapter, tenant-scoped `content_items` persistence, and a Content Studio service that owns validation and generation state transitions. A Next.js server action is the browser boundary; CI uses a fake provider so tests never consume paid API credits.

**Tech Stack:** Next.js 15, TypeScript, Zod, Supabase Postgres/Auth/RLS, Vitest, Playwright, OpenAI SDK.

**Spec:** `docs/superpowers/specs/2026-09-09-ai-content-studio-design.md`

## Global Constraints

- PAK must remain completely separate from Aurexis, Lovable, and any Lovable-attached Supabase project.
- `OPENAI_API_KEY` is server-only and must never reach client code, database rows, logs, telemetry, or client error payloads.
- CI must never require a real OpenAI key or consume paid OpenAI credits.
- RLS remains the final tenant authorization boundary.
- `OWNER`, `ADMIN`, and `EDITOR` may create/update content items.
- Supported languages in this slice are exactly `EN`, `PL`, and `HI`.
- Canonical content statuses are exactly `DRAFT`, `GENERATING`, `GENERATED`, and `FAILED`.
- Do not implement scene planning, LTX, FFmpeg, approvals, publishing, analytics, embeddings, or RAG in this slice.

---

## File Structure

### New files
- `src/modules/ai/text/types.ts` — provider-neutral text generation request/result/error types.
- `src/modules/ai/text/provider.ts` — text-generation provider interface.
- `src/modules/ai/text/fake-provider.ts` — deterministic fake provider for tests/CI.
- `src/modules/ai/text/fake-provider.test.ts` — fake provider tests.
- `src/modules/ai/text/openai-provider.ts` — server-only OpenAI adapter.
- `src/modules/ai/text/openai-provider.test.ts` — mocked OpenAI adapter tests.
- `src/modules/ai/text/provider-factory.ts` — server-only provider selection from environment.
- `src/modules/content-studio/schema.ts` — canonical Zod request schema.
- `src/modules/content-studio/schema.test.ts` — validation tests.
- `src/modules/content-studio/types.ts` — content item/workflow types.
- `src/modules/content-studio/repository.ts` — persistence abstraction + Supabase implementation.
- `src/modules/content-studio/service.ts` — generation workflow and state transitions.
- `src/modules/content-studio/service.test.ts` — deterministic workflow tests.
- `src/app/(app)/content-studio/actions.ts` — authenticated server action boundary.
- `src/app/(app)/content-studio/content-studio-form.tsx` — client form component.
- `supabase/migrations/202609090006_content_items.sql` — content table, indexes, RLS.
- `tests/e2e/content-studio.spec.ts` — deterministic fake-provider smoke path.

### Modified files
- `package.json` — add OpenAI SDK dependency.
- `.env.example` — add `AI_TEXT_PROVIDER` and `OPENAI_TEXT_MODEL`.
- `src/lib/env/schema.ts` — parse server-side AI provider/model configuration.
- `src/lib/env/server.ts` — expose server-only provider/model values.
- `src/app/(app)/content-studio/page.tsx` — replace placeholder with real Content Studio screen.
- `.github/workflows/ci.yml` — set fake AI provider for build/E2E if required by server env parsing.

---

### Task 1: Canonical Content Studio Request Schema

**Files:**
- Create: `src/modules/content-studio/schema.ts`
- Create: `src/modules/content-studio/schema.test.ts`

**Interfaces:**
- Produces: `contentGenerationRequestSchema`
- Produces: `ContentGenerationRequest = z.infer<typeof contentGenerationRequestSchema>`

- [ ] **Step 1: Write failing schema tests**

```ts
import { describe, expect, it } from "vitest";
import { contentGenerationRequestSchema } from "./schema";

describe("contentGenerationRequestSchema", () => {
  const base = {
    organizationId: "11111111-1111-4111-8111-111111111111",
    topic: "Railway safety training",
    knowledgeContext: "Use PAK workshop and competence-centre positioning.",
  };

  it.each(["EN", "PL", "HI"] as const)("accepts %s", (language) => {
    expect(contentGenerationRequestSchema.parse({ ...base, language }).language).toBe(language);
  });

  it("rejects short topics", () => {
    expect(() => contentGenerationRequestSchema.parse({ ...base, topic: "ab", language: "EN" })).toThrow();
  });

  it("rejects oversized context", () => {
    expect(() => contentGenerationRequestSchema.parse({ ...base, knowledgeContext: "x".repeat(12001), language: "EN" })).toThrow();
  });

  it("rejects unsupported language", () => {
    expect(() => contentGenerationRequestSchema.parse({ ...base, language: "DE" })).toThrow();
  });
});
```

- [ ] **Step 2: Run the targeted test and verify RED**

Run: `npm run test:run -- src/modules/content-studio/schema.test.ts`
Expected: FAIL because `./schema` does not exist.

- [ ] **Step 3: Implement the schema**

```ts
import { z } from "zod";

export const contentGenerationRequestSchema = z.object({
  organizationId: z.string().uuid(),
  topic: z.string().trim().min(3).max(300),
  knowledgeContext: z.string().trim().max(12000).optional(),
  language: z.enum(["EN", "PL", "HI"]),
});

export type ContentGenerationRequest = z.infer<typeof contentGenerationRequestSchema>;
```

- [ ] **Step 4: Run the targeted test and verify GREEN**

Run: `npm run test:run -- src/modules/content-studio/schema.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/content-studio/schema.ts src/modules/content-studio/schema.test.ts
git commit -m "feat: define Content Studio generation schema"
```

---

### Task 2: Provider-Neutral Text Generation Contract + Fake Provider

**Files:**
- Create: `src/modules/ai/text/types.ts`
- Create: `src/modules/ai/text/provider.ts`
- Create: `src/modules/ai/text/fake-provider.test.ts`
- Create: `src/modules/ai/text/fake-provider.ts`

**Interfaces:**
- Produces: `TextGenerationRequest`
- Produces: `TextGenerationResult`
- Produces: `TextProviderError`
- Produces: `TextGenerationProvider`
- Produces: `FakeTextGenerationProvider`

- [ ] **Step 1: Write failing fake-provider tests**

```ts
import { describe, expect, it } from "vitest";
import { FakeTextGenerationProvider } from "./fake-provider";

const request = {
  topic: "Railway safety training",
  knowledgeContext: "PAK workshop context",
  language: "EN" as const,
  systemInstructions: "Write a concise training script.",
  idempotencyKey: "content:123:script:v1",
};

describe("FakeTextGenerationProvider", () => {
  it("returns deterministic text", async () => {
    const provider = new FakeTextGenerationProvider();
    const first = await provider.generate(request);
    const second = await provider.generate(request);

    expect(first).toEqual(second);
    expect(first.provider).toBe("fake");
    expect(first.text.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run test and verify RED**

Run: `npm run test:run -- src/modules/ai/text/fake-provider.test.ts`
Expected: FAIL because provider files do not exist.

- [ ] **Step 3: Implement provider-neutral types/interface and fake provider**

Use these exact public shapes:

```ts
export type TextGenerationRequest = {
  topic: string;
  knowledgeContext?: string;
  language: "EN" | "PL" | "HI";
  systemInstructions: string;
  idempotencyKey: string;
};

export type TextGenerationResult = {
  text: string;
  provider: string;
  model: string;
  metadata?: Record<string, unknown>;
};

export type TextProviderError = {
  code: string;
  message: string;
  retryable: boolean;
  raw?: unknown;
};
```

```ts
export interface TextGenerationProvider {
  readonly name: string;
  validateConfiguration(): Promise<void>;
  generate(request: TextGenerationRequest): Promise<TextGenerationResult>;
}
```

Fake implementation must return deterministic text derived from `language` and `topic`, use provider `fake`, model `deterministic-v1`, and never access environment secrets.

- [ ] **Step 4: Run targeted tests and verify GREEN**

Run: `npm run test:run -- src/modules/ai/text/fake-provider.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/ai/text
git commit -m "feat: add text generation provider contract"
```

---

### Task 3: AI Server Environment Configuration

**Files:**
- Modify: `.env.example`
- Modify: `src/lib/env/schema.ts`
- Modify: `src/lib/env/server.ts`
- Modify: `src/lib/env/schema.test.ts`

**Interfaces:**
- Server env adds `AI_TEXT_PROVIDER: "fake" | "openai"`
- Server env adds optional `OPENAI_TEXT_MODEL`

- [ ] **Step 1: Extend env tests first**

Add assertions that:

```ts
const env = parseServerEnv({
  NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon",
  SUPABASE_SERVICE_ROLE_KEY: "service-role",
  OPENAI_API_KEY: "secret",
  LTX_WORKER_SHARED_SECRET: "worker-secret",
  AI_TEXT_PROVIDER: "fake",
  OPENAI_TEXT_MODEL: "gpt-5.6-mini",
});

expect(env.AI_TEXT_PROVIDER).toBe("fake");
expect(env.OPENAI_TEXT_MODEL).toBe("gpt-5.6-mini");
```

Also test `AI_TEXT_PROVIDER: "invalid"` rejects.

- [ ] **Step 2: Run env tests and verify RED**

Run: `npm run test:run -- src/lib/env/schema.test.ts`
Expected: FAIL because new keys are not parsed.

- [ ] **Step 3: Update schema/accessor and `.env.example`**

Server schema fields:

```ts
AI_TEXT_PROVIDER: z.enum(["fake", "openai"]).default("fake"),
OPENAI_TEXT_MODEL: z.string().trim().min(1).optional(),
```

`src/lib/env/server.ts` must explicitly read both variables from `process.env`.

`.env.example` must include:

```dotenv
AI_TEXT_PROVIDER=fake
OPENAI_TEXT_MODEL=
```

- [ ] **Step 4: Run env tests and verify GREEN**

Run: `npm run test:run -- src/lib/env/schema.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add .env.example src/lib/env/schema.ts src/lib/env/server.ts src/lib/env/schema.test.ts
git commit -m "feat: add AI provider server configuration"
```

---

### Task 4: OpenAI Adapter with Mocked Transport

**Files:**
- Modify: `package.json`
- Create: `src/modules/ai/text/openai-provider.ts`
- Create: `src/modules/ai/text/openai-provider.test.ts`

**Interfaces:**
- Produces: `OpenAITextGenerationProvider`
- Constructor accepts a minimal injected transport for tests and defaults to the real OpenAI client server-side.

- [ ] **Step 1: Add failing adapter tests using a mocked transport**

Test these exact behaviors:

1. non-empty provider response maps to `{ text, provider: "openai", model }`
2. empty text throws normalized `AppError("PROVIDER_ERROR", ...)`
3. rate-limit-like transport error maps to a safe provider error without exposing raw secrets

The test transport must be a plain object/function; do not make network calls.

- [ ] **Step 2: Run adapter test and verify RED**

Run: `npm run test:run -- src/modules/ai/text/openai-provider.test.ts`
Expected: FAIL because the adapter does not exist.

- [ ] **Step 3: Add the official `openai` package dependency**

Add to `dependencies`:

```json
"openai": "^5.0.0"
```

Do not add any client-side OpenAI dependency or expose the API key.

- [ ] **Step 4: Implement the server-only adapter**

Requirements:

```ts
import "server-only";
```

- Default model: `gpt-5-mini` unless `OPENAI_TEXT_MODEL` is configured.
- Build instructions internally from `systemInstructions`, `topic`, optional knowledge context, and target language.
- Use one OpenAI Responses API call.
- Return only normalized text/model/provider metadata.
- Reject empty `output_text`.
- Convert provider exceptions to `AppError` with code `PROVIDER_ERROR` and safe message `Text generation is temporarily unavailable.`
- Never include API key or unrestricted raw provider payload in the thrown application error.

- [ ] **Step 5: Run adapter test and verify GREEN**

Run: `npm run test:run -- src/modules/ai/text/openai-provider.test.ts`
Expected: PASS without network access.

- [ ] **Step 6: Commit**

```bash
git add package.json src/modules/ai/text/openai-provider.ts src/modules/ai/text/openai-provider.test.ts
git commit -m "feat: add server-only OpenAI text provider"
```

---

### Task 5: Content Item Persistence and RLS

**Files:**
- Create: `supabase/migrations/202609090006_content_items.sql`
- Modify: `tests/rls/foundation-rls.sql`
- Create: `src/modules/content-studio/types.ts`
- Create: `src/modules/content-studio/repository.ts`

**Interfaces:**
- Produces: `ContentItemStatus = "DRAFT" | "GENERATING" | "GENERATED" | "FAILED"`
- Produces: repository methods `createDraft`, `markGenerating`, `markGenerated`, `markFailed`

- [ ] **Step 1: Extend the RLS SQL harness before migration implementation**

Add assertions/comments for:

- member can select own organization content items
- member cannot select another organization content item
- `OWNER`, `ADMIN`, `EDITOR` may insert/update
- non-editor roles cannot create/update

- [ ] **Step 2: Create migration**

Create `public.content_items` with the exact fields/statuses from the spec.

Required indexes:

```sql
create index content_items_org_created_idx
  on public.content_items (organization_id, created_at desc);

create index content_items_org_status_idx
  on public.content_items (organization_id, status);
```

Enable RLS and use existing `is_org_member()` / `has_org_role()` helpers.

Policies:

```sql
SELECT: public.is_org_member(organization_id)
INSERT: public.has_org_role(organization_id, array['OWNER','ADMIN','EDITOR'])
UPDATE: public.has_org_role(organization_id, array['OWNER','ADMIN','EDITOR'])
DELETE: public.has_org_role(organization_id, array['OWNER','ADMIN'])
```

- [ ] **Step 3: Add TypeScript domain types and repository abstraction**

Repository interface:

```ts
export interface ContentItemRepository {
  createDraft(input: CreateDraftInput): Promise<ContentItem>;
  markGenerating(id: string, organizationId: string): Promise<void>;
  markGenerated(input: MarkGeneratedInput): Promise<ContentItem>;
  markFailed(input: MarkFailedInput): Promise<ContentItem>;
}
```

Supabase implementation must always filter updates by both `id` and `organization_id`.

- [ ] **Step 4: Run typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/202609090006_content_items.sql tests/rls/foundation-rls.sql src/modules/content-studio/types.ts src/modules/content-studio/repository.ts
git commit -m "feat: add tenant-scoped content item persistence"
```

---

### Task 6: Content Studio Workflow Service

**Files:**
- Create: `src/modules/content-studio/service.test.ts`
- Create: `src/modules/content-studio/service.ts`

**Interfaces:**
- Consumes: `ContentGenerationRequest`, `ContentItemRepository`, `TextGenerationProvider`
- Produces: `generateContentScript(request, dependencies)`

- [ ] **Step 1: Write failing workflow tests with in-memory fakes**

Test success sequence:

```text
create DRAFT → mark GENERATING → provider generate → mark GENERATED
```

Assert final record contains generated script, provider, model, and generated timestamp metadata.

Test failure sequence:

```text
create DRAFT → mark GENERATING → provider throws → mark FAILED
```

Assert failure metadata is normalized and does not contain raw secrets.

- [ ] **Step 2: Run workflow tests and verify RED**

Run: `npm run test:run -- src/modules/content-studio/service.test.ts`
Expected: FAIL because service does not exist.

- [ ] **Step 3: Implement minimal workflow service**

Use this dependency shape:

```ts
export type ContentStudioDependencies = {
  repository: ContentItemRepository;
  provider: TextGenerationProvider;
  actorUserId: string;
};
```

System instructions must be constructed by server/domain code and must ask for a clear, factual, professional script in the requested language while using supplied knowledge as grounding context.

Idempotency key format:

```text
content:<contentItemId>:script:v1
```

- [ ] **Step 4: Run workflow tests and verify GREEN**

Run: `npm run test:run -- src/modules/content-studio/service.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/content-studio/service.ts src/modules/content-studio/service.test.ts
git commit -m "feat: add Content Studio generation workflow"
```

---

### Task 7: Provider Factory

**Files:**
- Create: `src/modules/ai/text/provider-factory.ts`
- Create: `src/modules/ai/text/provider-factory.test.ts`

**Interfaces:**
- Produces: `createTextGenerationProvider()`

- [ ] **Step 1: Write failing selection tests**

Test that injected config `fake` returns `FakeTextGenerationProvider` and `openai` returns an OpenAI provider without invoking the network.

- [ ] **Step 2: Run and verify RED**

Run: `npm run test:run -- src/modules/ai/text/provider-factory.test.ts`
Expected: FAIL because factory does not exist.

- [ ] **Step 3: Implement server-only factory**

The factory reads `AI_TEXT_PROVIDER` only on the server and returns the corresponding provider.

- [ ] **Step 4: Run and verify GREEN**

Run: `npm run test:run -- src/modules/ai/text/provider-factory.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/ai/text/provider-factory.ts src/modules/ai/text/provider-factory.test.ts
git commit -m "feat: add AI text provider factory"
```

---

### Task 8: Authenticated Content Studio Server Action

**Files:**
- Create: `src/app/(app)/content-studio/actions.ts`
- Create: `src/app/(app)/content-studio/actions.test.ts`

**Interfaces:**
- Produces: `generateContentAction(input): Promise<GenerateContentActionResult>`

- [ ] **Step 1: Write failing action tests around extracted dependencies**

Test:

- unauthenticated request returns safe authentication error
- non-member/unauthorized request returns safe permission error
- valid request calls workflow and returns generated content item/script
- provider failure returns safe `generation temporarily unavailable` message

- [ ] **Step 2: Run and verify RED**

Run: `npm run test:run -- 'src/app/(app)/content-studio/actions.test.ts'`
Expected: FAIL because action does not exist.

- [ ] **Step 3: Implement server action**

Requirements:

```ts
"use server";
```

- parse with `contentGenerationRequestSchema`
- obtain Supabase authenticated user
- verify membership and allowed role before generation
- instantiate repository/provider server-side
- call workflow
- return only serializable safe result
- never return raw provider error, stack, or API key

- [ ] **Step 4: Run and verify GREEN**

Run: `npm run test:run -- 'src/app/(app)/content-studio/actions.test.ts'`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add 'src/app/(app)/content-studio/actions.ts' 'src/app/(app)/content-studio/actions.test.ts'
git commit -m "feat: add authenticated Content Studio action"
```

---

### Task 9: Functional Content Studio UI

**Files:**
- Create: `src/app/(app)/content-studio/content-studio-form.tsx`
- Modify: `src/app/(app)/content-studio/page.tsx`

**Interfaces:**
- Consumes: `generateContentAction`

- [ ] **Step 1: Replace placeholder page with server wrapper and client form**

Form fields:

- `organizationId`
- `topic`
- `knowledgeContext`
- `language`

Language labels:

- EN → English
- PL → Polish
- HI → Hindi

Visible states:

- idle
- generating
- safe error
- generated script

Do not display provider API credentials or raw provider diagnostics.

- [ ] **Step 2: Add accessible labels and deterministic test selectors**

Required selectors:

```text
[data-testid="content-topic"]
[data-testid="content-context"]
[data-testid="content-language"]
[data-testid="content-generate"]
[data-testid="content-result"]
```

- [ ] **Step 3: Run typecheck and lint**

Run:

```bash
npm run typecheck
npm run lint
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add 'src/app/(app)/content-studio/page.tsx' 'src/app/(app)/content-studio/content-studio-form.tsx'
git commit -m "feat: add functional Content Studio interface"
```

---

### Task 10: CI-Safe Content Studio E2E

**Files:**
- Create: `tests/e2e/content-studio.spec.ts`
- Modify: `.github/workflows/ci.yml`

**Interfaces:**
- CI uses fake provider and never spends OpenAI credits.

- [ ] **Step 1: Add fake-provider environment to CI**

At job level:

```yaml
env:
  AI_TEXT_PROVIDER: fake
```

Do not add a real `OPENAI_API_KEY` secret requirement to CI.

- [ ] **Step 2: Add E2E smoke test**

The test must open `/content-studio`, fill the deterministic form, submit, and assert a non-empty result using the fake provider. If authentication plumbing is not yet globally implemented in the UI, use the existing test-safe application harness rather than bypassing server authorization in production code.

- [ ] **Step 3: Run full verification**

Run:

```bash
npm run typecheck
npm run lint
npm run test:run
npm run build
npm run test:e2e
```

Expected: all exit 0.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/ci.yml tests/e2e/content-studio.spec.ts
git commit -m "test: add Content Studio E2E coverage"
```

---

### Task 11: Branch-Wide Review and PR

**Files:**
- Review all files changed relative to `main`.

- [ ] **Step 1: Compare branch to main**

Run:

```bash
git diff --check main...HEAD
git diff --stat main...HEAD
```

Expected: no whitespace errors and only AI Content Studio scoped changes.

- [ ] **Step 2: Re-run fresh verification**

Run:

```bash
npm run typecheck
npm run lint
npm run test:run
npm run build
npm run test:e2e
```

Expected: all exit 0.

- [ ] **Step 3: Review security invariants**

Confirm:

- no `NEXT_PUBLIC_OPENAI_*` variable exists
- no API key is persisted or logged
- all `content_items` queries are tenant scoped
- RLS exists and defaults cross-org access to denied
- fake provider is the CI default
- no real OpenAI call occurs in unit/E2E tests

- [ ] **Step 4: Open a draft PR to `main`**

PR summary must state that real OpenAI credentials are deployment configuration only and are not committed.

- [ ] **Step 5: Let GitHub Actions verify the PR head**

Do not mark ready or merge until CI reports successful typecheck, lint, unit tests, build, and E2E.
