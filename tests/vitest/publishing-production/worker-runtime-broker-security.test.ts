import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const runtime = readFileSync(
  join(process.cwd(), "src/modules/publishing-production/node-worker-runtime.ts"),
  "utf8",
);
const route = readFileSync(
  join(process.cwd(), "src/app/api/internal/publishing-worker/route.ts"),
  "utf8",
);

describe("publishing worker runtime broker boundary", () => {
  it("does not require or resolve a Supabase service-role credential in Vercel", () => {
    expect(runtime).not.toContain('required("SUPABASE_SERVICE_ROLE_KEY")');
    expect(runtime).not.toContain("resolvePublishingWorkerSecret");
    expect(runtime).not.toContain("workerTransport(admin)");
    expect(runtime).not.toContain('.from("publishing_publications")');
  });

  it("constructs privileged worker operations through the broker client using the invocation credential", () => {
    expect(runtime).toContain("createPublishingWorkerBrokerClient");
    expect(runtime).toContain("credential: input.credential");
    expect(runtime).toContain("broker.claimJobs");
    expect(runtime).toContain("broker.yieldJob");
    expect(runtime).toContain("broker.completeJob");
    expect(runtime).toContain("broker.failJob");
  });

  it("passes the invocation credential directly to secured OpenAI generation", () => {
    expect(runtime).toMatch(/internalOpenAITransport\(job,\s*credential\)/);
    expect(runtime).toContain('"x-publishing-worker-secret": credential');
    expect(runtime).not.toContain("PUBLISHING_WORKER_SECRET");
  });

  it("uses broker-authorized signed storage access for checkpoints and publication artifacts", () => {
    expect(runtime).toContain("broker.listCheckpointFiles");
    expect(runtime).toContain("broker.createCheckpointDownload");
    expect(runtime).toContain("broker.createStorageUpload");
    expect(runtime).toContain("uploadToSignedUrl");
  });

  it("requires the opaque credential on configured worker execution and forwards it from the route", () => {
    expect(runtime).toMatch(/runConfiguredPublishingWorker\(input:\s*\{[\s\S]*credential:\s*string/);
    expect(route).toMatch(/run:\s*\(\{\s*workerId,\s*concurrency,\s*credential\s*\}\)/);
    expect(route).toContain("credential,");
  });
});
