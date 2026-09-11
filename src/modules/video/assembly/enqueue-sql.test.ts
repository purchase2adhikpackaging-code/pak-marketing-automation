import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = join(
  process.cwd(),
  "supabase/migrations/202609120003_video_assembly_enqueue.sql",
);

function sql(): string {
  return readFileSync(migrationPath, "utf8");
}

describe("final video assembly enqueue SQL", () => {
  it("uses one authenticated privileged RPC and accepts identifiers/profile only", () => {
    const source = sql();
    expect(source).toContain("create or replace function public.enqueue_final_video_assembly(");
    expect(source).toContain("security definer");
    expect(source).toContain("set search_path = public, extensions");
    expect(source).toContain("v_actor_user_id uuid := auth.uid()");
    expect(source).toContain("public.has_org_role(_organization_id, array['OWNER','ADMIN','EDITOR'])");

    const signature = source.slice(
      source.indexOf("create or replace function public.enqueue_final_video_assembly("),
      source.indexOf("returns jsonb"),
    );
    expect(signature).toContain("_organization_id uuid");
    expect(signature).toContain("_plan_version_id uuid");
    expect(signature).toContain("_profile text default 'PAK_MASTER_1080P_V1'");
    expect(signature).not.toMatch(/media_asset/i);
    expect(signature).not.toMatch(/checksum/i);
    expect(signature).not.toMatch(/storage_path/i);
  });

  it("revalidates approved/current/blocker-free plan state", () => {
    const source = sql();
    expect(source).toContain("v_plan_status <> 'APPROVED'");
    expect(source).toContain("content_script_artifacts");
    expect(source).toContain("source_integrity_hash");
    expect(source).toContain("scene_plan_qc_findings");
    expect(source).toContain("severity = 'BLOCKER'");
    expect(source).toContain("decode('00', 'hex')");
  });

  it("derives every required shot and completed active video media inside the transaction", () => {
    const source = sql();
    expect(source).toContain("scene_plan_scenes");
    expect(source).toContain("scene_plan_shots");
    expect(source).toContain("video_generation_attempts");
    expect(source).toContain("media_assets");
    expect(source).toContain("a.state = 'COMPLETED'");
    expect(source).toContain("m.asset_type = 'VIDEO'");
    expect(source).toContain("m.status = 'ACTIVE'");
    expect(source).toContain("m.storage_bucket");
    expect(source).toContain("m.storage_path");
    expect(source).toContain("m.checksum");
    expect(source).toContain("m.duration_seconds");
    expect(source).toMatch(/order by\s+s\.ordinal\s*,\s*sh\.ordinal/i);
  });

  it("uses the same stable NUL-delimited hash inputs as the Node domain helper", () => {
    const source = sql();
    expect(source).toContain("'final-assembly-v1'");
    expect(source).toContain("decode('00', 'hex')");
    expect(source).toMatch(/round\([^)]*duration_seconds[^)]*\*\s*1000\)/i);
    expect(source).toContain("'sha256:' || encode(digest(");
  });

  it("creates an idempotent bounded FINAL_VIDEO_ASSEMBLY job and immutable component snapshots", () => {
    const source = sql();
    expect(source).toContain("'FINAL_VIDEO_ASSEMBLY'");
    expect(source).toContain("'SCENE_PLAN_VERSION'");
    expect(source).toContain("'final-video:'");
    expect(source).toContain("max_attempts");
    expect(source).toContain("3");
    expect(source).toContain("insert into public.video_assemblies");
    expect(source).toContain("insert into public.video_assembly_components");
    expect(source).toContain("'reused'");
    expect(source).toContain("'mediaAssetId'");
  });

  it("blocks generic browser mutation of both provider generation and final assembly jobs", () => {
    const source = sql();
    expect(source).toContain("drop policy if exists jobs_insert_editor on public.jobs");
    expect(source).toContain("drop policy if exists jobs_update_editor on public.jobs");
    expect(source).toMatch(/job_type not in\s*\(\s*'VIDEO_SHOT_GENERATION'\s*,\s*'FINAL_VIDEO_ASSEMBLY'\s*\)/i);
  });

  it("revokes anonymous/public execution and grants only authenticated enqueue access", () => {
    const source = sql();
    expect(source).toContain("revoke all on function public.enqueue_final_video_assembly(uuid, uuid, text) from public");
    expect(source).toContain("revoke all on function public.enqueue_final_video_assembly(uuid, uuid, text) from anon");
    expect(source).toContain("grant execute on function public.enqueue_final_video_assembly(uuid, uuid, text) to authenticated");
  });
});
