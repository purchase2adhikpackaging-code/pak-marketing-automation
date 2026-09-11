import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  join(process.cwd(), "supabase/migrations/202609110003_scene_plan_lifecycle_guards.sql"),
  "utf8",
);

describe("approved Scene Planning lifecycle SQL", () => {
  it("allows only lifecycle-only APPROVED -> STALE/SUPERSEDED transitions", () => {
    expect(sql).toContain("new.status in ('STALE','SUPERSEDED')");
    expect(sql).toContain("approved scene plan versions are immutable");
    expect(sql).toContain("new.canonical_narration is distinct from old.canonical_narration");
    expect(sql).toContain("new.visual_bible_snapshot is distinct from old.visual_bible_snapshot");
    expect(sql).toContain("new.qc_summary is distinct from old.qc_summary");
  });

  it("still blocks deletion of approved versions", () => {
    expect(sql).toContain("if tg_op = 'DELETE' then");
    expect(sql).toContain("raise exception 'approved scene plan versions are immutable'");
  });

  it("remains security-invoker and browser-unexecutable", () => {
    expect(sql).toContain("security invoker");
    expect(sql).toContain("revoke all on function public.enforce_scene_plan_approved_immutability() from authenticated");
  });
});
