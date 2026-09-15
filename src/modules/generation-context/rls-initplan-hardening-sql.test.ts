import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migrationsDirectory = join(process.cwd(), "supabase/migrations");

function hardeningSource(): string {
  const filename = readdirSync(migrationsDirectory).find((candidate) =>
    candidate.endsWith("_organization_identity_rls_initplan_hardening.sql"),
  );
  if (!filename) {
    throw new Error("Organization identity RLS initplan hardening migration is missing.");
  }
  const path = join(migrationsDirectory, filename);
  if (!existsSync(path)) {
    throw new Error("Organization identity RLS initplan hardening migration is missing.");
  }
  return readFileSync(path, "utf8");
}

describe("organization identity RLS initplan hardening", () => {
  it("preserves Brand asset RBAC while evaluating auth.uid once per statement", () => {
    const sql = hardeningSource();
    expect(sql).toContain("drop policy if exists brand_kit_media_assets_insert_admin");
    expect(sql).toContain("create policy brand_kit_media_assets_insert_admin");
    expect(sql).toContain("public.has_org_role(organization_id, array['OWNER','ADMIN'])");
    expect(sql).toContain("created_by = (select auth.uid())");
  });

  it("preserves Knowledge document manager RBAC and audit checks with initplan-safe auth.uid", () => {
    const sql = hardeningSource();
    expect(sql).toContain("drop policy if exists knowledge_documents_insert_manager");
    expect(sql).toContain("create policy knowledge_documents_insert_manager");
    expect(sql).toContain("public.has_org_role(organization_id, array['OWNER','ADMIN','EDITOR'])");
    expect(sql).toContain("revision = 1");
    expect(sql).toContain("extraction_status = 'PENDING'");
    expect(sql).toContain("created_by = (select auth.uid())");
    expect(sql).toContain("updated_by = (select auth.uid())");
  });
});
