import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = join(
  process.cwd(),
  "supabase/migrations/202609110001_scene_planning.sql",
);

const sql = readFileSync(migrationPath, "utf8");

const expectedTables = [
  "video_projects",
  "visual_bibles",
  "scene_plan_versions",
  "scene_plan_scenes",
  "scene_plan_shots",
  "scene_plan_qc_findings",
] as const;

describe("Scene Planning persistence SQL", () => {
  it("creates all organization-scoped Phase 6 tables", () => {
    for (const table of expectedTables) {
      expect(sql).toContain(`create table if not exists public.${table}`);
      expect(sql).toContain(`alter table public.${table} enable row level security`);
    }

    expect(sql).toContain("organization_id uuid not null references public.organizations(id) on delete cascade");
  });

  it("keeps read/write access behind established organization membership helpers", () => {
    expect(sql).toContain("public.is_org_member(organization_id)");
    expect(sql).toContain("public.has_org_role(organization_id, array['OWNER','ADMIN','EDITOR'])");
    expect(sql).toContain("public.has_org_role(organization_id, array['OWNER','ADMIN'])");
  });

  it("enforces unique versions and ordered scenes/shots", () => {
    expect(sql).toContain("unique (video_project_id, version_number)");
    expect(sql).toContain("unique (scene_plan_version_id, ordinal)");
    expect(sql).toContain("unique (scene_id, ordinal)");
    expect(sql).toContain("check (version_number >= 1)");
    expect(sql).toContain("check (ordinal >= 1)");
  });

  it("enforces approved-version immutability without exposing a privileged browser mutation function", () => {
    expect(sql).toContain("create or replace function public.enforce_scene_plan_approved_immutability()");
    expect(sql).toContain("raise exception 'approved scene plan versions are immutable'");
    expect(sql).toContain("revoke all on function public.enforce_scene_plan_approved_immutability() from authenticated");
    expect(sql).not.toContain("security definer");
  });

  it("contains no provider execution fields in the Phase 6 domain schema", () => {
    expect(sql).not.toMatch(/ltx_job_id/i);
    expect(sql).not.toMatch(/provider_job_id/i);
    expect(sql).not.toMatch(/provider_url/i);
  });
});
