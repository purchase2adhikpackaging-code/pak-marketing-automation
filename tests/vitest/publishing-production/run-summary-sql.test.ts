import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  join(process.cwd(), "supabase/migrations/202609120002_publishing_run_summary.sql"),
  "utf8",
);

describe("publishing production run summary SQL", () => {
  it("recomputes queue counters from durable job state", () => {
    for (const counter of ["queued_count", "running_count", "qa_passed_count", "blocked_count", "cancelled_count"]) {
      expect(source).toContain(counter);
    }
    expect(source).toContain("publishing_production_jobs");
    expect(source).toContain("publishing_publications");
    expect(source).toContain("released_count");
  });

  it("finishes runs only when no queued or running jobs remain", () => {
    expect(source).toMatch(/coalesce\(v_queued,\s*0\)\s*=\s*0/i);
    expect(source).toMatch(/coalesce\(v_running,\s*0\)\s*=\s*0/i);
    expect(source).toContain("COMPLETED_WITH_BLOCKED");
    expect(source).toContain("COMPLETED");
  });

  it("refreshes after both job and publication mutations", () => {
    expect(source).toMatch(/create trigger publishing_jobs_refresh_run_summary/i);
    expect(source).toMatch(/create trigger publishing_publications_refresh_run_summary/i);
  });
});
