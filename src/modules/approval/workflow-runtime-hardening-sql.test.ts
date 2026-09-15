import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function runtimeHardeningSql(): string {
  return readFileSync(
    join(process.cwd(), "supabase/migrations/202609120013_approval_center_pgcrypto_schema_fix.sql"),
    "utf8",
  );
}

function normalizeSql(sql: string): string {
  return sql.replace(/\s+/g, " ").trim().toLowerCase();
}

describe("Phase 9 Approval Center pgcrypto runtime hardening", () => {
  it("schema-qualifies pgcrypto digest without widening the SECURITY DEFINER search path", () => {
    const sql = normalizeSql(runtimeHardeningSql());

    expect(sql).toContain("create or replace function public.submit_approval_request(");
    expect(sql).toContain("security definer set search_path = public");
    expect(sql.match(/extensions\.digest\(/g)).toHaveLength(2);
    expect(sql).not.toContain("set search_path = public, extensions");
  });

  it("preserves authenticated-only execution after replacing the RPC", () => {
    const sql = normalizeSql(runtimeHardeningSql());
    const signature = "public.submit_approval_request(uuid, text, uuid, jsonb)";

    expect(sql).toContain(`revoke all on function ${signature} from public`);
    expect(sql).toContain(`revoke all on function ${signature} from anon`);
    expect(sql).toContain(`revoke all on function ${signature} from authenticated`);
    expect(sql).toContain(`grant execute on function ${signature} to authenticated`);
  });
});
