import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/modules/video/assembly/read-repository.ts"), "utf8");

describe("final assembly read repository", () => {
  it("uses only authenticated user-scoped Supabase access", () => {
    expect(source).toContain("createServerSupabaseClient");
    expect(source).not.toContain("createSupabaseAdminClient");
    expect(source).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
  });

  it("scopes plan, media and assembly reads by organization", () => {
    expect(source).toContain('.eq("organization_id", organizationId)');
    expect(source).toContain("computeFinalAssemblyReadiness");
  });

  it("never returns storage paths, signed URLs or credentials", () => {
    const returnType = source.match(/export type FinalAssemblyReadModel =[\s\S]*?\n};/)?.[0] ?? "";
    expect(returnType).not.toContain("storagePath");
    expect(returnType).not.toContain("storageBucket");
    expect(returnType).not.toContain("signedUrl");
    expect(returnType).not.toContain("secret");
  });
});
