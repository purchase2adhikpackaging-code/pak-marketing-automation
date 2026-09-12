import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function phase8MigrationSql(): string {
  const migrationsDir = join(process.cwd(), "supabase/migrations");
  return readdirSync(migrationsDir)
    .filter((name) => name.startsWith("20260912") && name.endsWith(".sql"))
    .sort()
    .map((name) => readFileSync(join(migrationsDir, name), "utf8"))
    .join("\n");
}

describe("Phase 8 media mutation security boundary", () => {
  it("removes direct media delete/insert and limits authenticated updates to archive metadata", () => {
    const sql = phase8MigrationSql();

    expect(sql).toContain(
      "drop policy if exists media_assets_delete_admin on public.media_assets",
    );
    expect(sql).toContain(
      "revoke insert, delete, update on table public.media_assets from authenticated",
    );
    expect(sql).toContain(
      "grant update (status, archived_at, archived_by, updated_at) on table public.media_assets to authenticated",
    );
    expect(sql).toContain("create policy media_assets_archive_editor");
    expect(sql).toContain("archived_by = auth.uid()");
  });

  it("keeps Phase 8 execution tables read-only to browser roles", () => {
    const sql = phase8MigrationSql();

    for (const table of [
      "public.video_assemblies",
      "public.video_assembly_components",
      "public.media_upload_sessions",
    ]) {
      expect(sql).toContain(`revoke all privileges on table ${table} from anon`);
      expect(sql).toContain(
        `revoke insert, update, delete on table ${table} from authenticated`,
      );
      expect(sql).toContain(`grant select on table ${table} to authenticated`);
    }
  });
});
