import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = join(
  process.cwd(),
  "supabase/migrations/202609150001_publishing_completion_clears_last_error.sql",
);

describe("publishing completion error cleanup", () => {
  it("clears stale failure text when a publishing job completes successfully", () => {
    const exists = existsSync(migrationPath);
    expect(exists).toBe(true);
    if (!exists) return;

    const source = readFileSync(migrationPath, "utf8");
    expect(source).toMatch(/create\s+or\s+replace\s+function\s+public\.complete_publishing_job/i);
    expect(source).toMatch(/status\s*=\s*'QA_PASSED'[\s\S]*last_error\s*=\s*null/i);
    expect(source).toMatch(/auth\.role\(\)\s*<>\s*'service_role'/i);
    expect(source).toMatch(/security\s+definer/i);
    expect(source).toMatch(/set\s+search_path\s*=\s*public/i);
    expect(source).toMatch(/revoke\s+execute\s+on\s+function\s+public\.complete_publishing_job[\s\S]*from\s+public/i);
    expect(source).toMatch(/grant\s+execute\s+on\s+function\s+public\.complete_publishing_job[\s\S]*to\s+service_role/i);
  });
});
