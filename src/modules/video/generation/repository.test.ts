import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const repositoryPath = join(process.cwd(), "src/modules/video/generation/repository.ts");
const source = readFileSync(repositoryPath, "utf8");

describe("video generation repository security boundary", () => {
  it("uses the authenticated server Supabase client and atomic enqueue RPC", () => {
    expect(source).toContain('import "server-only"');
    expect(source).toContain("createServerSupabaseClient");
    expect(source).toContain('rpc("enqueue_video_shot_generation"');
    expect(source).not.toContain("createSupabaseAdminClient");
    expect(source).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
  });

  it("sends only organization, approved plan, shot, and profile identifiers to enqueue", () => {
    expect(source).toContain("_organization_id: input.organizationId");
    expect(source).toContain("_plan_version_id: input.planVersionId");
    expect(source).toContain("_shot_id: input.shotId");
    expect(source).toContain("_profile: input.profile");
    expect(source).not.toMatch(/apiKey/i);
    expect(source).not.toMatch(/secretValue/i);
  });
});
