import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const edgePath = join(process.cwd(), "supabase/functions/video-generation/index.ts");
const source = readFileSync(edgePath, "utf8");

describe("video-generation Edge security boundary", () => {
  it("keeps privileged Supabase access and LTX credentials inside the Edge runtime", () => {
    expect(source).toContain('Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")');
    expect(source).toContain('Deno.env.get("SUPABASE_URL")');
    expect(source).toContain('admin.auth.getUser(token)');
    expect(source).toContain('.from("organization_memberships")');
    expect(source).toContain('["OWNER", "ADMIN", "EDITOR"]');
    expect(source).toContain('admin.rpc("read_integration_vault_secret"');
    expect(source).toContain('_provider: "LTX"');
    expect(source).toContain('_secret_name: "API_KEY"');
  });

  it("loads immutable generation input from jobs rather than trusting provider parameters from the caller", () => {
    expect(source).toContain('.from("jobs")');
    expect(source).toContain('input_payload');
    expect(source).toContain('.from("video_generation_attempts")');
    expect(source).toContain('organizationId?: string');
    expect(source).toContain('jobId?: string');
    expect(source).toContain('attemptId?: string');
    expect(source).not.toMatch(/prompt\?:\s*string/);
    expect(source).not.toMatch(/model\?:\s*string/);
    expect(source).not.toMatch(/durationSeconds\?:/);
  });

  it("uses current async V2 LTX 2.5 Pro and explicit silent generation", () => {
    expect(source).toContain('https://api.ltx.io/v2/text-to-video');
    expect(source).toContain('"ltx-2-5-pro"');
    expect(source).toContain('generate_audio: false');
    expect(source).not.toMatch(/ltx-2-pro|ltx-2-fast/);
  });

  it("never returns the LTX key, authorization header, or provider video URL", () => {
    expect(source).not.toMatch(/json\([^\n]*apiKey/);
    expect(source).not.toMatch(/json\([^\n]*authorization/);
    expect(source).not.toMatch(/json\([^\n]*video_url/);
    expect(source).not.toMatch(/outputUrl\s*:/);
  });

  it("persists normalized submission/reconciliation state instead of raw provider payloads", () => {
    for (const state of ["SUBMITTING", "SUBMITTED", "PROCESSING", "IMPORT_PENDING", "FAILED", "SUBMISSION_UNKNOWN"]) {
      expect(source).toContain(`"${state}"`);
    }
    expect(source).toContain('provider_job_id');
    expect(source).toContain('last_polled_at');
    expect(source).not.toMatch(/raw_payload|provider_payload|response_body/);
  });
});
