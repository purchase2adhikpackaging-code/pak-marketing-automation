import type {
  BookVisualPlan,
  BookVisualRequirement,
  BookVisualSourceKind,
  ResolvedBookVisual,
  ResolvedBookVisualBundle,
  SupportedBookVisualMimeType,
} from "./visual-production";

export interface VisualAssetCandidate {
  requirementId: string;
  assetId: string;
  mimeType: SupportedBookVisualMimeType | string;
  width: number;
  height: number;
  bytes: Uint8Array;
  sourceKind: BookVisualSourceKind;
  provenance: string;
  realismVerified: boolean;
  labelsPresent: boolean;
}

export interface VisualAssetSource {
  name: string;
  resolve(requirement: BookVisualRequirement): Promise<VisualAssetCandidate | null>;
}

export interface BookVisualResolver {
  resolve(plan: BookVisualPlan): Promise<ResolvedBookVisualBundle>;
}

export class VisualAssetResolutionError extends Error {
  readonly requirementId: string;

  constructor(requirementId: string, message: string) {
    super(message);
    this.name = "VisualAssetResolutionError";
    this.requirementId = requirementId;
  }
}

const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);
const URL_PATTERN = /https?:\/\//i;

function assertCandidate(
  requirement: BookVisualRequirement,
  candidate: VisualAssetCandidate,
): void {
  if (candidate.requirementId !== requirement.id) {
    throw new VisualAssetResolutionError(
      requirement.id,
      `Visual source returned candidate for ${candidate.requirementId} while resolving ${requirement.id}.`,
    );
  }
  if (!candidate.assetId.trim()) {
    throw new VisualAssetResolutionError(requirement.id, "Resolved visual is missing asset identity.");
  }
  if (!ALLOWED_MIME.has(candidate.mimeType)) {
    throw new VisualAssetResolutionError(
      requirement.id,
      `Resolved visual uses unsupported MIME type ${candidate.mimeType}.`,
    );
  }
  if (!(candidate.bytes instanceof Uint8Array) || candidate.bytes.byteLength === 0) {
    throw new VisualAssetResolutionError(
      requirement.id,
      "Resolved visual must include non-empty in-memory bytes; remote-only assets are forbidden.",
    );
  }
  if (!candidate.provenance.trim() || URL_PATTERN.test(candidate.provenance)) {
    throw new VisualAssetResolutionError(
      requirement.id,
      "Resolved visual provenance must be stable descriptive metadata, not a remote or signed URL.",
    );
  }
  if (!Number.isFinite(candidate.width) || !Number.isFinite(candidate.height)) {
    throw new VisualAssetResolutionError(requirement.id, "Resolved visual dimensions are invalid.");
  }
  if (requirement.realistic && !candidate.realismVerified) {
    throw new VisualAssetResolutionError(
      requirement.id,
      "Resolved visual did not pass realism verification.",
    );
  }
  if (requirement.labelsRequired && !candidate.labelsPresent) {
    throw new VisualAssetResolutionError(
      requirement.id,
      "Resolved visual did not pass technical-label verification.",
    );
  }
}

function toDataUri(mimeType: string, bytes: Uint8Array): string {
  return `data:${mimeType};base64,${Buffer.from(bytes).toString("base64")}`;
}

export function createBookVisualResolver(sources: readonly VisualAssetSource[]): BookVisualResolver {
  if (sources.length === 0) {
    throw new Error("At least one visual asset source is required.");
  }

  return {
    async resolve(plan: BookVisualPlan): Promise<ResolvedBookVisualBundle> {
      const visuals: ResolvedBookVisual[] = [];

      for (const requirement of plan.requirements) {
        let resolved: ResolvedBookVisual | null = null;
        let lastResolutionError: VisualAssetResolutionError | null = null;

        for (const source of sources) {
          const candidate = await source.resolve(requirement);
          if (!candidate) continue;

          try {
            assertCandidate(requirement, candidate);
            resolved = {
              ...requirement,
              assetId: candidate.assetId,
              mimeType: candidate.mimeType,
              width: candidate.width,
              height: candidate.height,
              byteLength: candidate.bytes.byteLength,
              sourceKind: candidate.sourceKind,
              provenance: candidate.provenance,
              dataUri: toDataUri(candidate.mimeType, candidate.bytes),
              realismVerified: candidate.realismVerified,
              labelsPresent: candidate.labelsPresent,
            };
            break;
          } catch (error) {
            if (error instanceof VisualAssetResolutionError) {
              lastResolutionError = error;
              continue;
            }
            throw error;
          }
        }

        if (!resolved) {
          throw (
            lastResolutionError ??
            new VisualAssetResolutionError(
              requirement.id,
              `No approved visual asset source could resolve requirement ${requirement.id}.`,
            )
          );
        }

        visuals.push(resolved);
      }

      return { bookId: plan.bookId, visuals };
    },
  };
}
