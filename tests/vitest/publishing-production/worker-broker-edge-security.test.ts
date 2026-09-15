import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const edgePath = join(
  process.cwd(),
  "supabase/functions/publishing-worker-broker/index.ts",
);
const vaultRetryMigrationPath = join(
  process.cwd(),
  "supabase/migrations/202609140001_publishing_worker_vault_read_retry.sql",
);

function source(): string {
  expect(existsSync(edgePath)).toBe(true);
  return readFileSync(edgePath, "utf8");
}

describe("publishing worker broker Edge security boundary", () => {
  it("authenticates the dedicated worker capability against the Vault-backed dispatch secret", () => {
    const edge = source();
    expect(edge).toContain('Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")');
    expect(edge).toMatch(/admin\.rpc\(\s*["']read_publishing_worker_dispatch_secret["']/);
    expect(edge).toContain('req.headers.get("x-publishing-worker-secret")');
    expect(edge).not.toContain('Deno.env.get("PUBLISHING_WORKER_SECRET")');
  });

  it("uses a bounded shared Vault retry at the dispatch-secret RPC boundary", () => {
    expect(existsSync(vaultRetryMigrationPath)).toBe(true);
    const sql = readFileSync(vaultRetryMigrationPath, "utf8");
    expect(sql).toContain("read_publishing_worker_dispatch_secret");
    expect(sql).toContain("for v_attempt in 1..5 loop");
    expect(sql).toContain("pg_sleep");
    expect(sql).toContain("security definer");
    expect(sql).toContain("grant execute on function public.read_publishing_worker_dispatch_secret() to service_role");
    expect(sql).toContain("revoke all on function public.read_publishing_worker_dispatch_secret() from anon");
    expect(sql).toContain("revoke all on function public.read_publishing_worker_dispatch_secret() from authenticated");
  });

  it("uses an explicit broker action allow-list instead of accepting arbitrary RPC or table names", () => {
    const edge = source();
    for (const action of [
      "authorize",
      "claimJobs",
      "yieldJob",
      "completeJob",
      "failJob",
      "listCheckpointFiles",
      "createCheckpointDownload",
      "createStorageUpload",
      "upsertPublication",
      "listAutomationTargets",
      "bootstrapPortfolio",
    ]) {
      expect(edge).toContain(`"${action}"`);
    }
    expect(edge).toContain("ALLOWED_ACTIONS");
    expect(edge).not.toMatch(/admin\.rpc\(\s*body\./);
    expect(edge).not.toMatch(/admin\.from\(\s*body\./);
    expect(edge).not.toMatch(/storage\.from\(\s*body\./);
  });

  it("restricts automatic portfolio bootstrap to approved settings and the dedicated RPC", () => {
    const edge = source();
    expect(edge).toContain('from("publishing_automation_settings")');
    expect(edge).toContain('.eq("enabled", true)');
    expect(edge).toContain('.not("pilot_approved_at", "is", null)');
    expect(edge).toContain('admin.rpc("bootstrap_publishing_auto_portfolio"');
    expect(edge).toContain("_organization_id: organizationId");
    expect(edge).toContain("_idempotency_key: idempotencyKey");
    expect(edge).toContain("_jobs: jobs");
  });

  it("restricts privileged queue operations to the existing publishing RPC contract", () => {
    const edge = source();
    for (const rpc of [
      "claim_publishing_jobs",
      "yield_publishing_job",
      "complete_publishing_job",
      "fail_publishing_job",
    ]) {
      expect(edge).toContain(`"${rpc}"`);
    }
  });

  it("restricts storage to the private publishing bucket and canonical leased-job paths", () => {
    const edge = source();
    expect(edge).toContain('const BUCKET = "publishing-books"');
    expect(edge).toContain("loadLeasedJob");
    expect(edge).toContain("canonicalJobPrefix");
    expect(edge).toContain("validateCheckpointPath");
    expect(edge).toContain("validatePublicationPath");
    expect(edge).toContain("createSignedUrl");
    expect(edge).toContain("createSignedUploadUrl");
  });

  it("constructs the Book Library record from the leased job identity instead of trusting caller identity fields", () => {
    const edge = source();
    expect(edge).toContain('from("publishing_publications")');
    expect(edge).toContain("production_run_id: job.production_run_id");
    expect(edge).toContain("organization_id: job.organization_id");
    expect(edge).toContain("book_id: job.book_id");
    expect(edge).toContain("programme_code: job.programme_code");
    expect(edge).toContain("subject_code: job.subject_code");
    expect(edge).toContain("edition: job.edition");
    expect(edge).toContain("revision: job.revision");
  });

  it("never returns the Vault worker secret in a response payload", () => {
    const edge = source();
    expect(edge).toContain('return json(200, { ok: true })');
    expect(edge).not.toMatch(/json\([^\n]*publishingWorkerSecret/);
    expect(edge).not.toMatch(/JSON\.stringify\([^\n]*publishingWorkerSecret/);
  });
});
