import type { QaFinding } from "./domain";
import type { BookVisualPlan, ResolvedBookVisualBundle } from "./visual-production";
import { validateResolvedBookVisualBundle } from "./visual-production";

export interface RunVisualQaInput {
  plan: BookVisualPlan;
  bundle: ResolvedBookVisualBundle;
  html: string;
}

function finding(
  defectClass: string,
  message: string,
  componentId?: string,
): QaFinding {
  return {
    id: `visual-${defectClass.toLowerCase()}-${componentId ?? "book"}`,
    gate: "visual-assets",
    defectClass,
    severity: "error",
    message,
    ...(componentId ? { componentId } : {}),
    detector: "publishing-visual-qa",
    repairable: true,
  };
}

export function runVisualQa(input: RunVisualQaInput): QaFinding[] {
  const { plan, bundle, html } = input;
  const findings: QaFinding[] = [];
  const frontCovers = bundle.visuals.filter((visual) => visual.placement === "front-cover");
  const backCovers = bundle.visuals.filter((visual) => visual.placement === "back-cover");

  if (frontCovers.length !== 1) {
    findings.push(
      finding(
        "VISUAL_FRONT_COVER_MISSING",
        "A releasable textbook requires exactly one resolved realistic front-cover image.",
      ),
    );
  }
  if (backCovers.length !== 1) {
    findings.push(
      finding(
        "VISUAL_BACK_COVER_MISSING",
        "A releasable textbook requires exactly one resolved realistic back-cover image.",
      ),
    );
  }

  const chapterIds = new Set(
    plan.requirements
      .map((requirement) => requirement.chapterId)
      .filter((chapterId): chapterId is string => Boolean(chapterId)),
  );
  for (const chapterId of chapterIds) {
    if (!bundle.visuals.some((visual) => visual.chapterId === chapterId)) {
      findings.push(
        finding(
          "VISUAL_CHAPTER_COVERAGE_MISSING",
          `Chapter ${chapterId} has no resolved pedagogically relevant visual.`,
          chapterId,
        ),
      );
    }
  }

  for (const visual of bundle.visuals) {
    if (visual.labelsRequired && !visual.labelsPresent) {
      findings.push(
        finding(
          "VISUAL_LABELS_MISSING",
          `Technical visual ${visual.id} requires verified labels before release.`,
          visual.id,
        ),
      );
    }
    if (!html.includes(`data-visual-id="${visual.id}"`)) {
      findings.push(
        finding(
          "VISUAL_HTML_MISSING",
          `Resolved visual ${visual.id} is missing from serialized textbook HTML.`,
          visual.id,
        ),
      );
    }
  }

  const structuralFindings = validateResolvedBookVisualBundle(plan, bundle);
  for (const message of structuralFindings) {
    const isCoverOrCoverage =
      /front cover|back cover|chapter .* no resolved|required visual is unresolved/i.test(message);
    const isLabels = /requires technical labels/i.test(message);
    if (isCoverOrCoverage || isLabels) continue;
    findings.push(finding("VISUAL_ASSET_INVALID", message));
  }

  return findings.filter(
    (current, index, all) =>
      all.findIndex(
        (candidate) =>
          candidate.defectClass === current.defectClass &&
          candidate.componentId === current.componentId &&
          candidate.message === current.message,
      ) === index,
  );
}
