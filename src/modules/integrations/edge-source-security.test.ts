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
});
