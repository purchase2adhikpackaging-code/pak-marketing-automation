import { createHash } from "node:crypto";

export function computeSceneSourceIntegrityHash(input: {
  artifactId: string;
  revision: number;
  scriptText: string;
}): string {
  const digest = createHash("sha256")
    .update(input.artifactId)
    .update("\u0000")
    .update(String(input.revision))
    .update("\u0000")
    .update(input.scriptText)
    .digest("hex");
  return `sha256:${digest}`;
}
