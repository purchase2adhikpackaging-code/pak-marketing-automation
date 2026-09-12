import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function performanceHardeningSql(): string {
  return readFileSync(
    join(process.cwd(), "supabase/migrations/202609120014_approval_events_org_index.sql"),
    "utf8",
  );
}

function normalizeSql(sql: string): string {
  return sql.replace(/\s+/g, " ").trim().toLowerCase();
}

describe("Phase 9 Approval Center performance hardening", () => {
  it("covers approval_events organization FK and tenant filtering with an index", () => {
    const sql = normalizeSql(performanceHardeningSql());

    expect(sql).toContain(
      "create index if not exists approval_events_organization_id_idx on public.approval_events (organization_id)",
    );
  });
});
