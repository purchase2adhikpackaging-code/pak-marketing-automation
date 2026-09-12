import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = join(
  process.cwd(),
  "supabase/migrations/202609120003_publishing_authenticated_enqueue.sql",
);

function sql(): string {
  expect(existsSync(migrationPath)).toBe(true);
  return readFileSync(migrationPath, "utf8");
}

describe("authenticated publishing enqueue hardening", () => {
  it("permits only authorized organization members to insert governed production jobs", () => {
    const source = sql();
    expect(source).toMatch(/create policy\s+publishing_jobs_insert_authorized/i);
    expect(source).toMatch(/on\s+public\.publishing_production_jobs[\s\S]*for insert[\s\S]*to authenticated/i);
    expect(source).toMatch(/publishing_production_runs/i);
    expect(source).toMatch(/created_by\s*=\s*auth\.uid\(\)/i);
    expect(source).toMatch(/has_org_role[\s\S]*OWNER[\s\S]*ADMIN[\s\S]*EDITOR/i);
  });

  it("allows trigger-driven summary refresh without requiring a service-role JWT", () => {
    const source = sql();
    const refreshBody = source.match(/create or replace function public\.refresh_publishing_run_summary[\s\S]*?\$\$;/i)?.[0] ?? "";
    expect(refreshBody).not.toMatch(/auth\.role\(\)\s*<>\s*'service_role'/i);
    expect(source).toMatch(/revoke execute on function public\.refresh_publishing_run_summary\(uuid\) from authenticated/i);
    expect(source).toMatch(/grant execute on function public\.refresh_publishing_run_summary\(uuid\) to service_role/i);
  });
});
