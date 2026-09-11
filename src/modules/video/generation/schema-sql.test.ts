import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = join(
  process.cwd(),
  "supabase/migrations/202609110008_video_generation_attempts.sql",
);

const sql = readFileSync(migrationPath, "utf8");

describe("Phase 7 video generation attempt schema", () => {
  it("creates organization-scoped provider execution lineage with RLS", () => {
    expect(sql).toContain("create table if not exists public.video_generation_attempts");
    expect(sql).toContain("organization_id uuid not null references public.organizations(id) on delete cascade");
    expect(sql).toContain("job_id uuid not null references public.jobs(id)");
    expect(sql).toContain("plan_version_id uuid not null references public.scene_plan_versions(id)");
    expect(sql).toContain("scene_id uuid not null references public.scene_plan_scenes(id)");
    expect(sql).toContain("shot_id uuid not null references public.scene_plan_shots(id)");
    expect(sql).toContain("media_asset_id uuid references public.media_assets(id)");
    expect(sql).toContain("alter table public.video_generation_attempts enable row level security");
    expect(sql).toContain("public.is_org_member(organization_id)");
  });

  it("uses normalized provider execution states and durable provider job lineage", () => {
    for (const state of [
      "QUEUED",
      "SUBMITTING",
      "SUBMITTED",
      "PROCESSING",
      "IMPORT_PENDING",
      "COMPLETED",
      "FAILED",
      "CANCELLED",
      "SUBMISSION_UNKNOWN",
    ]) {
      expect(sql).toContain(`'${state}'`);
    }
    expect(sql).toContain("provider_job_id text");
    expect(sql).toMatch(/unique index[\s\S]*provider[\s\S]*provider_job_id/i);
    expect(sql).toContain("where provider_job_id is not null");
  });

  it("indexes all foreign keys and the organization polling path", () => {
    expect(sql).toContain("video_generation_attempts_job_id_idx");
    expect(sql).toContain("video_generation_attempts_plan_version_id_idx");
    expect(sql).toContain("video_generation_attempts_scene_id_idx");
    expect(sql).toContain("video_generation_attempts_shot_id_idx");
    expect(sql).toContain("video_generation_attempts_media_asset_id_idx");
    expect(sql).toContain("video_generation_attempts_org_state_idx");
  });

  it("enforces the organization and approved plan/scene/shot parent chain", () => {
    expect(sql).toContain("create or replace function public.enforce_video_generation_attempt_parentage()");
    expect(sql).toContain("v_plan_status <> 'APPROVED'");
    expect(sql).toContain("s.scene_plan_version_id = new.plan_version_id");
    expect(sql).toContain("sh.scene_id = new.scene_id");
    expect(sql).toContain("j.organization_id = new.organization_id");
  });

  it("never persists provider credentials or ephemeral provider output URLs", () => {
    expect(sql).not.toMatch(/api[_ ]?key/i);
    expect(sql).not.toMatch(/access[_ ]?token/i);
    expect(sql).not.toMatch(/authorization/i);
    expect(sql).not.toMatch(/output[_ ]?url/i);
    expect(sql).not.toMatch(/signed[_ ]?url/i);
  });
});
