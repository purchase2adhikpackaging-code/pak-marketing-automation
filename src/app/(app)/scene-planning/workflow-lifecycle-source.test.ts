import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  join(process.cwd(), "src/app/(app)/scene-planning/workflow-actions.ts"),
  "utf8",
);

describe("Scene Planning workflow lifecycle source", () => {
  it("moves a newly persisted draft into QC_REQUIRED before QC result promotion", () => {
    const prepareIndex = source.indexOf('status: "QC_REQUIRED"');
    const findingDeleteIndex = source.indexOf('.from("scene_plan_qc_findings")\n    .delete()');
    expect(prepareIndex).toBeGreaterThan(-1);
    expect(findingDeleteIndex).toBeGreaterThan(prepareIndex);
    expect(source).toContain('.in("status", ["DRAFT", "PLANNING"])');
  });

  it("stales every mutable dependent plan when the production brief or Visual Bible changes", () => {
    expect(source.match(/\.in\("status", \["DRAFT", "PLANNING", "QC_REQUIRED", "REVIEW_REQUIRED", "APPROVED", "FAILED"\]\)/g)?.length)
      .toBeGreaterThanOrEqual(2);
  });
});
