import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  join(process.cwd(), "supabase/functions/generate-publishing-visual/index.ts"),
  "utf8",
);
const deployment = JSON.parse(
  readFileSync(
    join(process.cwd(), "supabase/functions/generate-publishing-visual/deployment.json"),
    "utf8",
  ),
) as { verify_jwt?: unknown; auth_contract?: unknown };

const workerSource = readFileSync(
  join(process.cwd(), "src/modules/publishing-production/node-worker-runtime.ts"),
  "utf8",
);

describe("background publishing visual provider security", () => {
  it("keeps the OpenAI API key inside Supabase Vault and authenticates with the opaque worker capability", () => {
    expect(source).toMatch(/read_publishing_worker_dispatch_secret/);
    expect(source).toContain('req.headers.get("x-publishing-worker-secret")');
    expect(source).toContain('admin.rpc("read_integration_vault_secret"');
    expect(source).not.toMatch(/body\.(?:apiKey|openaiKey|serviceRole)/);
    expect(source).not.toContain('Deno.env.get("OPENAI_API_KEY")');
  });

  it("binds every visual request to the active production job and organization", () => {
    expect(source).toContain('from("publishing_production_jobs")');
    expect(source).toContain('from("publishing_production_runs")');
    expect(source).toContain('organization_memberships');
    expect(source).toMatch(/RUNNING/);
  });

  it("uses the current GPT Image endpoint with explicit print-quality output controls", () => {
    expect(source).toContain('https://api.openai.com/v1/images/generations');
    expect(source).toContain('gpt-image-2.5-sunburst');
    expect(source).toContain('output_format: "jpeg"');
    expect(source).toContain('quality: "high"');
    expect(source).toContain('size: requestedSize');
  });

  it("uses handler-enforced authentication and never adds OpenAI/service-role credentials to Vercel", () => {
    expect(deployment.verify_jwt).toBe(false);
    expect(deployment.auth_contract).toBe("handler-enforced-publishing-worker-only");
    expect(workerSource).toContain('/functions/v1/generate-publishing-visual');
    expect(workerSource).toContain('x-publishing-worker-secret');
    expect(workerSource).not.toContain('SUPABASE_SERVICE_ROLE_KEY');
    expect(workerSource).not.toContain('OPENAI_API_KEY');
  });
});
