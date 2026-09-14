import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  join(process.cwd(), "supabase/functions/generate-content/index.ts"),
  "utf8",
);

describe("generate-content Edge cost guardrails", () => {
  it("uses an explicit model allowlist", () => {
    expect(source).toContain("ALLOWED_MODELS");
    expect(source).toContain('"gpt-5.6-luna"');
    expect(source).toContain('"gpt-5.6-terra"');
    expect(source).not.toContain('"gpt-5.6-sol"');
    expect(source).toMatch(/if \(!ALLOWED_MODELS\.has\(model\)\)/);
  });

  it("bounds instruction and input sizes before provider execution", () => {
    expect(source).toContain("MAX_INSTRUCTIONS_CHARS");
    expect(source).toContain("MAX_INPUT_CHARS");
    expect(source).toMatch(/body\.instructions\.length > MAX_INSTRUCTIONS_CHARS/);
    expect(source).toMatch(/body\.input\.length > MAX_INPUT_CHARS/);
  });

  it("uses separate bounded output-token budgets for interactive and publishing generation", () => {
    expect(source).toContain("INTERACTIVE_MAX_OUTPUT_TOKENS");
    expect(source).toContain("PUBLISHING_MAX_OUTPUT_TOKENS");
    expect(source).toMatch(/const INTERACTIVE_MAX_OUTPUT_TOKENS = 4_000/);
    expect(source).toMatch(/const PUBLISHING_MAX_OUTPUT_TOKENS = 12_000/);
    expect(source).toMatch(/const maxOutputTokens = internalRequest\s*\?\s*PUBLISHING_MAX_OUTPUT_TOKENS\s*:\s*INTERACTIVE_MAX_OUTPUT_TOKENS/);
    expect(source).toMatch(/max_output_tokens:\s*maxOutputTokens/);
  });

  it("keeps interactive and background generation on separate bounded database quotas", () => {
    expect(source).toContain("RATE_LIMIT_WINDOW_SECONDS");
    expect(source).toContain("INTERACTIVE_RATE_LIMIT_REQUESTS");
    expect(source).toContain("PUBLISHING_RATE_LIMIT_REQUESTS");
    expect(source).toMatch(/requestLimit\s*=\s*internalRequest\s*\?\s*PUBLISHING_RATE_LIMIT_REQUESTS\s*:\s*INTERACTIVE_RATE_LIMIT_REQUESTS/);
    expect(source).toContain('admin.rpc("consume_generation_quota", {');
    expect(source).toContain("_request_limit: requestLimit");
    expect(source).toContain('error: "GENERATION_RATE_LIMITED"');

    const quotaCall = source.indexOf('admin.rpc("consume_generation_quota", {');
    const secretRead = source.indexOf('admin.rpc("read_integration_vault_secret", {');
    const providerCall = source.indexOf('fetch("https://api.openai.com/v1/responses"');
    expect(quotaCall).toBeGreaterThan(-1);
    expect(secretRead).toBeGreaterThan(quotaCall);
    expect(providerCall).toBeGreaterThan(secretRead);
  });

  it("retries transient worker-dispatch Vault reads while remaining fail-closed", () => {
    expect(source).toContain("WORKER_SECRET_READ_ATTEMPTS");
    expect(source).toContain("readPublishingWorkerSecret");
    expect(source).toMatch(/for \(let attempt = 1; attempt <= WORKER_SECRET_READ_ATTEMPTS; attempt \+= 1\)/);
    expect(source).toContain('error: "WORKER_AUTH_UNAVAILABLE"');
    expect(source).toContain('if (internalHeader !== publishingWorkerSecret) return json(401, { error: "UNAUTHORIZED" });');
    expect(source).toContain("internalRequest = true");
  });

  it("authenticates interactive callers inside the handler", () => {
    expect(source).toContain('req.headers.get("authorization")');
    expect(source).toContain("admin.auth.getUser(token)");
    expect(source).toContain('error: "UNAUTHORIZED"');
  });

  it("enforces exact publishing blueprint and chapter JSON contracts at the live Edge boundary", () => {
    expect(source).toContain("publishingJsonContract");
    expect(source).toContain("BLUEPRINT JSON CONTRACT");
    expect(source).toContain("CHAPTER MANUSCRIPT JSON CONTRACT");
    expect(source).toContain("Do not rename, omit, nest, or wrap these keys");
    expect(source).toMatch(/providerInstructions\s*=\s*internalRequest/);
    expect(source).toMatch(/instructions:\s*providerInstructions/);
  });

  it("records secret-free internal generation diagnostics", () => {
    expect(source).toContain("auditInternalGeneration");
    expect(source).toContain('from("integration_audit_events")');
    expect(source).toContain('event_type: "PUBLISHING_GENERATION_DIAGNOSTIC"');
    expect(source).toContain("instructionChars");
    expect(source).toContain("inputChars");

    const auditStart = source.indexOf("async function auditInternalGeneration");
    const auditEnd = source.indexOf("function extractOutputText", auditStart);
    const auditSource = source.slice(auditStart, auditEnd);
    expect(auditStart).toBeGreaterThan(-1);
    expect(auditEnd).toBeGreaterThan(auditStart);
    expect(auditSource).not.toContain("apiKey");
    expect(auditSource).not.toContain("publishingWorkerSecret");
  });

  it("does not expose the provider API key in responses", () => {
    const successResponse = source.match(/return json\(200, \{[\s\S]*?\n  \}\);/)?.[0] ?? "";
    expect(successResponse).not.toContain("apiKey");
    expect(successResponse).not.toContain("authorization");
  });
});
