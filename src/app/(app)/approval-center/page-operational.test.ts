import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/app/(app)/approval-center/page.tsx"), "utf8");

describe("Approval Center operational route", () => {
  it("loads real review workspaces instead of the future-module readiness shell", () => {
    expect(source).not.toContain("ModuleReadinessPage");
    expect(source).toContain("SupabaseApprovalRepository");
    expect(source).toContain("countScenePlanReviewRequired");
    expect(source).toContain("ApprovalCenterClient");
  });

  it("limits route workspaces to operational review roles", () => {
    expect(source).toContain('const REVIEW_ROLES: AppRole[] = ["OWNER", "ADMIN", "EDITOR", "REVIEWER"]');
    expect(source).not.toContain('"ANALYST"]');
  });
});
