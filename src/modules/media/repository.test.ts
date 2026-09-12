import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/modules/media/repository.ts"), "utf8");

describe("Supabase media repository", () => {
  it("uses only the authenticated server client", () => {
    expect(source).toContain("createServerSupabaseClient");
    expect(source).not.toContain("createSupabaseAdminClient");
    expect(source).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
  });

  it("scopes every media query by organization", () => {
    expect(source).toContain('.eq("organization_id", normalized.organizationId)');
    expect(source).toContain('.eq("organization_id", organizationId)');
  });

  it("uses deterministic created_at then id descending pagination and max 50", () => {
    expect(source).toContain('.order("created_at", { ascending: false })');
    expect(source).toContain('.order("id", { ascending: false })');
    expect(source).toContain("Math.min(normalized.limit, 50)");
    expect(source).toContain("created_at.lt");
    expect(source).toContain("id.lt");
  });

  it("archives with actor lineage and never hard-deletes directly from the Next repository", () => {
    expect(source).toContain('status: "ARCHIVED"');
    expect(source).toContain("archived_by: actorId");
    expect(source).not.toMatch(/\.from\("media_assets"\)[\s\S]{0,200}\.delete\(\)/);
  });
});
