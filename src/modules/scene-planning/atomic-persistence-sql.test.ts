import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  join(process.cwd(), "supabase/migrations/202609110002_scene_planning_atomic_persistence.sql"),
  "utf8",
);

describe("Scene Planning atomic persistence SQL", () => {
  it("persists complete scene-plan graphs in one security-invoker transaction", () => {
    expect(sql).toContain("create or replace function public.persist_scene_plan_draft(");
    expect(sql).toContain("security invoker");
    expect(sql).toContain("insert into public.scene_plan_versions");
    expect(sql).toContain("insert into public.scene_plan_scenes");
    expect(sql).toContain("insert into public.scene_plan_shots");
  });

  it("requires the authenticated actor to have the established editor role", () => {
    expect(sql).toContain("public.has_org_role(_organization_id, array['OWNER','ADMIN','EDITOR'])");
    expect(sql).toContain("auth.uid() is null");
  });

  it("supports atomic copy-on-write cloning", () => {
    expect(sql).toContain("create or replace function public.clone_scene_plan_version(");
    expect(sql).toContain("parent_version_id");
    expect(sql).toContain("'DRAFT'");
  });

  it("lets REVIEWER approve only through a constrained REVIEW_REQUIRED -> APPROVED update", () => {
    expect(sql).toContain("array['OWNER','ADMIN','EDITOR','REVIEWER']");
    expect(sql).toContain("reviewers may only approve review-ready scene plans");
    expect(sql).toContain("new.approved_by = auth.uid()");
  });

  it("does not grant any provider execution capability", () => {
    expect(sql).not.toMatch(/ltx/i);
    expect(sql).not.toMatch(/provider_job_id/i);
  });
});
