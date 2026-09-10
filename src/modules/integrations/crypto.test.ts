import { describe, expect, it } from "vitest";

import { decryptSecret, encryptSecret, parseVaultEncryptionKey } from "./crypto";

const key = Buffer.alloc(32, 7).toString("base64");

describe("Integration Vault cryptography", () => {
  it("round-trips a secret without storing plaintext", () => {
    const envelope = encryptSecret("sk-live-secret-value", key);

    expect(envelope).not.toContain("sk-live-secret-value");
    expect(envelope.startsWith("v1.")).toBe(true);
    expect(decryptSecret(envelope, key)).toBe("sk-live-secret-value");
  });

  it("uses randomized authenticated encryption", () => {
    const first = encryptSecret("same-secret", key);
    const second = encryptSecret("same-secret", key);

    expect(first).not.toBe(second);
    expect(decryptSecret(first, key)).toBe("same-secret");
    expect(decryptSecret(second, key)).toBe("same-secret");
  });

  it("rejects malformed or wrong-length root keys", () => {
    expect(() => parseVaultEncryptionKey("not-base64")) .toThrow();
    expect(() => parseVaultEncryptionKey(Buffer.alloc(16).toString("base64"))).toThrow();
  });

  it("rejects tampered ciphertext", () => {
    const envelope = encryptSecret("protected", key);
    const tampered = `${envelope.slice(0, -1)}${envelope.endsWith("A") ? "B" : "A"}`;

    expect(() => decryptSecret(tampered, key)).toThrow();
  });
});
