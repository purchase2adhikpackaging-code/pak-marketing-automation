import { describe, expect, it, vi } from "vitest";

import {
  invokeEdgeFunction,
  invokeVideoGenerationWithDependencies,
  type EdgeInvokeDependencies,
} from "./edge-client";

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

  it("invokes video generation with identifiers only and returns normalized safe state", async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ state: "SUBMITTED", jobId: "job-1", attemptId: "attempt-1" }), { status: 200 }),
    );

    await expect(
      invokeVideoGenerationWithDependencies<{ state: string; jobId: string; attemptId: string }>(
        {
          operation: "submit",
          organizationId: "11111111-1111-4111-8111-111111111111",
          jobId: "22222222-2222-4222-8222-222222222222",
          attemptId: "33333333-3333-4333-8333-333333333333",
        },
        deps(fetchFn),
      ),
    ).resolves.toEqual({ state: "SUBMITTED", jobId: "job-1", attemptId: "attempt-1" });

    const [url, init] = fetchFn.mock.calls[0]!;
    expect(url).toBe("https://example.supabase.co/functions/v1/video-generation");
    expect(JSON.parse(String(init.body))).toEqual({
      operation: "submit",
      organizationId: "11111111-1111-4111-8111-111111111111",
      jobId: "22222222-2222-4222-8222-222222222222",
      attemptId: "33333333-3333-4333-8333-333333333333",
    });
  });
});
