import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function latestClaimFunctionSql(): string {
  const migrationsDir = join(process.cwd(), "supabase/migrations");
  const sql = readdirSync(migrationsDir)
    .filter((name) => name.startsWith("20260912") && name.endsWith(".sql"))
    .sort()
    .map((name) => readFileSync(join(migrationsDir, name), "utf8"))
    .join("\n");

  const marker = "create or replace function public.claim_video_assembly_work";
  const start = sql.lastIndexOf(marker);
  expect(start).toBeGreaterThanOrEqual(0);
  const tail = sql.slice(start);
  const end = tail.indexOf("grant execute on function public.claim_video_assembly_work");
  expect(end).toBeGreaterThan(0);
  return tail.slice(0, end).replace(/\s+/g, " ").toLowerCase();
}

describe("Phase 8 assembly worker claim SQL", () => {
  it("qualifies the jobs update so RETURNS TABLE organization_id cannot shadow the column", () => {
    const sql = latestClaimFunctionSql();

    expect(sql).toContain("update public.jobs as j set state = 'processing'");
    expect(sql).toContain("attempt_count = j.attempt_count + 1");
    expect(sql).toContain("started_at = coalesce(j.started_at, now())");
    expect(sql).toContain("where j.id = v_job.id and j.organization_id = v_job.organization_id");
    expect(sql).not.toContain("where id = v_job.id and organization_id = v_job.organization_id");
  });
});
