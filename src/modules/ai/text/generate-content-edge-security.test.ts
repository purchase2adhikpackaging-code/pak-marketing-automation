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

  it("caps provider output tokens", () => {
    expect(source).toContain("MAX_OUTPUT_TOKENS");
    expect(source).toMatch(/max_output_tokens:\s*MAX_OUTPUT_TOKENS/);
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

  it("does not expose the provider API key in responses", () => {
    const successResponse = source.match(/return json\(200, \{[\s\S]*?\n  \}\);/)?.[0] ?? "";
    expect(successResponse).not.toContain("apiKey");
    expect(successResponse).not.toContain("authorization");
  });
});
