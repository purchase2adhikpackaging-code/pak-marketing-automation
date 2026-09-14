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

  it("lists only broker-approved automation targets", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
    const fetchImpl = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      expect(JSON.parse(String(init?.body))).toEqual({ action: "listAutomationTargets" });
      return new Response(JSON.stringify({
        targets: [{ organizationId: "932a5898-a85f-4ba6-b571-66d6fe8cd9e8", concurrency: 4 }],
      }), { status: 200, headers: { "content-type": "application/json" } });
    });
    const broker = createPublishingWorkerBrokerClient({ credential: "worker", fetchImpl });
    await expect(broker.listAutomationTargets()).resolves.toEqual([
      { organizationId: "932a5898-a85f-4ba6-b571-66d6fe8cd9e8", concurrency: 4 },
    ]);
  });

  it("bootstraps an idempotent automatic portfolio run through the broker", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
    const jobs = [{ job: { bookId: "BOOK-1" }, curriculumText: "governed curriculum" }];
    const fetchImpl = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      expect(JSON.parse(String(init?.body))).toEqual({
        action: "bootstrapPortfolio",
        organizationId: "932a5898-a85f-4ba6-b571-66d6fe8cd9e8",
        idempotencyKey: "auto:2026:0.1.0:abc12345",
        jobs,
      });
      return new Response(JSON.stringify({ runId: "171d9d52-b497-456f-8dbb-bc947a20865e" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });
    const broker = createPublishingWorkerBrokerClient({ credential: "worker", fetchImpl });
    await expect(broker.bootstrapPortfolio({
      organizationId: "932a5898-a85f-4ba6-b571-66d6fe8cd9e8",
      idempotencyKey: "auto:2026:0.1.0:abc12345",
      jobs,
    })).resolves.toEqual({ runId: "171d9d52-b497-456f-8dbb-bc947a20865e" });
  });

  it("maps an invalid worker credential to unauthorized without leaking the capability", async () => {
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

    await expect(broker.authorize()).resolves.toBe(false);
  });

  it("still treats non-auth broker failures as infrastructure errors", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
    const fetchImpl = vi.fn(async () => new Response(
      JSON.stringify({ error: "BROKER_UNAVAILABLE" }),
      { status: 503, headers: { "content-type": "application/json" } },
    ));

    const broker = createPublishingWorkerBrokerClient({
      credential: "opaque-worker-capability",
      fetchImpl,
    });

    await expect(broker.authorize()).rejects.toMatchObject({ status: 503 });
  });

  it("truncates failure messages to the broker-supported 4000 characters", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
    const fetchImpl = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as { action?: string; error?: string };
      expect(body.action).toBe("failJob");
      expect(body.error).toHaveLength(4_000);
      expect(body.error).toBe("x".repeat(4_000));
      return new Response(JSON.stringify({ job: { id: "job-1" } }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });

    const broker = createPublishingWorkerBrokerClient({
      credential: "opaque-worker-capability",
      fetchImpl,
    });

    await broker.failJob({ jobId: "job-1", workerId: "worker-1", error: "x".repeat(5_000) });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
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
