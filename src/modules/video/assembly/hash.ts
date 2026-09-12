import { createHash } from "node:crypto";
import type { FinalAssemblyAspectRatio, FinalRenderProfile } from "./types";

export type AssemblyReadinessHashComponent = {
  sceneId: string;
  shotId: string;
  mediaAssetId: string;
  mediaChecksum: string;
  durationSeconds: number;
};

export type AssemblyReadinessHashInput = {
  organizationId: string;
  planVersionId: string;
  sourceIntegrityHash: string;
  aspectRatio: FinalAssemblyAspectRatio;
  renderProfile: FinalRenderProfile;
  components: readonly AssemblyReadinessHashComponent[];
};

function appendCanonicalField(hash: ReturnType<typeof createHash>, value: string | number): void {
  hash.update(String(value), "utf8");
  hash.update(Buffer.from([0]));
}

export function computeAssemblyReadinessHash(input: AssemblyReadinessHashInput): string {
  const hash = createHash("sha256");

  appendCanonicalField(hash, "final-assembly-v1");
  appendCanonicalField(hash, input.organizationId);
  appendCanonicalField(hash, input.planVersionId);
  appendCanonicalField(hash, input.sourceIntegrityHash);
  appendCanonicalField(hash, input.aspectRatio);
  appendCanonicalField(hash, input.renderProfile);

  for (const component of input.components) {
    appendCanonicalField(hash, component.sceneId);
    appendCanonicalField(hash, component.shotId);
    appendCanonicalField(hash, component.mediaAssetId);
    appendCanonicalField(hash, component.mediaChecksum);
    appendCanonicalField(hash, Math.round(component.durationSeconds * 1000));
  }

  return `sha256:${hash.digest("hex")}`;
}
