import { afterEach, describe, expect, it, vi } from "vitest";
import { createPublishingWorkerBrokerClient } from "@/modules/publishing-production/worker-broker-client";

const ORIGINAL_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ORIGINAL_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

afterEach(() => {
  if (ORIGINAL_URL === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  else process.env.NEXT_PUBLIC_SUPABASE_URL = ORIGINAL_URL;
  if (ORIGINAL_ANON === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  else process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = ORIGINAL_ANON;
});

describe("publishing worker broker client", () => {
  it("authenticates through the public Edge gateway plus the opaque worker credential", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toBe("https://example.supabase.co/functions/v1/publishing-worker-broker");
      expect(init?.method).toBe("POST");
      expect(init?.headers).toMatchObject({
        apikey: "anon-key",
        authorization: "Bearer anon-key",
        "content-type": "application/json",
        "x-publishing-worker-secret": "opaque-worker-capability",
      });
      expect(JSON.parse(String(init?.body))).toEqual({ action: "authorize" });
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });

    const broker = createPublishingWorkerBrokerClient({
      credential: "opaque-worker-capability",
      fetchImpl,
    });

    await expect(broker.authorize()).resolves.toBe(true);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("fails closed without leaking the worker credential in the thrown error", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
    const fetchImpl = vi.fn(async () => new Response(
      JSON.stringify({ error: "UNAUTHORIZED", diagnostic: "opaque-worker-capability" }),
      { status: 401, headers: { "content-type": "application/json" } },
    ));

    const broker = createPublishingWorkerBrokerClient({
      credential: "opaque-worker-capability",
      fetchImpl,
    });

    let message = "";
    try {
      await broker.authorize();
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }
    expect(message).toContain("401");
    expect(message).not.toContain("opaque-worker-capability");
  });

  it("requires the public Supabase URL and anon key but never a service-role environment variable", () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;

    expect(() => createPublishingWorkerBrokerClient({ credential: "worker" })).toThrow(/NEXT_PUBLIC_SUPABASE_URL/);

    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    expect(() => createPublishingWorkerBrokerClient({ credential: "worker" })).toThrow(/NEXT_PUBLIC_SUPABASE_ANON_KEY/);
  });
});
