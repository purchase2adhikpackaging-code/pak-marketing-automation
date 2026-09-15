import type { BookBlueprint } from "./blueprint";
import type { BookManuscript } from "./manuscript-domain";

export type BookVisualPlacement =
  | "front-cover"
  | "back-cover"
  | "chapter-opener"
  | "technical-diagram"
  | "practical-photo"
  | "case-study-photo";

export type BookVisualSourceKind = "generated" | "approved-library" | "licensed-source";
export type SupportedBookVisualMimeType = "image/jpeg" | "image/png" | "image/webp";

export interface BookVisualRequirement {
  id: string;
  placement: BookVisualPlacement;
  chapterId?: string;
  subjectPrompt: string;
  caption: string;
  altText: string;
  realistic: boolean;
  labelsRequired: boolean;
}

export interface BookVisualPlan {
  bookId: string;
  requirements: BookVisualRequirement[];
}

export interface ResolvedBookVisual extends BookVisualRequirement {
  assetId: string;
  mimeType: SupportedBookVisualMimeType | string;
  width: number;
  height: number;
  byteLength: number;
  sourceKind: BookVisualSourceKind;
  provenance: string;
  dataUri: string;
  realismVerified: boolean;
  labelsPresent: boolean;
}

export interface ResolvedBookVisualBundle {
  bookId: string;
  visuals: ResolvedBookVisual[];
}

