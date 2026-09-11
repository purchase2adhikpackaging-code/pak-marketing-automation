import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  join(process.cwd(), "supabase/functions/generate-content/index.ts"),
  "utf8",
);

describe("background publishing provider security", () => {
  it("requires a server-only worker secret for internal production calls", () => {
    expect(source).toContain('Deno.env.get("PUBLISHING_WORKER_SECRET")');
    expect(source).toContain('req.headers.get("x-publishing-worker-secret")');
    expect(source).toMatch(/productionJobId/);
  });

  it("validates the persisted production job and run before provider access", () => {
    expect(source).toContain('from("publishing_production_jobs")');
    expect(source).toContain('from("publishing_production_runs")');
    expect(source).toContain("created_by");
    expect(source).toContain("organization_memberships");
    expect(source).toMatch(/RUNNING/);
  });

  it("continues to resolve OpenAI only from the integration Vault", () => {
    expect(source).toContain('admin.rpc("read_integration_vault_secret", {');
    expect(source).not.toMatch(/body\.(?:apiKey|openaiKey|serviceRole)/);
  });
});
