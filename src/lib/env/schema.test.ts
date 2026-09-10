import { describe, expect, it } from "vitest";

import { parsePublicEnv, parseServerEnv } from "./schema";

const validPublic = {
  NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
};

const validServer = {
  ...validPublic,
  SUPABASE_SERVICE_ROLE_KEY: "service-role",
  INTEGRATION_VAULT_ENCRYPTION_KEY: Buffer.alloc(32, 3).toString("base64"),
  LTX_WORKER_SHARED_SECRET: "ltx-secret",
  AI_TEXT_PROVIDER: "fake" as const,
};

describe("environment schema", () => {
  it("rejects missing public environment", () => {
    expect(() => parsePublicEnv({})).toThrow();
  });

  it("requires server bootstrap secrets", () => {
    expect(() => parseServerEnv(validPublic)).toThrow();
  });

  it("returns only public keys from the public parser", () => {
    expect(parsePublicEnv({ ...validServer, EXTRA: "ignored" })).toEqual(validPublic);
  });

  it("parses complete server environment", () => {
    expect(parseServerEnv(validServer)).toEqual(validServer);
  });

  it("defaults the AI provider to fake", () => {
    const withoutAiConfig = {
      ...validServer,
      AI_TEXT_PROVIDER: undefined,
    };

    expect(parseServerEnv(withoutAiConfig).AI_TEXT_PROVIDER).toBe("fake");
  });

  it("allows fake provider without a vault encryption key until vault features execute", () => {
    const env = parseServerEnv({
      ...validPublic,
      SUPABASE_SERVICE_ROLE_KEY: "service-role",
      LTX_WORKER_SHARED_SECRET: "ltx-secret",
      AI_TEXT_PROVIDER: "fake",
      INTEGRATION_VAULT_ENCRYPTION_KEY: "",
    });

    expect(env.AI_TEXT_PROVIDER).toBe("fake");
    expect(env.INTEGRATION_VAULT_ENCRYPTION_KEY).toBeUndefined();
  });

  it("accepts OpenAI provider selection without a host-level OpenAI key", () => {
    const env = parseServerEnv({
      ...validPublic,
      SUPABASE_SERVICE_ROLE_KEY: "service-role",
      INTEGRATION_VAULT_ENCRYPTION_KEY: Buffer.alloc(32, 4).toString("base64"),
      LTX_WORKER_SHARED_SECRET: "ltx-secret",
      AI_TEXT_PROVIDER: "openai",
    });

    expect(env.AI_TEXT_PROVIDER).toBe("openai");
    expect(env).not.toHaveProperty("OPENAI_API_KEY");
  });

  it("rejects unsupported AI providers", () => {
    expect(() => parseServerEnv({ ...validServer, AI_TEXT_PROVIDER: "invalid" })).toThrow();
  });
});
