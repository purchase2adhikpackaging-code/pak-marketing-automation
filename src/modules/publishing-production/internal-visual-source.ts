import type {
  BookVisualRequirement,
} from "@/modules/publishing-factory/visual-production";
import type {
  VisualAssetCandidate,
  VisualAssetSource,
} from "@/modules/publishing-factory/visual-resolver";

interface InternalVisualSourceInput {
  supabaseUrl: string;
  anonKey: string;
  credential: string;
  organizationId: string;
  productionJobId: string;
  fetchImpl?: typeof fetch;
}

interface EdgeVisualPayload {
  requirementId?: unknown;
  assetId?: unknown;
  mimeType?: unknown;
  width?: unknown;
  height?: unknown;
  imageBase64?: unknown;
  sourceKind?: unknown;
  provenance?: unknown;
  realismVerified?: unknown;
  labelsPresent?: unknown;
  error?: unknown;
}

function decodeBase64(value: string): Uint8Array {
  return new Uint8Array(Buffer.from(value, "base64"));
}

function parseCandidate(
  requirement: BookVisualRequirement,
  payload: EdgeVisualPayload,
): VisualAssetCandidate {
  if (
    payload.requirementId !== requirement.id ||
    typeof payload.assetId !== "string" || !payload.assetId.trim() ||
    typeof payload.mimeType !== "string" ||
    typeof payload.width !== "number" ||
    typeof payload.height !== "number" ||
    typeof payload.imageBase64 !== "string" || payload.imageBase64.length < 1000 ||
    !["generated", "approved-library", "licensed-source"].includes(String(payload.sourceKind)) ||
    typeof payload.provenance !== "string" || !payload.provenance.trim() ||
    typeof payload.realismVerified !== "boolean" ||
    typeof payload.labelsPresent !== "boolean"
  ) {
    throw new Error(`Publishing visual provider returned an invalid payload for ${requirement.id}.`);
  }

  return {
    requirementId: requirement.id,
    assetId: payload.assetId,
    mimeType: payload.mimeType,
    width: payload.width,
    height: payload.height,
    bytes: decodeBase64(payload.imageBase64),
    sourceKind: payload.sourceKind as VisualAssetCandidate["sourceKind"],
    provenance: payload.provenance,
    realismVerified: payload.realismVerified,
    labelsPresent: payload.labelsPresent,
  };
}

export function createInternalPublishingVisualSource(
  input: InternalVisualSourceInput,
): VisualAssetSource {
  const fetchImpl = input.fetchImpl ?? fetch;
  const endpoint = `${input.supabaseUrl.replace(/\/$/, "")}/functions/v1/generate-publishing-visual`;

  return {
    name: "publishing-openai-visuals",
    async resolve(requirement) {
      const response = await fetchImpl(endpoint, {
        method: "POST",
        headers: {
          authorization: `Bearer ${input.anonKey}`,
          apikey: input.anonKey,
          "content-type": "application/json",
          "x-publishing-worker-secret": input.credential,
        },
        body: JSON.stringify({
          organizationId: input.organizationId,
          productionJobId: input.productionJobId,
          requirementId: requirement.id,
          placement: requirement.placement,
          chapterId: requirement.chapterId,
          subjectPrompt: requirement.subjectPrompt,
          caption: requirement.caption,
          altText: requirement.altText,
          realistic: requirement.realistic,
          labelsRequired: requirement.labelsRequired,
        }),
      });

      let payload: EdgeVisualPayload = {};
      try {
        payload = await response.json() as EdgeVisualPayload;
      } catch {
        // Stable provider error below.
      }
      if (!response.ok) {
        const code = typeof payload.error === "string" ? payload.error : "VISUAL_PROVIDER_ERROR";
        throw new Error(
          `Publishing visual generation failed for ${requirement.id}: ${code} (HTTP ${response.status}).`,
        );
      }
      return parseCandidate(requirement, payload);
    },
  };
}
