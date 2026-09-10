import "server-only";

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ENCRYPTION_VERSION = 1;
const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;
const TAG_BYTES = 16;

export function parseVaultEncryptionKey(value: string): Buffer {
  let key: Buffer;
  try {
    key = Buffer.from(value, "base64");
  } catch {
    throw new Error("Invalid vault encryption key encoding");
  }

  if (key.length !== 32 || key.toString("base64") !== value) {
    throw new Error("Vault encryption key must be a canonical base64-encoded 32-byte key");
  }

  return key;
}

export function encryptSecret(plaintext: string, rootKey: string): string {
  if (!plaintext) {
    throw new Error("Cannot encrypt an empty secret");
  }

  const key = parseVaultEncryptionKey(rootKey);
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: TAG_BYTES });
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [
    `v${ENCRYPTION_VERSION}`,
    iv.toString("base64url"),
    tag.toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(".");
}

export function decryptSecret(envelope: string, rootKey: string): string {
  const [version, ivValue, tagValue, ciphertextValue, ...extra] = envelope.split(".");
  if (version !== `v${ENCRYPTION_VERSION}` || !ivValue || !tagValue || !ciphertextValue || extra.length > 0) {
    throw new Error("Invalid encrypted secret envelope");
  }

  const key = parseVaultEncryptionKey(rootKey);
  const iv = Buffer.from(ivValue, "base64url");
  const tag = Buffer.from(tagValue, "base64url");
  const ciphertext = Buffer.from(ciphertextValue, "base64url");

  if (iv.length !== IV_BYTES || tag.length !== TAG_BYTES || ciphertext.length === 0) {
    throw new Error("Invalid encrypted secret envelope");
  }

  const decipher = createDecipheriv(ALGORITHM, key, iv, { authTagLength: TAG_BYTES });
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}

export const INTEGRATION_SECRET_ENCRYPTION_VERSION = ENCRYPTION_VERSION;
