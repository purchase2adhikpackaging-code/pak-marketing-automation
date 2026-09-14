import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const runtimeSource = readFileSync(
  join(process.cwd(), "src/modules/publishing-production/node-worker-runtime.ts"),
  "utf8",
);
const automaticRuntimeSource = readFileSync(
  join(process.cwd(), "src/modules/publishing-production/auto-worker-runtime.ts"),
  "utf8",
);
const routeSource = readFileSync(
  join(process.cwd(), "src/app/api/internal/publishing-worker/route.ts"),
  "utf8",
);

describe("publishing worker runtime privilege boundary", () => {
  it("never resolves or embeds a Supabase service-role credential in the Vercel worker runtime", () => {
    expect(runtimeSource).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(automaticRuntimeSource).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(runtimeSource).not.toContain("resolvePublishingWorkerSecret");
    expect(automaticRuntimeSource).not.toContain("resolvePublishingWorkerSecret");
    expect(runtimeSource).not.toContain('from "./worker-auth"');
    expect(automaticRuntimeSource).not.toContain('from "./worker-auth"');
  });

  it("uses the broker client for privileged queue and artifact operations", () => {
    expect(runtimeSource).toContain("createPublishingWorkerBrokerClient");
    expect(runtimeSource).toContain("claimJobs");
    expect(runtimeSource).toContain("createCheckpointDownload");
    expect(runtimeSource).toContain("createStorageUpload");
    expect(runtimeSource).toContain("upsertPublication");
  });

  it("propagates the already-authorized opaque worker capability through the automatic wrapper into the runtime", () => {
    expect(routeSource).toMatch(/runConfiguredAutomaticPublishingWorker\(\{[\s\S]*credential/);
    expect(automaticRuntimeSource).toMatch(/runConfiguredPublishingWorker\(\{[\s\S]*credential:\s*input\.credential/);
    expect(runtimeSource).toMatch(/runConfiguredPublishingWorker\(input:\s*\{[\s\S]*credential:\s*string/);
  });
});
