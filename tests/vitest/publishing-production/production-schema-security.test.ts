import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = join(
  process.cwd(),
  "supabase/migrations/202609120001_publishing_production_runner.sql",
);

function sql(): string {
  expect(existsSync(migrationPath)).toBe(true);
  return readFileSync(migrationPath, "utf8");
}

describe("publishing production schema security contract", () => {
  it("creates organization-scoped production runs, jobs and publications with RLS", () => {
    const source = sql();

    for (const table of [
      "publishing_production_runs",
      "publishing_production_jobs",
      "publishing_publications",
    ]) {
      expect(source).toMatch(new RegExp(`create table(?: if not exists)?\\s+public\\.${table}`, "i"));
      expect(source).toMatch(new RegExp(`alter table\\s+public\\.${table}\\s+enable row level security`, "i"));
      expect(source).toMatch(new RegExp(`${table}[\\s\\S]*organization_id`, "i"));
    }
  });

  it("locks stable publication identity and three-attempt ceiling", () => {
    const source = sql();

    expect(source).toMatch(/unique\s*\(\s*production_run_id\s*,\s*book_id\s*,\s*edition\s*,\s*revision\s*\)/i);
    expect(source).toMatch(/max_attempts\s+integer\s+not null\s+default\s+3/i);
    expect(source).toMatch(/check\s*\(\s*max_attempts\s*=\s*3\s*\)/i);
    expect(source).toMatch(/attempt_count\s+integer\s+not null\s+default\s+0/i);
  });

  it("defines lease-aware atomic queue RPCs with skip-locked claiming", () => {
    const source = sql();

    for (const fn of [
      "claim_publishing_jobs",
      "heartbeat_publishing_job",
      "complete_publishing_job",
      "fail_publishing_job",
      "set_publishing_run_state",
    ]) {
      expect(source).toMatch(new RegExp(`create or replace function\\s+public\\.${fn}`, "i"));
    }

    expect(source).toMatch(/for update(?:\s+of\s+\w+)?\s+skip locked/i);
    expect(source).toMatch(/lease_owner/i);
    expect(source).toMatch(/lease_expires_at/i);
    expect(source).toMatch(/attempt_count\s*\+\s*1/i);
    expect(source).toMatch(/blocked/i);
  });

  it("hardens security-definer functions and explicit role authorization", () => {
    const source = sql();

    expect(source).toMatch(/security definer/i);
    expect(source).toMatch(/set search_path\s*=\s*public/i);
    expect(source).toMatch(/organization_memberships/i);
    expect(source).toMatch(/owner/i);
    expect(source).toMatch(/admin/i);
    expect(source).toMatch(/editor/i);
    expect(source).toMatch(/revoke execute on function[\s\S]*from public/i);
    expect(source).toMatch(/grant execute on function[\s\S]*to authenticated/i);
  });

  it("creates a private publishing-books bucket with organization-keyed policies", () => {
    const source = sql();

    expect(source).toMatch(/publishing-books/i);
    expect(source).toMatch(/storage\.buckets/i);
    expect(source).toMatch(/public\s*=\s*false/i);
    expect(source).toMatch(/storage\.objects/i);
    expect(source).toMatch(/organization_id/i);
  });
});
