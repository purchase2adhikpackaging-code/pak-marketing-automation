import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const vaultSource = readFileSync(
  join(process.cwd(), "supabase/functions/integration-vault/index.ts"),
  "utf8",
);

describe("integration-vault Edge security boundary", () => {
  it("rejects secret-bearing keys from public integration config", () => {
    expect(vaultSource).toContain("containsSensitiveConfigKey");
    expect(vaultSource).toContain("SENSITIVE_CONFIG_KEY_RE");
    expect(vaultSource).toMatch(/update_config[\s\S]*containsSensitiveConfigKey\(input\.config\)/);
  });

  it("derives privileged actor identity from the verified bearer token", () => {
    expect(vaultSource).toContain("admin.auth.getUser(token)");
    expect(vaultSource).toContain("_actor_user_id: user.id");
    expect(vaultSource).not.toContain("_actor_user_id: input.actorUserId");
  });

  it("never includes plaintext secret values in safe connection output", () => {
    const safeConnectionBody = vaultSource.match(/function safeConnection\([\s\S]*?\n}\n\nfunction parseBody/)?.[0] ?? "";
    expect(safeConnectionBody).not.toContain("secretValue");
    expect(safeConnectionBody).not.toContain("decrypted_secret");
    expect(safeConnectionBody).not.toContain("apiKey");
  });

  it("uses one transactional RPC for config mutation plus its audit event", () => {
    expect(vaultSource).toContain('admin.rpc("update_integration_connection_config", {');
    const branch = vaultSource.match(/if \(input\.action === "update_config"\)[\s\S]*?\n  }\n\n  if \(input\.action === "set_disabled"\)/)?.[0] ?? "";
    expect(branch).not.toContain('.from("integration_connections").update');
    expect(branch).not.toContain('.from("integration_audit_events").insert');
  });

  it("uses one transactional RPC for enable-disable mutation plus its audit event", () => {
    expect(vaultSource).toContain('admin.rpc("set_integration_connection_disabled", {');
    const branch = vaultSource.match(/if \(input\.action === "set_disabled"\)[\s\S]*?\n  }\n\n  if \(input\.provider !== "OPENAI"\)/)?.[0] ?? "";
    expect(branch).not.toContain('.from("integration_connections").update');
    expect(branch).not.toContain('.from("integration_audit_events").insert');
  });

  it("records credential verification status and audit atomically", () => {
    expect(vaultSource).toContain('admin.rpc("record_integration_test_result", {');
    const branch = vaultSource.match(/const providerResponse = await fetch\([\s\S]*?const connection = await getConnection\(\);/)?.[0] ?? "";
    expect(branch).not.toContain('.from("integration_connections").update');
    expect(branch).not.toContain('.from("integration_audit_events").insert');
  });

  it("tests LTX credentials without submitting a paid generation", () => {
    expect(vaultSource).toContain('input.provider === "LTX"');
    expect(vaultSource).toContain("https://api.ltx.io/v2/text-to-video/00000000-0000-4000-8000-000000000000");
    const ltxTestBranch = vaultSource.match(/if \(input\.provider === "LTX"\)[\s\S]*?if \(input\.provider !== "OPENAI"\)/)?.[0] ?? "";
    expect(ltxTestBranch).toContain('method: "GET"');
    expect(ltxTestBranch).not.toContain('method: "POST"');
    expect(ltxTestBranch).toContain('_provider: "LTX"');
    expect(ltxTestBranch).toContain("record_integration_test_result");
  });
});
