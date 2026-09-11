import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = join(
  process.cwd(),
  "supabase/migrations/202609110011_generated_video_media_import.sql",
);

describe("generated video media import SQL", () => {
  it("provisions a private generated media bucket and atomic completion RPC", () => {
    const sql = readFileSync(migrationPath, "utf8");

    expect(sql).toContain("insert into storage.buckets");
    expect(sql).toContain("'generated-media'");
    expect(sql).toMatch(/public\s*=\s*false/i);
    expect(sql).toContain("create or replace function public.complete_generated_video_import");
    expect(sql).toContain("security invoker");
    expect(sql).toContain("insert into public.media_assets");
    expect(sql).toContain("asset_type");
    expect(sql).toContain("'VIDEO'");
    expect(sql).toContain("'GENERATED'");
    expect(sql).toContain("media_asset_id");
    expect(sql).toContain("state = 'COMPLETED'");
    expect(sql).toContain("result_payload");
  });

  it("matches the existing media/jobs schema instead of forcing Phase 6 scene IDs into legacy media lineage", () => {
    const sql = readFileSync(migrationPath, "utf8");
    const mediaInsert = sql.match(/insert into public\.media_assets\s*\(([^)]*)\)\s*values/is)?.[1] ?? "";
    const mediaConflictUpdate = sql.match(/on conflict \(organization_id, storage_path\) do update\s*set([\s\S]*?)returning id into v_media_id;/i)?.[1] ?? "";

    expect(mediaInsert).not.toMatch(/\bscene_id\b/i);
    expect(mediaConflictUpdate).not.toMatch(/\bscene_id\b/i);
    expect(sql).not.toMatch(/\bprogress\s*=/i);
    expect(sql).toContain("generating_job_id");
    expect(sql).toContain("v_attempt.shot_id");
    expect(sql).toContain("'scenePlanSceneId', v_attempt.scene_id");
  });

  it("keeps completion service-role-only and idempotent", () => {
    const sql = readFileSync(migrationPath, "utf8");

    expect(sql).toContain("revoke all on function public.complete_generated_video_import");
    expect(sql).toContain("grant execute on function public.complete_generated_video_import");
    expect(sql).toContain("to service_role");
    expect(sql).toContain("on conflict (organization_id, storage_path)");
    expect(sql).not.toMatch(/provider_url|signed_url|api_key|authorization\s+text/i);
  });
});
