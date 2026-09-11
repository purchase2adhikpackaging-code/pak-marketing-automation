import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = join(
  process.cwd(),
  "supabase/migrations/202609110009_video_generation_enqueue.sql",
);
const sql = readFileSync(migrationPath, "utf8");

describe("approved-shot video generation enqueue SQL", () => {
  it("uses one authenticated atomic invoker RPC", () => {
    expect(sql).toContain("create or replace function public.enqueue_video_shot_generation(");
    expect(sql).toContain("security invoker");
    expect(sql).toContain("auth.uid()");
    expect(sql).toContain("public.has_org_role(_organization_id, array['OWNER','ADMIN','EDITOR'])");
  });

  it("requires an APPROVED current plan with no blocker findings", () => {
    expect(sql).toContain("v_plan_status <> 'APPROVED'");
    expect(sql).toContain("scene_plan_qc_findings");
    expect(sql).toContain("severity = 'BLOCKER'");
    expect(sql).toContain("source_integrity_hash");
    expect(sql).toContain("digest(");
    expect(sql).toContain("content_script_artifacts");
  });

  it("derives the scene/shot generation snapshot inside the database", () => {
    expect(sql).toContain("scene_plan_shots");
    expect(sql).toContain("master_visual_prompt");
    expect(sql).toContain("camera_motion");
    expect(sql).toContain("continuity_state");
    expect(sql).toContain("aspect_ratio");
    expect(sql).toContain("duration_seconds");
  });

  it("creates a bounded durable job and only one attempt for a new idempotency key", () => {
    expect(sql).toContain("'VIDEO_SHOT_GENERATION'");
    expect(sql).toContain("'SCENE_PLAN_SHOT'");
    expect(sql).toContain("max_attempts");
    expect(sql).toContain("4");
    expect(sql).toContain("idempotency_key");
    expect(sql).toContain("video_generation_attempts");
    expect(sql).toContain("reused");
  });

  it("does not accept caller-supplied prompt or provider credentials", () => {
    const signature = sql.slice(
      sql.indexOf("create or replace function public.enqueue_video_shot_generation("),
      sql.indexOf("returns jsonb"),
    );
    expect(signature).not.toMatch(/prompt/i);
    expect(signature).not.toMatch(/api[_ ]?key/i);
    expect(signature).not.toMatch(/token/i);
    expect(signature).not.toMatch(/secret/i);
  });
});
