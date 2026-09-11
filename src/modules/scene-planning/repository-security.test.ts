import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/modules/scene-planning/repository.ts"), "utf8");

describe("Scene Planning Supabase repository security", () => {
  it("uses the authenticated server client rather than admin/service-role access", () => {
    expect(source).toContain("createServerSupabaseClient");
    expect(source).not.toContain("createSupabaseAdminClient");
    expect(source).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
  });

  it("uses atomic authenticated RPCs for draft graph persistence and cloning", () => {
    expect(source).toContain('.rpc("persist_scene_plan_draft"');
    expect(source).toContain('.rpc("clone_scene_plan_version"');
  });

  it("scopes repository reads and writes by organization", () => {
    expect(source).toContain('.eq("organization_id", organizationId)');
    expect(source).toContain('_organization_id: input.organizationId');
  });
});
