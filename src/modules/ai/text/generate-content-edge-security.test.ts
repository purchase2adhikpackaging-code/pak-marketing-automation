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

  it("does not expose the provider API key in responses", () => {
    const successResponse = source.match(/return json\(200, \{[\s\S]*?\n  \}\);/)?.[0] ?? "";
    expect(successResponse).not.toContain("apiKey");
    expect(successResponse).not.toContain("authorization");
  });
});
