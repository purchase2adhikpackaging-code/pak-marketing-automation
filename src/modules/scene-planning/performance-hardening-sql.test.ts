import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = join(
  process.cwd(),
  "supabase/migrations/202609110007_scene_plan_performance_hardening.sql",
);
const sql = existsSync(migrationPath) ? readFileSync(migrationPath, "utf8") : "";

describe("Scene Planning database performance hardening", () => {
  it("ships a dedicated hardening migration", () => {
    expect(existsSync(migrationPath)).toBe(true);
  });

  it("removes the redundant reviewer update policy while retaining the role-constrained shared policy", () => {
    expect(sql).toContain("drop policy if exists scene_plan_versions_update_reviewer");
    expect(sql).toContain("create policy scene_plan_versions_update_editor");
    expect(sql).toContain("array['OWNER','ADMIN','EDITOR','REVIEWER']");
  });

  it("uses init-plan-safe auth.uid checks in Phase 6 insert policies", () => {
    expect(sql).toContain("created_by is null or created_by = (select auth.uid())");
    expect(sql).not.toMatch(/created_by\s*=\s*auth\.uid\(\)/);
  });

  it("adds covering indexes for Phase 6 foreign-key access paths reported by the database advisor", () => {
    for (const indexName of [
      "video_projects_source_content_id_idx",
      "video_projects_source_artifact_id_only_idx",
      "video_projects_created_by_idx",
      "visual_bibles_created_by_idx",
      "scene_plan_versions_parent_version_id_idx",
      "scene_plan_versions_created_by_idx",
      "scene_plan_versions_approved_by_idx",
      "scene_plan_qc_version_id_idx",
      "scene_plan_qc_scene_id_idx",
      "scene_plan_qc_shot_id_idx",
      "scene_plan_qc_acknowledged_by_idx",
    ]) {
      expect(sql).toContain(indexName);
    }
  });
});
