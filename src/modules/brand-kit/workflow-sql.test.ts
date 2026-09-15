import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = join(
  process.cwd(),
  "supabase/migrations/20260912180030_organization_identity_save_rpcs.sql",
);

function source(): string {
  return readFileSync(migrationPath, "utf8");
}

describe("organization identity save RPCs", () => {
  it("saves Brand Kit fields and media assignments in one authoritative transaction", () => {
    const sql = source();
    expect(sql).toContain("create or replace function public.save_organization_brand_kit");
    expect(sql).toContain("security definer");
    expect(sql).toContain("set search_path = public");
    expect(sql).toContain("auth.uid()");
    expect(sql).toContain("array['OWNER','ADMIN']");
    expect(sql).toContain("for update");
    expect(sql).toContain("v_revision <> _expected_revision");
    expect(sql).toContain("delete from public.brand_kit_media_assets");
    expect(sql).toContain("insert into public.brand_kit_media_assets");
    expect(sql).toContain("m.organization_id <> _organization_id");
    expect(sql).toContain("m.status <> 'ACTIVE'");
    expect(sql).toContain("m.asset_type <> 'IMAGE'");
  });

  it("exposes the save RPC only to authenticated users", () => {
    const sql = source();
    expect(sql).toContain("revoke all on function public.save_organization_brand_kit");
    expect(sql).toContain("from public");
    expect(sql).toContain("from anon");
    expect(sql).toContain("grant execute on function public.save_organization_brand_kit");
    expect(sql).toContain("to authenticated");
  });
});
