import { describe, expect, it } from "vitest";
import { handlePublishingWorkerRequest } from "@/modules/publishing-production/node-worker-route";

describe("publishing worker route security", () => {
  it("rejects a missing bearer credential before broker authorization", async () => {
    let authorizeCalls = 0;
    const response = await handlePublishingWorkerRequest(
      new Request("https://example.test/api/internal/publishing-worker", { method: "POST", body: "{}" }),
      {
        authorize: async () => { authorizeCalls += 1; return true; },
        run: async () => ({ claimed: 0, yielded: 0, completed: 0, failed: 0 }),
      },
    );
    expect(response.status).toBe(401);
    expect(authorizeCalls).toBe(0);
  });

  it("rejects a bearer credential that the trusted broker does not authorize", async () => {
    const response = await handlePublishingWorkerRequest(
      new Request("https://example.test/api/internal/publishing-worker", {
        method: "POST",
        headers: { authorization: "Bearer wrong" },
        body: "{}",
      }),
      {
        authorize: async (credential) => {
          expect(credential).toBe("wrong");
          return false;
        },
        run: async () => ({ claimed: 0, yielded: 0, completed: 0, failed: 0 }),
      },
    );
    expect(response.status).toBe(401);
  });

  it("returns service unavailable when trusted broker authorization cannot be checked", async () => {
    const response = await handlePublishingWorkerRequest(
      new Request("https://example.test/api/internal/publishing-worker", {
        method: "POST",
        headers: { authorization: "Bearer worker-capability" },
        body: "{}",
      }),
      {
        authorize: async () => { throw new Error("broker unavailable"); },
        run: async () => ({ claimed: 0, yielded: 0, completed: 0, failed: 0 }),
      },
    );
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "WORKER_AUTH_UNAVAILABLE" });
  });

  it("rejects credential-like request payload fields", async () => {
    const response = await handlePublishingWorkerRequest(
      new Request("https://example.test/api/internal/publishing-worker", {
        method: "POST",
        headers: { authorization: "Bearer worker-capability", "content-type": "application/json" },
        body: JSON.stringify({ apiKey: "do-not-accept" }),
      }),
      {
        authorize: async () => true,
        run: async () => ({ claimed: 0, yielded: 0, completed: 0, failed: 0 }),
      },
    );
    expect(response.status).toBe(400);
  });

  it("runs a single bounded batch with default concurrency four and the authorized opaque credential", async () => {
    let received: { concurrency?: number; workerId: string; credential: string } | undefined;
    const response = await handlePublishingWorkerRequest(
      new Request("https://example.test/api/internal/publishing-worker", {
        method: "POST",
        headers: { authorization: "Bearer worker-capability", "content-type": "application/json" },
        body: JSON.stringify({}),
      }),
      {
        authorize: async (credential) => credential === "worker-capability",
        run: async (input) => {
          received = input;
          return { claimed: 0, yielded: 0, completed: 0, failed: 0 };
        },
      },
    );
    expect(response.status).toBe(200);
    expect(received?.concurrency).toBe(4);
    expect(received?.workerId).toMatch(/^vercel-/);
    expect(received?.credential).toBe("worker-capability");
  });

  it("schedules exactly one follow-up with the same opaque credential when a bounded batch claimed work", async () => {
    let scheduled: { concurrency: number; credential: string } | undefined;
    const response = await handlePublishingWorkerRequest(
      new Request("https://example.test/api/internal/publishing-worker", {
        method: "POST",
        headers: { authorization: "Bearer worker-capability", "content-type": "application/json" },
        body: "{}",
      }),
      {
        authorize: async () => true,
        run: async () => ({ claimed: 4, yielded: 3, completed: 1, failed: 0 }),
        scheduleNext: (input) => { scheduled = input; },
      },
    );
    expect(response.status).toBe(200);
    expect(scheduled).toEqual({ concurrency: 4, credential: "worker-capability" });
  });

  it("does not schedule another invocation when the queue is empty", async () => {
    let scheduled = 0;
    const response = await handlePublishingWorkerRequest(
      new Request("https://example.test/api/internal/publishing-worker", {
        method: "POST",
        headers: { authorization: "Bearer worker-capability", "content-type": "application/json" },
        body: "{}",
      }),
      {
        authorize: async () => true,
        run: async () => ({ claimed: 0, yielded: 0, completed: 0, failed: 0 }),
        scheduleNext: () => { scheduled += 1; },
      },
    );
    expect(response.status).toBe(200);
    expect(scheduled).toBe(0);
  });

  it("rejects concurrency outside the governed range", async () => {
    const response = await handlePublishingWorkerRequest(
      new Request("https://example.test/api/internal/publishing-worker", {
        method: "POST",
        headers: { authorization: "Bearer worker-capability", "content-type": "application/json" },
        body: JSON.stringify({ concurrency: 33 }),
      }),
      {
        authorize: async () => true,
        run: async () => ({ claimed: 0, yielded: 0, completed: 0, failed: 0 }),
      },
    );
    expect(response.status).toBe(400);
  });
});