const SUPPORTED_MIME_TYPES = new Set<SupportedBookVisualMimeType>([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const PLACEHOLDER_PATTERN = /\b(?:placeholder|sample image|dummy image|todo|tbd|insert image)\b/i;

function slug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function coverRequirement(
  manuscript: BookManuscript,
  placement: "front-cover" | "back-cover",
): BookVisualRequirement {
  const front = placement === "front-cover";
  return {
    id: `${placement}-${slug(manuscript.subjectCode)}`,
    placement,
    subjectPrompt: front
      ? `Photorealistic premium railway textbook front cover for ${manuscript.subjectCode} ${manuscript.subjectTitle}, Polish Railway Academy, European railway environment, technically credible rolling stock, clean academic composition, no invented logos or text.`
      : `Photorealistic premium railway textbook back cover for ${manuscript.subjectCode} ${manuscript.subjectTitle}, Polish Railway Academy, coherent European railway environment matching the front cover, clean institutional composition, no invented logos or text.`,
    caption: front
      ? `${manuscript.subjectTitle} — front cover`
      : `${manuscript.subjectTitle} — back cover`,
    altText: front
      ? `Front cover railway photograph for ${manuscript.subjectTitle}`
      : `Back cover railway photograph for ${manuscript.subjectTitle}`,
    realistic: true,
    labelsRequired: false,
  };
}

function chapterRequirements(
  manuscript: BookManuscript,
  blueprint: BookBlueprint,
): BookVisualRequirement[] {
  const chapterById = new Map(blueprint.chapters.map((chapter) => [chapter.id, chapter]));
  const requirements: BookVisualRequirement[] = [];

  for (const chapter of manuscript.chapters) {
    const blueprintChapter = chapterById.get(chapter.chapterId);
    if (!blueprintChapter) continue;

    for (const visualId of blueprintChapter.requiredVisualIds) {
      requirements.push({
        id: `technical-${slug(chapter.chapterId)}-${slug(visualId)}`,
        placement: "technical-diagram",
        chapterId: chapter.chapterId,
        subjectPrompt: `Technically accurate railway educational visual for ${chapter.title}: ${visualId}. Show the real component or system in a realistic engineering context with clear, correct labels suitable for a diploma textbook.`,
        caption: `${chapter.title}: ${visualId}`,
        altText: `Labeled technical railway visual showing ${visualId} for ${chapter.title}`,
        realistic: true,
        labelsRequired: true,
      });
    }

    if (blueprintChapter.practicalRequirements.length > 0 || chapter.practicalActivities.length > 0) {
      requirements.push({
        id: `practical-${slug(chapter.chapterId)}`,
        placement: "practical-photo",
        chapterId: chapter.chapterId,
        subjectPrompt: `Photorealistic railway workshop or field training scene for ${chapter.title}, showing safe professional practice, authentic railway equipment, PPE where appropriate, European training environment, no staged stock-photo look.`,
        caption: `${chapter.title} — practical application`,
        altText: `Realistic railway practical training scene for ${chapter.title}`,
        realistic: true,
        labelsRequired: false,
      });
    }

    if (!requirements.some((requirement) => requirement.chapterId === chapter.chapterId)) {
      requirements.push({
        id: `chapter-opener-${slug(chapter.chapterId)}`,
        placement: "chapter-opener",
        chapterId: chapter.chapterId,
        subjectPrompt: `Photorealistic chapter-opening railway image for ${chapter.title}, directly illustrating the chapter subject in an authentic European railway setting, educational rather than decorative.`,
        caption: chapter.title,
        altText: `Realistic railway scene introducing ${chapter.title}`,
        realistic: true,
        labelsRequired: false,
      });
    }
  }

  return requirements;
}

export function createBookVisualPlan(
  manuscript: BookManuscript,
  blueprint: BookBlueprint,
): BookVisualPlan {
  if (manuscript.bookId !== blueprint.bookId) {
    throw new Error(
      `Cannot create visual plan for mismatched book ids: ${manuscript.bookId} vs ${blueprint.bookId}.`,
    );
  }

  return {
    bookId: manuscript.bookId,
    requirements: [
      coverRequirement(manuscript, "front-cover"),
      ...chapterRequirements(manuscript, blueprint),
      coverRequirement(manuscript, "back-cover"),
    ],
  };
}

function isCover(visual: BookVisualRequirement): boolean {
  return visual.placement === "front-cover" || visual.placement === "back-cover";
}

function hasRequiredResolution(visual: ResolvedBookVisual): boolean {
  if (!Number.isFinite(visual.width) || !Number.isFinite(visual.height)) return false;
  if (visual.width <= 0 || visual.height <= 0) return false;
  if (isCover(visual)) {
    return visual.width >= 1600 && visual.height >= 2400;
  }
  return Math.max(visual.width, visual.height) >= 1200;
}

export function validateResolvedBookVisualBundle(
  plan: BookVisualPlan,
  bundle: ResolvedBookVisualBundle,
): string[] {
  const findings: string[] = [];

  if (bundle.bookId !== plan.bookId) {
    findings.push(`Visual bundle book id mismatch: expected ${plan.bookId}, received ${bundle.bookId}.`);
  }

  const plannedIds = new Set(plan.requirements.map((requirement) => requirement.id));
  const resolvedById = new Map(bundle.visuals.map((visual) => [visual.id, visual]));

  for (const requirement of plan.requirements) {
    if (!resolvedById.has(requirement.id)) {
      findings.push(`Required visual is unresolved: ${requirement.id}.`);
    }
  }

  for (const visual of bundle.visuals) {
    if (!plannedIds.has(visual.id)) {
      findings.push(`Resolved visual was not present in the plan: ${visual.id}.`);
    }

    if (!SUPPORTED_MIME_TYPES.has(visual.mimeType as SupportedBookVisualMimeType)) {
      findings.push(`Unsupported visual MIME type for ${visual.id}: ${visual.mimeType}.`);
    }
    if (!hasRequiredResolution(visual)) {
      findings.push(`Visual ${visual.id} does not meet minimum print resolution.`);
    }
    if (!Number.isFinite(visual.byteLength) || visual.byteLength < 1024) {
      findings.push(`Visual ${visual.id} has an invalid or trivial byte length.`);
    }
    if (!visual.assetId.trim()) findings.push(`Visual ${visual.id} is missing asset identity.`);
    if (!visual.caption.trim()) findings.push(`Visual ${visual.id} is missing a caption.`);
    if (!visual.altText.trim()) findings.push(`Visual ${visual.id} is missing alt text.`);
    if (!visual.provenance.trim()) findings.push(`Visual ${visual.id} is missing provenance.`);
    if (visual.realistic && !visual.realismVerified) {
      findings.push(`Visual ${visual.id} requires realism verification but did not pass it.`);
    }
    if (visual.labelsRequired && !visual.labelsPresent) {
      findings.push(`Visual ${visual.id} requires technical labels but none were verified.`);
    }
    if (!visual.dataUri.startsWith(`data:${visual.mimeType};base64,`)) {
      findings.push(`Visual ${visual.id} is not embedded as a renderer-safe data URI.`);
    }
    if (
      PLACEHOLDER_PATTERN.test(visual.assetId) ||
      PLACEHOLDER_PATTERN.test(visual.caption) ||
      PLACEHOLDER_PATTERN.test(visual.altText) ||
      PLACEHOLDER_PATTERN.test(visual.provenance)
    ) {
      findings.push(`Visual ${visual.id} contains placeholder metadata.`);
    }
  }

  const frontCovers = bundle.visuals.filter((visual) => visual.placement === "front-cover");
  const backCovers = bundle.visuals.filter((visual) => visual.placement === "back-cover");
  if (frontCovers.length !== 1) findings.push("Exactly one resolved front cover is required.");
  if (backCovers.length !== 1) findings.push("Exactly one resolved back cover is required.");

  const chapterIds = new Set(
    plan.requirements.map((requirement) => requirement.chapterId).filter((id): id is string => Boolean(id)),
  );
  for (const chapterId of chapterIds) {
    if (!bundle.visuals.some((visual) => visual.chapterId === chapterId)) {
      findings.push(`Chapter ${chapterId} has no resolved pedagogical visual.`);
    }
  }

  return [...new Set(findings)];
}
