import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { FINAL_RENDER_PROFILES, VIDEO_ASSEMBLY_STATES } from "./types";

const migrationPath = join(
  process.cwd(),
  "supabase/migrations/202609120002_video_assembly_schema.sql",
);

describe("Phase 8 final video assembly schema", () => {
  it("defines stable domain state and render profile enums", () => {
    expect(VIDEO_ASSEMBLY_STATES).toEqual(["QUEUED", "PROCESSING", "COMPLETED", "FAILED", "CANCELLED"]);
    expect(FINAL_RENDER_PROFILES).toEqual(["PAK_MASTER_1080P_V1"]);
  });

  it("creates organization-scoped assembly and immutable component lineage", () => {
    const sql = readFileSync(migrationPath, "utf8");

    expect(sql).toContain("create table if not exists public.video_assemblies");
    expect(sql).toContain("create table if not exists public.video_assembly_components");
    expect(sql).toContain("plan_version_id uuid not null references public.scene_plan_versions(id)");
    expect(sql).toContain("job_id uuid not null references public.jobs(id)");
    expect(sql).toContain("final_media_asset_id uuid references public.media_assets(id)");
    expect(sql).toContain("render_profile text not null");
    expect(sql).toContain("'PAK_MASTER_1080P_V1'");
    expect(sql).toMatch(/state text not null[\s\S]*'QUEUED'[\s\S]*'PROCESSING'[\s\S]*'COMPLETED'[\s\S]*'FAILED'[\s\S]*'CANCELLED'/);
    expect(sql).toContain("unique (assembly_id, shot_id)");
    expect(sql).toContain("unique (assembly_id, ordinal)");
  });

  it("enforces same-organization parentage and immutable component snapshots", () => {
    const sql = readFileSync(migrationPath, "utf8");

    expect(sql).toContain("enforce_video_assembly_parentage");
    expect(sql).toContain("video assembly organization mismatch");
    expect(sql).toContain("video assembly component lineage mismatch");
    expect(sql).toContain("video assembly component snapshot is immutable");
    expect(sql).toContain("completed video assembly requires final media asset");
  });

  it("allows authenticated same-org read without browser execution mutation policies", () => {
    const sql = readFileSync(migrationPath, "utf8");

    expect(sql).toContain("alter table public.video_assemblies enable row level security");
    expect(sql).toContain("alter table public.video_assembly_components enable row level security");
    expect(sql).toContain("video_assemblies_select_member");
    expect(sql).toContain("video_assembly_components_select_member");
    expect(sql).not.toContain("video_assemblies_insert_editor");
    expect(sql).not.toContain("video_assemblies_update_editor");
    expect(sql).not.toContain("video_assembly_components_insert_editor");
  });
});
