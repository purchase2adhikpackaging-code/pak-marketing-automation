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

  it("blocks REVIEW_REQUIRED transitions without current QC evidence while allowing fresh-draft QC promotion", () => {
    expect(sql).toContain("new.status = 'REVIEW_REQUIRED'");
    expect(sql).toContain("new.narration_coverage_hash is null");
    expect(sql).toContain("scene plan must pass current QC before review");
    expect(sql).toContain("old.status not in ('DRAFT','QC_REQUIRED')");
  });

  it("blocks review and approval transitions while blocker findings remain", () => {
    expect(sql).toContain("scene_plan_qc_findings");
    expect(sql).toContain("severity = 'BLOCKER'");
    expect(sql).toContain("scene plan must resolve blocker findings before review");
    expect(sql).toContain("scene plan must resolve blocker findings before approval");
  });

  it("allows REVIEWER status updates only for a scoped REVIEW_REQUIRED to APPROVED transition", () => {
    expect(sql).toContain("create policy scene_plan_versions_update_reviewer");
    expect(sql).toContain("array['REVIEWER']");
    expect(sql).toContain("array['OWNER','ADMIN','REVIEWER']");
    expect(sql).toContain("old.status <> 'REVIEW_REQUIRED'");
    expect(sql).toContain("new.status <> 'APPROVED'");
    expect(sql).toContain("reviewers may only approve a review-ready scene plan");
  });

  it("binds approval identity to the authenticated reviewer", () => {
    expect(sql).toContain("new.approved_by is distinct from auth.uid()");
    expect(sql).toContain("new.approved_at is null");
  });

  it("uses normal invoker identity and does not widen provider capability", () => {
    expect(sql).toContain("security invoker");
    expect(sql).not.toMatch(/security definer/i);
    expect(sql).not.toMatch(/service_role/i);
    expect(sql).not.toMatch(/provider_job_id/i);
  });
});
