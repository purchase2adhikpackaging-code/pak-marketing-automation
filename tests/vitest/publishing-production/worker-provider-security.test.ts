import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  join(process.cwd(), "supabase/functions/generate-content/index.ts"),
  "utf8",
);
const deployment = JSON.parse(
  readFileSync(
    join(process.cwd(), "supabase/functions/generate-content/deployment.json"),
    "utf8",
  ),
) as { verify_jwt?: unknown; auth_contract?: unknown };

describe("background publishing provider security", () => {
  it("requires the service-role Vault worker credential for internal production calls", () => {
    expect(source).toMatch(/admin\.rpc\(\s*["']read_publishing_worker_dispatch_secret["']/);
    expect(source).not.toContain('Deno.env.get("PUBLISHING_WORKER_SECRET")');
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

  it("uses handler-enforced auth so worker capability requests reach the function", () => {
    expect(deployment.verify_jwt).toBe(false);
    expect(deployment.auth_contract).toBe("handler-enforced");
    expect(source).toContain('req.headers.get("x-publishing-worker-secret")');
    expect(source).toContain("admin.auth.getUser(token)");
  });
});
