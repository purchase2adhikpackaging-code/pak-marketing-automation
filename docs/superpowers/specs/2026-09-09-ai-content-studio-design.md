# PAK AI Content Studio — Design Specification

Date: 2026-09-09
Status: Approved design checkpoint
Project: PAK Marketing Automation
Branch: `feat/ai-content-studio`

## 1. Scope

This slice implements the first real AI-powered content workflow for PAK Marketing Automation. It covers:

- tenant-scoped content item persistence
- topic and knowledge/context capture
- language selection
- server-only AI generation
- provider-neutral text generation contracts
- OpenAI as the first provider implementation
- generated script persistence
- normalized provider failures
- a minimal functional Content Studio UI

This slice does not implement scene planning, LTX generation, FFmpeg composition, approvals, scheduling, publishing, or analytics.

## 2. Product Flow

The first supported flow is:

`Topic → Knowledge Context → Language → Generate Script → Persist Result`

A user opens Content Studio, enters a topic, optional knowledge/context, and target language, then requests generation. The request is validated server-side, authorization is enforced against the user's organization, an AI provider is invoked, and the resulting script is persisted on the content item.

## 3. Architecture

The subsystem is split into three clear boundaries:

1. **Text generation contract** — provider-neutral request/result/error types and interface.
2. **OpenAI provider** — server-only implementation that adapts OpenAI responses into the internal contract.
3. **Content Studio service** — application/domain workflow that validates input, owns persistence state transitions, calls the provider contract, and normalizes failures.

Content Studio code must never depend directly on OpenAI-specific SDK response shapes.

## 4. Security Boundary

The OpenAI API key is server-only.

It must not appear in:

- client bundles
- browser-visible environment variables
- database rows
- logs
- error responses
- telemetry payloads

Only `src/lib/env/server.ts` may expose `OPENAI_API_KEY` to server-side code.

The browser submits only business input such as topic, context, language, and the selected organization-scoped content item identifier.

## 5. Content Item Model

Create a tenant-owned `content_items` table with these fields:

- `id uuid primary key`
- `organization_id uuid not null`
- `created_by uuid not null`
- `title text not null`
- `topic text not null`
- `knowledge_context text`
- `language text not null`
- `status text not null`
- `generated_script text`
- `provider text`
- `provider_model text`
- `provider_metadata jsonb`
- `failure_metadata jsonb`
- `created_at timestamptz not null`
- `updated_at timestamptz not null`
- `generated_at timestamptz`

Canonical status values for this slice:

- `DRAFT`
- `GENERATING`
- `GENERATED`
- `FAILED`

The table is organization-scoped and protected by RLS.

## 6. Authorization

Users may read content items only for organizations they belong to.

Creation requires an authenticated organization member with a role permitted to create content. For this slice, `OWNER`, `ADMIN`, and `EDITOR` may create/update content items.

RLS remains the final tenant boundary. Server-side application authorization complements but does not replace RLS.

## 7. Text Generation Contract

Define a provider-neutral interface equivalent to:

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

export interface TextGenerationProvider {
  readonly name: string;
  validateConfiguration(): Promise<void>;
  generate(request: TextGenerationRequest): Promise<TextGenerationResult>;
}
```

Provider errors are normalized into a provider-neutral shape with a stable code, message, retryable flag, and optional raw diagnostic data that is never surfaced directly to clients.

## 8. OpenAI Provider

The first concrete implementation uses OpenAI for script generation.

Requirements:

- server-only module
- API key sourced from `getServerEnv()`
- model configured in one server-side constant or configuration function
- uses structured prompt construction rather than raw client prompt passthrough
- never logs prompts together with secrets or raw provider payloads containing sensitive data
- validates that returned text is non-empty
- normalizes transport/rate-limit/provider failures

For this first slice, the provider returns a single script text. Scene planning and translations beyond the selected target language remain future slices.

## 9. Content Studio Service

The workflow service owns state transitions:

1. validate request
2. create a `DRAFT` content item
3. transition to `GENERATING`
4. invoke the text generation provider
5. on success, persist script and transition to `GENERATED`
6. on failure, persist normalized failure metadata and transition to `FAILED`

The service depends on abstractions for persistence and text generation so domain tests can use deterministic fakes.

## 10. Validation

Use Zod schemas for the request boundary.

Validation rules:

- topic: trimmed, minimum 3 characters, maximum 300
- knowledge context: optional, trimmed, maximum 12000 characters
- language: `EN`, `PL`, or `HI`
- organization ID: UUID

The client may prevalidate for UX, but the server boundary is authoritative.

## 11. UI

Replace the placeholder Content Studio page with a minimal functional form containing:

- Topic input
- Knowledge / context textarea
- Language selector: English, Polish, Hindi
- Generate Script button
- visible generation/error state
- generated script output panel

The UI must not expose provider credentials or provider implementation details.

## 12. Server Boundary

Use a Next.js server action for the first implementation.

The action must:

- parse and validate form input with the canonical schema
- resolve authenticated Supabase user
- verify organization membership/permission
- call the Content Studio service
- return a small serializable success/error result

Provider raw errors and stack traces must not cross this boundary.

## 13. Testing

Use TDD for domain and provider-neutral behavior.

Required tests:

- request schema accepts valid EN/PL/HI requests
- request schema rejects invalid topic/context/language
- fake text provider returns deterministic text
- Content Studio workflow transitions to `GENERATED` on success
- workflow persists normalized `FAILED` state on provider failure
- authorization-sensitive server/service behavior rejects unauthorized organization access
- OpenAI adapter tests use a mocked transport/client and do not spend API credits
- Content Studio page/server action E2E smoke path remains deterministic by using a test-safe fake provider switch in CI

No CI test may require a real OpenAI API key or consume paid API credits.

## 14. Configuration

Add server-side configuration for AI provider selection:

- `AI_TEXT_PROVIDER=fake|openai`
- `OPENAI_API_KEY` remains server-only
- `OPENAI_TEXT_MODEL` optional server-side model override

CI and local test environments default to `fake`.

Production may select `openai` after the secret is configured in the deployment environment.

## 15. Error Handling

Use existing `AppError` for application-facing normalized failures.

Map provider failures into stable application error codes/messages. Persist diagnostic metadata sufficient for internal debugging without storing API keys or unrestricted raw sensitive payloads.

Client responses should be safe and concise, for example:

- validation failure
- authentication required
- insufficient permission
- generation temporarily unavailable

## 16. Non-Goals

Explicitly excluded from this slice:

- multi-step agent orchestration
- autonomous publishing
- vector database / embeddings
- RAG indexing pipeline
- image generation
- scene generation
- LTX integration
- FFmpeg rendering
- social platform integrations
- approval workflow implementation

These remain separate future slices built on the persisted content item and provider boundaries introduced here.
