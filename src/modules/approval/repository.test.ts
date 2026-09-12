import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/modules/approval/repository.ts"), "utf8");

describe("Supabase Approval Center repository", () => {
  it("uses only the authenticated server client and explicit organization filters", () => {
    expect(source).toContain("createServerSupabaseClient");
    expect(source).not.toContain("createSupabaseAdminClient");
    expect(source).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(source).toContain('.eq("organization_id", normalized.organizationId)');
    expect(source).toContain('.eq("organization_id", organizationId)');
  });

  it("loads deterministic queue/detail/event views with bounded pagination", () => {
    expect(source).toContain('.order("requested_at", { ascending: false })');
    expect(source).toContain('.order("id", { ascending: false })');
    expect(source).toContain("Math.min(normalized.limit, 50)");
    expect(source).toContain('.order("created_at", { ascending: true })');
  });

  it("loads immutable content provenance by snapshotted content item id", () => {
    expect(source).toContain('.from("content_item_knowledge_sources")');
    expect(source).toContain('.eq("content_item_id", contentItemId)');
    expect(source).toContain("title_snapshot");
    expect(source).toContain("content_snapshot");
  });

  it("keeps Scene Planning review authority separate and read-only", () => {
    expect(source).toContain('.from("scene_plan_versions")');
    expect(source).toContain('.eq("status", "REVIEW_REQUIRED")');
    expect(source).toContain('count: "exact", head: true');
  });

  it("maps database failures to safe AppError messages", () => {
    expect(source).toContain('new AppError("INTERNAL_ERROR"');
    expect(source).not.toContain("error.message");
    expect(source).not.toContain("error.details");
  });
});
