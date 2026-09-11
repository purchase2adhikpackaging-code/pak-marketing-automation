import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = join(
  process.cwd(),
  "supabase/migrations/202609120001_media_library_foundation.sql",
);

describe("Phase 8 media library foundation schema", () => {
  it("adds bucket-aware durable media identity and operator metadata", () => {
    const sql = readFileSync(migrationPath, "utf8");

    expect(sql).toContain("add column if not exists storage_bucket text");
    expect(sql).toContain("update public.media_assets");
    expect(sql).toContain("set storage_bucket = 'generated-media'");
    expect(sql).toContain("add column if not exists display_name text");
    expect(sql).toContain("add column if not exists size_bytes bigint");
    expect(sql).toContain("add column if not exists metadata jsonb");
    expect(sql).toContain("add column if not exists created_by uuid");
    expect(sql).toContain("add column if not exists archived_at timestamptz");
    expect(sql).toContain("add column if not exists archived_by uuid");
    expect(sql).toMatch(/unique[\s\S]*organization_id[\s\S]*storage_bucket[\s\S]*storage_path/i);
  });

  it("backfills existing generated assets before requiring a bucket", () => {
    const sql = readFileSync(migrationPath, "utf8");
    const backfill = sql.indexOf("set storage_bucket = 'generated-media'");
    const notNull = sql.indexOf("alter column storage_bucket set not null");

    expect(backfill).toBeGreaterThan(-1);
    expect(notNull).toBeGreaterThan(backfill);
  });

  it("adds organization-scoped catalogue indexes", () => {
    const sql = readFileSync(migrationPath, "utf8");

    expect(sql).toContain("media_assets_org_status_created_idx");
    expect(sql).toContain("media_assets_org_type_created_idx");
    expect(sql).toContain("media_assets_org_source_created_idx");
  });
});
