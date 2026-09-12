import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = join(
  process.cwd(),
  "supabase/migrations/20260912180000_organization_profile_brand_knowledge.sql",
);

function source(): string {
  return readFileSync(migrationPath, "utf8");
}

describe("organization profile / brand kit database foundation", () => {
  it("creates one revisioned organization profile and brand kit per organization", () => {
    const sql = source();
    expect(sql).toContain("create table if not exists public.organization_profiles");
    expect(sql).toContain("organization_id uuid primary key");
    expect(sql).toContain("revision integer not null default 1");
    expect(sql).toContain("create table if not exists public.organization_brand_kits");
    expect(sql).toContain("primary_color text");
    expect(sql).toContain("brand_voice text");
  });

  it("stores official assets only as Media Library IDs with controlled semantic roles", () => {
    const sql = source();
    expect(sql).toContain("create table if not exists public.brand_kit_media_assets");
    expect(sql).toContain("media_asset_id uuid not null references public.media_assets(id)");
    for (const role of ["PRIMARY_LOGO", "LIGHT_LOGO", "DARK_LOGO", "BRAND_MARK", "FAVICON", "APPROVED_IMAGERY"]) {
      expect(sql).toContain(`'${role}'`);
    }
    expect(sql).toContain("enforce_brand_asset_integrity");
    expect(sql).toContain("m.organization_id <> new.organization_id");
    expect(sql).toContain("m.status <> 'ACTIVE'");
    expect(sql).toContain("m.asset_type <> 'IMAGE'");
    expect(sql).not.toContain("signed_url");
  });

  it("enables tenant RLS and restricts identity mutation to OWNER/ADMIN", () => {
    const sql = source();
    for (const table of ["organization_profiles", "organization_brand_kits", "brand_kit_media_assets"]) {
      expect(sql).toContain(`alter table public.${table} enable row level security`);
    }
    expect(sql).toContain("public.is_org_member(organization_id)");
    expect(sql).toContain("public.has_org_role(organization_id, array['OWNER','ADMIN'])");
    expect(sql).toContain("organization_profile_revision_guard");
    expect(sql).toContain("organization_brand_kit_revision_guard");
  });

  it("adds Core Knowledge but prevents EDITOR from changing the core flag", () => {
    const sql = source();
    expect(sql).toContain("alter table public.knowledge_records");
    expect(sql).toContain("add column if not exists is_core boolean not null default false");
    expect(sql).toContain("enforce_knowledge_core_admin");
    expect(sql).toContain("new.is_core is distinct from old.is_core");
    expect(sql).toContain("array['OWNER','ADMIN']");
  });
});
