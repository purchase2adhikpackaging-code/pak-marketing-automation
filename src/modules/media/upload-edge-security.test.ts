import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migrationSql = readFileSync(
  join(process.cwd(), "supabase/migrations/202609120005_media_upload_sessions.sql"),
  "utf8",
);
const edgeSource = readFileSync(
  join(process.cwd(), "supabase/functions/media-library/index.ts"),
  "utf8",
);

describe("media library upload security boundary", () => {
  it("creates a private media-library bucket and auditable upload sessions", () => {
    expect(migrationSql).toContain("'media-library'");
    expect(migrationSql).toContain("create table if not exists public.media_upload_sessions");
    expect(migrationSql).toMatch(/state text not null[\s\S]*ISSUED[\s\S]*FINALIZED[\s\S]*EXPIRED[\s\S]*FAILED/i);
    expect(migrationSql).toContain("expected_storage_path");
    expect(migrationSql).toContain("expected_mime_type");
    expect(migrationSql).toContain("expected_size_bytes");
    expect(migrationSql).toContain("enable row level security");
  });

  it("requires verified user auth and manager role for upload mutation", () => {
    expect(edgeSource).toContain("admin.auth.getUser(token)");
    expect(edgeSource).toContain("organization_memberships");
    expect(edgeSource).toContain('"OWNER"');
    expect(edgeSource).toContain('"ADMIN"');
    expect(edgeSource).toContain('"EDITOR"');
  });

  it("derives object paths server-side and never accepts a browser storage path", () => {
    expect(edgeSource).toContain("media_upload_sessions");
    expect(edgeSource).toContain("/uploads/");
    expect(edgeSource).toContain("createSignedUploadUrl");
    expect(edgeSource).not.toMatch(/input\.storagePath/);
    expect(edgeSource).not.toMatch(/body\.storagePath/);
  });

  it("finalizes only the issued session after checking object metadata", () => {
    expect(edgeSource).toContain('"finalize-upload"');
    expect(edgeSource).toContain("ISSUED");
    expect(edgeSource).toContain("storage_bucket");
    expect(edgeSource).toContain("storage_path");
    expect(edgeSource).toContain("expected_mime_type");
    expect(edgeSource).toContain("expected_size_bytes");
    expect(edgeSource).toContain("media_assets");
  });

  it("supports authorized short-lived preview signing without public buckets", () => {
    expect(edgeSource).toContain('"preview"');
    expect(edgeSource).toContain("createSignedUrl");
    expect(migrationSql).toMatch(/'media-library'[\s\S]*false/i);
  });
});
