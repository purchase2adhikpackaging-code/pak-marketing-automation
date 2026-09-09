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
});
