import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = join(
  process.cwd(),
  "supabase/migrations/202609110006_scene_plan_review_qc_guard.sql",
);
const sql = existsSync(migrationPath) ? readFileSync(migrationPath, "utf8") : "";

describe("Scene Planning review QC transition SQL", () => {
  it("ships the database guard migration", () => {
    expect(existsSync(migrationPath)).toBe(true);
  });

  it("blocks REVIEW_REQUIRED transitions without current QC evidence", () => {
    expect(sql).toContain("new.status = 'REVIEW_REQUIRED'");
    expect(sql).toContain("new.narration_coverage_hash is null");
    expect(sql).toContain("scene plan must pass current QC before review");
  });

  it("blocks review transitions while blocker findings remain", () => {
    expect(sql).toContain("scene_plan_qc_findings");
    expect(sql).toContain("severity = 'BLOCKER'");
  });

  it("uses normal invoker identity and does not widen provider capability", () => {
    expect(sql).toContain("security invoker");
    expect(sql).not.toMatch(/security definer/i);
    expect(sql).not.toMatch(/service_role/i);
    expect(sql).not.toMatch(/provider_job_id/i);
  });
});
