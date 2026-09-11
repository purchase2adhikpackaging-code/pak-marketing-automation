import { describe, expect, it } from "vitest";
import { handlePublishingWorkerRequest } from "@/modules/publishing-production/node-worker-route";

describe("publishing worker route security", () => {
  it("rejects missing or invalid bearer secret", async () => {
    const run = async () => ({ claimed: 0, yielded: 0, completed: 0, failed: 0 });
    const missing = await handlePublishingWorkerRequest(
      new Request("https://example.test/api/internal/publishing-worker", { method: "POST", body: "{}" }),
      { secret: "cron-secret", run },
    );
    expect(missing.status).toBe(401);

    const invalid = await handlePublishingWorkerRequest(
      new Request("https://example.test/api/internal/publishing-worker", {
        method: "POST",
        headers: { authorization: "Bearer wrong" },
        body: "{}",
      }),
      { secret: "cron-secret", run },
    );
    expect(invalid.status).toBe(401);
  });

  it("rejects credential-like request payload fields", async () => {
    const response = await handlePublishingWorkerRequest(
      new Request("https://example.test/api/internal/publishing-worker", {
        method: "POST",
        headers: { authorization: "Bearer cron-secret", "content-type": "application/json" },
        body: JSON.stringify({ apiKey: "do-not-accept" }),
      }),
      { secret: "cron-secret", run: async () => ({ claimed: 0, yielded: 0, completed: 0, failed: 0 }) },
    );
    expect(response.status).toBe(400);
  });

  it("runs a single bounded batch with default concurrency four", async () => {
    let received: { concurrency?: number; workerId: string } | undefined;
    const response = await handlePublishingWorkerRequest(
      new Request("https://example.test/api/internal/publishing-worker", {
        method: "POST",
        headers: { authorization: "Bearer cron-secret", "content-type": "application/json" },
        body: JSON.stringify({}),
      }),
      {
        secret: "cron-secret",
        run: async (input) => {
          received = input;
          return { claimed: 0, yielded: 0, completed: 0, failed: 0 };
        },
      },
    );
    expect(response.status).toBe(200);
    expect(received?.concurrency).toBe(4);
    expect(received?.workerId).toMatch(/^vercel-/);
  });

  it("rejects concurrency outside the governed range", async () => {
    const response = await handlePublishingWorkerRequest(
      new Request("https://example.test/api/internal/publishing-worker", {
        method: "POST",
        headers: { authorization: "Bearer cron-secret", "content-type": "application/json" },
        body: JSON.stringify({ concurrency: 33 }),
      }),
      { secret: "cron-secret", run: async () => ({ claimed: 0, yielded: 0, completed: 0, failed: 0 }) },
    );
    expect(response.status).toBe(400);
  });
});
