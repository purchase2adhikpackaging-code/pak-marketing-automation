import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8").replace(/\s+/g, " ").toLowerCase();
}

const mediaDeleteMigration = "supabase/migrations/202609120015_approval_media_delete_supersession.sql";
const revisionGuardMigration = "supabase/migrations/202609120016_content_artifact_revision_guard.sql";

describe("Phase 9 release hardening", () => {
  it("supersedes approval history before a reviewed media asset can disappear", () => {
    expect(existsSync(join(process.cwd(), mediaDeleteMigration))).toBe(true);
    if (!existsSync(join(process.cwd(), mediaDeleteMigration))) return;
    const sql = source(mediaDeleteMigration);
    expect(sql).toContain("before delete on public.media_assets");
    expect(sql).toContain("public.supersede_target_approvals");
    expect(sql).toContain("media_asset_deleted");
  });

  it("advances content revision whenever script text changes so a new exact request can be submitted", () => {
    expect(existsSync(join(process.cwd(), revisionGuardMigration))).toBe(true);
    if (!existsSync(join(process.cwd(), revisionGuardMigration))) return;
    const sql = source(revisionGuardMigration);
    expect(sql).toContain("before update of script_text, revision on public.content_script_artifacts");
    expect(sql).toContain("old.script_text is distinct from new.script_text");
    expect(sql).toContain("new.revision := old.revision + 1");
  });

  it("provides deterministic continuation pagination for approval queues beyond 50 rows", () => {
    const readModel = source("src/modules/approval/read-model.ts");
    const repository = source("src/modules/approval/repository.ts");
    const client = source("src/app/(app)/approval-center/approval-center-client.tsx");
    expect(readModel).toContain("export type approvalcursor");
    expect(readModel).toContain("nextcursor");
    expect(repository).toContain("normalized.cursor");
    expect(repository).toContain("nextcursor");
    expect(client).toContain("load more");
    expect(client).toContain("page.nextcursor");
  });

  it("requires the Media Library preview boundary to verify an expected checksum when supplied", () => {
    const edgeClient = source("src/modules/integrations/edge-client.ts");
    const edgeFunction = source("supabase/functions/media-library/index.ts");
    expect(edgeClient).toContain("expectedchecksum");
    expect(edgeFunction).toContain("expectedchecksum");
    expect(edgeFunction).toContain("media.checksum");
  });
});
