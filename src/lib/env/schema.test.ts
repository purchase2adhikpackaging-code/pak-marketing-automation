import { describe, expect, it } from "vitest";

import { parsePublicEnv, parseServerEnv } from "./schema";

const validPublic = {
  NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
};

const validServer = {
  ...validPublic,
  SUPABASE_SERVICE_ROLE_KEY: "service-role",
  OPENAI_API_KEY: "openai-key",
  LTX_WORKER_SHARED_SECRET: "ltx-secret",
  AI_TEXT_PROVIDER: "fake" as const,
  OPENAI_TEXT_MODEL: "gpt-5-mini",
};

describe("environment schema", () => {
  it("rejects missing public environment", () => {
    expect(() => parsePublicEnv({})).toThrow();
  });

  it("requires all server-only secrets", () => {
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
      OPENAI_TEXT_MODEL: undefined,
    };

    expect(parseServerEnv(withoutAiConfig).AI_TEXT_PROVIDER).toBe("fake");
  });

  it("allows fake provider without an OpenAI key and normalizes a blank model", () => {
    const env = parseServerEnv({
      ...validPublic,
      SUPABASE_SERVICE_ROLE_KEY: "service-role",
      LTX_WORKER_SHARED_SECRET: "ltx-secret",
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
        ...validPublic,
        SUPABASE_SERVICE_ROLE_KEY: "service-role",
        LTX_WORKER_SHARED_SECRET: "ltx-secret",
        AI_TEXT_PROVIDER: "openai",
        OPENAI_TEXT_MODEL: "gpt-5.6-luna",
      }),
    ).toThrow();
  });

  it("accepts OpenAI when a key is present", () => {
    const env = parseServerEnv({
      ...validPublic,
      SUPABASE_SERVICE_ROLE_KEY: "service-role",
      OPENAI_API_KEY: "server-secret",
      LTX_WORKER_SHARED_SECRET: "ltx-secret",
      AI_TEXT_PROVIDER: "openai",
      OPENAI_TEXT_MODEL: "gpt-5.6-luna",
    });

    expect(env.OPENAI_API_KEY).toBe("server-secret");
  });

  it("rejects unsupported AI providers", () => {
    expect(() => parseServerEnv({ ...validServer, AI_TEXT_PROVIDER: "invalid" })).toThrow();
  });
});
