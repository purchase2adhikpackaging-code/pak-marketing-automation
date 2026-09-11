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

export function computeAssemblyReadinessHash(input: AssemblyReadinessHashInput): string {
  const canonical = JSON.stringify({
    schemaVersion: "final-assembly-v1",
    organizationId: input.organizationId,
    planVersionId: input.planVersionId,
    sourceIntegrityHash: input.sourceIntegrityHash,
    aspectRatio: input.aspectRatio,
    renderProfile: input.renderProfile,
    components: input.components.map((component) => ({
      sceneId: component.sceneId,
      shotId: component.shotId,
      mediaAssetId: component.mediaAssetId,
      mediaChecksum: component.mediaChecksum,
      durationSeconds: component.durationSeconds,
    })),
  });

  return `sha256:${createHash("sha256").update(canonical, "utf8").digest("hex")}`;
}
