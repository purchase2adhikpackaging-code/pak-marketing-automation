import { describe, expect, it, vi } from "vitest";

import { invokeEdgeFunction, type EdgeInvokeDependencies } from "./edge-client";

const env = {
  NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
};

function deps(fetchFn: EdgeInvokeDependencies["fetchFn"], token: string | null = "user-jwt"): EdgeInvokeDependencies {
  return {
    env,
    getAccessToken: vi.fn().mockResolvedValue(token),
    fetchFn,
  };
}

describe("Supabase Edge client", () => {
  it("forwards the authenticated user JWT and public Supabase key", async () => {
    const fetchFn = vi.fn().mockResolvedValue(new Response(JSON.stringify({ connection: { id: "safe" } }), { status: 200 }));

    const result = await invokeEdgeFunction<{ connection: { id: string } }>(
      "integration-vault",
      { action: "test" },
      deps(fetchFn),
    );

    expect(result).toEqual({ connection: { id: "safe" } });
    expect(fetchFn).toHaveBeenCalledWith(
      "https://example.supabase.co/functions/v1/integration-vault",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          apikey: "anon-key",
          authorization: "Bearer user-jwt",
        }),
      }),
    );
  });

  it("rejects when there is no authenticated session", async () => {
    await expect(
      invokeEdgeFunction("integration-vault", { action: "test" }, deps(vi.fn(), null)),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("normalizes Edge errors without returning provider response details", async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: "AUTH_INVALID", provider_detail: "secret-sk-value" }), { status: 422 }),
    );

    try {
      await invokeEdgeFunction("integration-vault", { action: "test" }, deps(fetchFn));
      throw new Error("expected failure");
    } catch (error) {
      expect(error).toMatchObject({ code: "PROVIDER_ERROR" });
      expect(String(error)).not.toContain("secret-sk-value");
    }
  });
});
