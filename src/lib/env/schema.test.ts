import { describe, expect, it } from "vitest";

import { parsePublicEnv, parseServerEnv } from "./schema";

const validPublic = {
  NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
};

const validServer = {
  ...validPublic,
  LTX_WORKER_SHARED_SECRET: "ltx-secret",
  AI_TEXT_PROVIDER: "fake" as const,
};

describe("environment schema", () => {
  it("rejects missing public environment", () => {
    expect(() => parsePublicEnv({})).toThrow();
  });

  it("does not require Vercel-held Supabase service-role or vault encryption secrets", () => {
    expect(parseServerEnv(validServer)).toEqual(validServer);
  });

  it("returns only public keys from the public parser", () => {
    expect(parsePublicEnv({ ...validServer, EXTRA: "ignored" })).toEqual(validPublic);
  });

  it("defaults the AI provider to fake", () => {
    const withoutAiConfig = {
      ...validServer,
      AI_TEXT_PROVIDER: undefined,
    };

    expect(parseServerEnv(withoutAiConfig).AI_TEXT_PROVIDER).toBe("fake");
  });

  it("accepts OpenAI provider selection without a host-level OpenAI key", () => {
    const env = parseServerEnv({
      ...validPublic,
      LTX_WORKER_SHARED_SECRET: "ltx-secret",
      AI_TEXT_PROVIDER: "openai",
    });

    expect(env.AI_TEXT_PROVIDER).toBe("openai");
    expect(env).not.toHaveProperty("OPENAI_API_KEY");
    expect(env).not.toHaveProperty("SUPABASE_SERVICE_ROLE_KEY");
    expect(env).not.toHaveProperty("INTEGRATION_VAULT_ENCRYPTION_KEY");
  });

  it("rejects unsupported AI providers", () => {
    expect(() => parseServerEnv({ ...validServer, AI_TEXT_PROVIDER: "invalid" })).toThrow();
  });
});
