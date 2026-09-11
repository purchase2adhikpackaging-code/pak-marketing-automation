import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = join(
  process.cwd(),
  "supabase/migrations/202609120004_video_assembly_worker.sql",
);
const edgePath = join(
  process.cwd(),
  "supabase/functions/video-assembly-worker/index.ts",
);

const migrationSql = readFileSync(migrationPath, "utf8");
const edgeSource = readFileSync(edgePath, "utf8");

describe("final assembly worker security boundary", () => {
  it("creates a Vault-held worker credential and service-only RPCs", () => {
    expect(migrationSql).toContain("pak/video-assembly/worker");
    expect(migrationSql).toContain("claim_video_assembly_work");
    expect(migrationSql).toContain("complete_video_assembly_work");
    expect(migrationSql).toContain("fail_video_assembly_work");
    expect(migrationSql).toMatch(/grant execute on function public\.claim_video_assembly_work[\s\S]*to service_role/i);
    expect(migrationSql).toMatch(/revoke all on function public\.claim_video_assembly_work[\s\S]*from authenticated/i);
  });

  it("requires only the internal worker credential and does not fall back to browser JWT auth", () => {
    expect(edgeSource).toContain("x-pak-render-worker-token");
    expect(edgeSource).toContain("read_video_assembly_worker_secret");
    expect(edgeSource).toContain("safeEqual");
    expect(edgeSource).not.toContain("admin.auth.getUser");
    expect(edgeSource).not.toContain("organization_memberships");
  });

  it("never returns privileged credentials to the worker", () => {
    expect(edgeSource).not.toMatch(/json\([^)]*SUPABASE_SERVICE_ROLE_KEY/i);
    expect(edgeSource).not.toContain("decrypted_secret:");
    expect(edgeSource).not.toContain("serviceRoleKey:");
  });

  it("revalidates authoritative assembly lineage before signing storage URLs", () => {
    expect(edgeSource).toContain("claim_video_assembly_work");
    expect(edgeSource).toContain("video_assembly_components");
    expect(edgeSource).toContain("media_assets");
    expect(edgeSource).toContain("status");
    expect(edgeSource).toContain("ACTIVE");
    expect(edgeSource).toContain("storage_bucket");
    expect(edgeSource).toContain("storage_path");
  });

  it("bounds component count and signed URL lifetime", () => {
    expect(edgeSource).toContain("FINAL_ASSEMBLY_MAX_COMPONENTS");
    expect(edgeSource).toContain("FINAL_ASSEMBLY_SIGNED_URL_TTL_SECONDS");
    expect(edgeSource).toContain("createSignedUrl");
    expect(edgeSource).toContain("createSignedUploadUrl");
  });

  it("accepts only claim, complete and fail worker operations", () => {
    expect(edgeSource).toContain('"claim"');
    expect(edgeSource).toContain('"complete"');
    expect(edgeSource).toContain('"fail"');
    expect(edgeSource).not.toContain('"enqueue"');
  });
});
