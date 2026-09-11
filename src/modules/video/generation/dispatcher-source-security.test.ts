import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const dispatcherPath = join(
  process.cwd(),
  "supabase/functions/video-generation-dispatcher/index.ts",
);
const migrationPath = join(
  process.cwd(),
  "supabase/migrations/202609110012_video_generation_dispatch.sql",
);

describe("unattended video generation dispatcher", () => {
  it("accepts no caller-supplied organization/job/attempt selection", () => {
    const source = readFileSync(dispatcherPath, "utf8");
    expect(source).toContain('Deno.env.get("VIDEO_GENERATION_DISPATCHER_SECRET")');
    expect(source).toContain('req.headers.get("x-pak-dispatch-token")');
    expect(source).not.toMatch(/organizationId\?:|jobId\?:|attemptId\?:/);
    expect(source).not.toMatch(/await req\.json\(\)/);
  });

  it("claims a bounded batch from a service-role-only database RPC", () => {
    const source = readFileSync(dispatcherPath, "utf8");
    expect(source).toContain('rpc("claim_due_video_generation_dispatch"');
    expect(source).toContain("DISPATCH_BATCH_SIZE");
    expect(source).toContain("Math.min");
    expect(source).toContain("20");
  });

  it("uses atomic skip-locked leases for due reconciliation and retry work", () => {
    const sql = readFileSync(migrationPath, "utf8");
    expect(sql).toContain("create or replace function public.claim_due_video_generation_dispatch(");
    expect(sql).toContain("security definer");
    expect(sql).toContain("for update skip locked");
    expect(sql).toContain("lease_owner");
    expect(sql).toContain("lease_expires_at");
    for (const state of ["SUBMITTED", "PROCESSING", "IMPORT_PENDING", "FAILED"]) {
      expect(sql).toContain(`'${state}'`);
    }
    expect(sql).toContain("retryable is true");
    expect(sql).toContain("attempt_number < 4");
  });

  it("keeps dispatcher claims service-role-only and releases leases after each item", () => {
    const sql = readFileSync(migrationPath, "utf8");
    const source = readFileSync(dispatcherPath, "utf8");
    expect(sql).toContain("revoke all on function public.claim_due_video_generation_dispatch");
    expect(sql).toContain("grant execute on function public.claim_due_video_generation_dispatch");
    expect(sql).toContain("to service_role");
    expect(source).toContain('lease_owner: null');
    expect(source).toContain('lease_expires_at: null');
  });

  it("dispatches only internal submit/reconcile/retry operations without returning provider payloads", () => {
    const source = readFileSync(dispatcherPath, "utf8");
    expect(source).toContain('operation: "reconcile"');
    expect(source).toContain('operation: "retry"');
    expect(source).toContain('operation: "submit"');
    expect(source).toContain('"x-pak-dispatch-token": dispatchSecret');
    expect(source).not.toMatch(/video_url|provider_url|api[_-]?key/i);
  });
});
