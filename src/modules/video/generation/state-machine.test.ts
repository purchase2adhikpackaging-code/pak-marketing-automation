import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { canTransitionVideoGenerationAttempt } from "./state-machine";

const migrationPath = join(
  process.cwd(),
  "supabase/migrations/202609110010_video_generation_reconciliation.sql",
);
const sql = readFileSync(migrationPath, "utf8");

describe("video generation attempt state machine", () => {
  it("allows the normal asynchronous provider lifecycle", () => {
    expect(canTransitionVideoGenerationAttempt("QUEUED", "SUBMITTING")).toBe(true);
    expect(canTransitionVideoGenerationAttempt("SUBMITTING", "SUBMITTED")).toBe(true);
    expect(canTransitionVideoGenerationAttempt("SUBMITTED", "PROCESSING")).toBe(true);
    expect(canTransitionVideoGenerationAttempt("PROCESSING", "IMPORT_PENDING")).toBe(true);
    expect(canTransitionVideoGenerationAttempt("IMPORT_PENDING", "COMPLETED")).toBe(true);
  });

  it("permits safe failure and ambiguous-submission terminals but rejects backward mutation", () => {
    expect(canTransitionVideoGenerationAttempt("SUBMITTING", "FAILED")).toBe(true);
    expect(canTransitionVideoGenerationAttempt("SUBMITTING", "SUBMISSION_UNKNOWN")).toBe(true);
    expect(canTransitionVideoGenerationAttempt("PROCESSING", "FAILED")).toBe(true);
    expect(canTransitionVideoGenerationAttempt("COMPLETED", "PROCESSING")).toBe(false);
    expect(canTransitionVideoGenerationAttempt("SUBMISSION_UNKNOWN", "SUBMITTING")).toBe(false);
  });

  it("adds a trusted retry scheduler that creates a new attempt instead of mutating a failed one", () => {
    expect(sql).toContain("create or replace function public.schedule_video_generation_retry(");
    expect(sql).toContain("security invoker");
    expect(sql).toContain("attempt_number + 1");
    expect(sql).toContain("state = 'FAILED'");
    expect(sql).toContain("retryable is true");
    expect(sql).toContain("attempt_number >= 4");
    expect(sql).toContain("'RETRYING'");
    expect(sql).toContain("revoke all on function public.schedule_video_generation_retry");
    expect(sql).toContain("grant execute on function public.schedule_video_generation_retry");
  });
});
