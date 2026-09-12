import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function hardeningSql(): string {
  return readFileSync(
    join(process.cwd(), "supabase/migrations/202609120012_approval_center_table_acl_hardening.sql"),
    "utf8",
  ).replace(/\s+/g, " ").trim().toLowerCase();
}

describe("Phase 9 Approval Center table ACL hardening", () => {
  it("removes Supabase default authenticated table privileges and restores SELECT only", () => {
    const sql = hardeningSql();

    for (const table of ["public.approval_requests", "public.approval_events"]) {
      expect(sql).toContain(`revoke all privileges on table ${table} from authenticated`);
      expect(sql).toContain(`grant select on table ${table} to authenticated`);
    }

    expect(sql).not.toContain("grant truncate");
    expect(sql).not.toContain("grant references");
    expect(sql).not.toContain("grant trigger");
    expect(sql).not.toContain("grant insert");
    expect(sql).not.toContain("grant update");
    expect(sql).not.toContain("grant delete");
  });
});
