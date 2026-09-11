import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  join(process.cwd(), "supabase/migrations/202609110005_scene_plan_draft_editing.sql"),
  "utf8",
);

describe("Scene Planning draft editing SQL", () => {
  it("keeps all manual edit and reorder operations security-invoker and editor-role scoped", () => {
    expect(sql.match(/security invoker/g)?.length).toBeGreaterThanOrEqual(4);
    expect(sql).toContain("array['OWNER','ADMIN','EDITOR']");
    expect(sql).not.toMatch(/security definer/i);
    expect(sql).not.toMatch(/service_role/i);
  });

  it("allows edits only before immutable lifecycle states", () => {
    expect(sql).toContain("status in ('DRAFT','QC_REQUIRED','REVIEW_REQUIRED')");
    expect(sql).toContain("scene plan version is not editable");
  });

  it("updates only approved scene creative fields and invalidates prior QC", () => {
    expect(sql).toContain("update public.scene_plan_scenes");
    expect(sql).toContain("title = _title");
    expect(sql).toContain("duration_seconds = _duration_seconds");
    expect(sql).toContain("creative_direction = _creative_direction");
    expect(sql).not.toContain("narration_text = _narration_text");
    expect(sql).toContain("delete from public.scene_plan_qc_findings");
    expect(sql).toContain("status = 'QC_REQUIRED'");
  });

  it("marks manual shot edits human-modified without permitting narration replacement", () => {
    expect(sql).toContain("update public.scene_plan_shots");
    expect(sql).toContain("master_visual_prompt = _master_visual_prompt");
    expect(sql).toContain("camera_motion = _camera_motion");
    expect(sql).toContain("human_modified = true");
    expect(sql).not.toContain("narration_start_char = _narration_start_char");
    expect(sql).not.toContain("narration_end_char = _narration_end_char");
  });

  it("reorders scenes and shots atomically without colliding with unique ordinal constraints", () => {
    expect(sql).toContain("create or replace function public.reorder_scene_plan_scenes(");
    expect(sql).toContain("create or replace function public.reorder_scene_plan_shots(");
    expect(sql).toContain("ordinal = ordinal + 1000000");
    expect(sql).toContain("with ordinality");
  });

  it("grants execution only to authenticated browser sessions using normal RLS identity", () => {
    expect(sql).toContain("grant execute on function public.update_scene_plan_scene_draft");
    expect(sql).toContain("grant execute on function public.update_scene_plan_shot_draft");
    expect(sql).toContain("grant execute on function public.reorder_scene_plan_scenes");
    expect(sql).toContain("grant execute on function public.reorder_scene_plan_shots");
    expect(sql).toContain("to authenticated");
  });
});
