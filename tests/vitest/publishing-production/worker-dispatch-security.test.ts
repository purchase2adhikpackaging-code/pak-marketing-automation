import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = join(
  process.cwd(),
  "supabase/migrations/202609120004_publishing_worker_dispatch.sql",
);
const authHelperPath = join(
  process.cwd(),
  "src/modules/publishing-production/worker-auth.ts",
);
const routePath = join(
  process.cwd(),
  "src/app/api/internal/publishing-worker/route.ts",
);
const actionsPath = join(
  process.cwd(),
  "src/app/(app)/publishing/production/actions.ts",
);
const runtimePath = join(
  process.cwd(),
  "src/modules/publishing-production/node-worker-runtime.ts",
);
const edgePath = join(
  process.cwd(),
  "supabase/functions/generate-content/index.ts",
);

function source(path: string): string {
  expect(existsSync(path)).toBe(true);
  return readFileSync(path, "utf8");
}

describe("publishing worker dispatch secret and recovery contract", () => {
  it("generates the worker dispatch credential inside Supabase Vault and exposes it only to service_role", () => {
    const sql = source(migrationPath);

    expect(sql).toContain("vault.create_secret");
    expect(sql).toContain("pak/publishing/worker-dispatch");
    expect(sql).toMatch(/create or replace function\s+public\.read_publishing_worker_dispatch_secret\(\)/i);
    expect(sql).toMatch(/revoke all on function\s+public\.read_publishing_worker_dispatch_secret\(\)\s+from authenticated/i);
    expect(sql).toMatch(/grant execute on function\s+public\.read_publishing_worker_dispatch_secret\(\)\s+to service_role/i);
  });

  it("installs minute-level Supabase recovery dispatch through pg_cron and pg_net", () => {
    const sql = source(migrationPath);

    expect(sql).toMatch(/create extension if not exists pg_cron/i);
    expect(sql).toMatch(/create extension if not exists pg_net/i);
    expect(sql).toMatch(/create or replace function\s+public\.install_publishing_worker_recovery/i);
    expect(sql).toContain("pak-publishing-worker-recovery");
    expect(sql).toContain("net.http_post");
    expect(sql).toContain("Authorization");
    expect(sql).toContain("Bearer ");
    expect(sql).toMatch(/'\* \* \* \* \*'/);
  });

  it("resolves the dispatch secret server-side instead of requiring a Vercel worker-secret env var", () => {
    const helper = source(authHelperPath);
    const route = source(routePath);
    const actions = source(actionsPath);
    const runtime = source(runtimePath);

    expect(helper).toContain("read_publishing_worker_dispatch_secret");
    expect(helper).toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(route).toContain("resolvePublishingWorkerSecret");
    expect(actions).toContain("resolvePublishingWorkerSecret");
    expect(runtime).toContain("resolvePublishingWorkerSecret");
    expect(runtime).not.toContain('required("PUBLISHING_WORKER_SECRET")');
  });

  it("lets the Edge generation function resolve the same Vault credential through a service-role RPC", () => {
    const edge = source(edgePath);

    expect(edge).toContain('admin.rpc("read_publishing_worker_dispatch_secret")');
    expect(edge).not.toContain('Deno.env.get("PUBLISHING_WORKER_SECRET")');
    expect(edge).toContain('req.headers.get("x-publishing-worker-secret")');
  });
});
