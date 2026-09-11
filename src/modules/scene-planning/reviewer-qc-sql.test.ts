import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  join(process.cwd(), "supabase/migrations/202609110004_scene_plan_reviewer_qc_ack.sql"),
  "utf8",
);

describe("Scene Planning reviewer QC acknowledgement", () => {
  it("extends only QC update RLS to REVIEWER", () => {
    expect(sql).toContain("array['OWNER','ADMIN','EDITOR','REVIEWER']");
    expect(sql).toContain("scene_plan_qc_update_editor");
  });

  it("constrains reviewer-only writes to WARNING acknowledgement fields", () => {
    expect(sql).toContain("old.severity <> 'WARNING'");
    expect(sql).toContain("new.acknowledged_by <> auth.uid()");
    expect(sql).toContain("reviewers may only acknowledge warning findings");
    expect(sql).toContain("new.message is distinct from old.message");
  });

  it("remains security invoker", () => {
    expect(sql).toContain("security invoker");
    expect(sql).not.toContain("security definer");
  });
});
