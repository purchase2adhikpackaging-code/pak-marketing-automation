export type QcSeverity = "BLOCKER" | "WARNING" | "INFO";

export interface QcFinding {
  severity: QcSeverity;
  code: string;
  message: string;
  sceneOrdinal?: number;
  shotOrdinal?: number;
}

export interface GenerationRequirements {
  preserveNarration?: boolean;
  providerNeutral?: boolean;
  generatedDialogue?: boolean;
}

export interface ScenePlanShot {
  ordinal: number;
  durationSeconds: number;
  narrationStartChar: number | null;
  narrationEndChar: number | null;
  narrationText: string;
  creativeDirection: string;
  masterVisualPrompt: string;
  aspectRatio: string;
  subjectRefs?: string[];
  locationRefs?: string[];
  cameraMotion?: string;
  generationRequirements?: GenerationRequirements;
}

export interface ScenePlanScene {
  ordinal: number;
  durationSeconds: number;
  creativeDirection: string;
  shots: ScenePlanShot[];
}

export interface ScenePlanQcInput {
  canonicalNarration: string;
  currentSourceIntegrityHash: string;
  planSourceIntegrityHash: string;
  targetDurationSeconds: number;
  durationToleranceSeconds?: number;
  expectedAspectRatio: string;
  availableReferences?: string[];
  scenes: ScenePlanScene[];
}

export interface ScenePlanQcResult {
  stale: boolean;
  totalDurationSeconds: number;
  narrationCoveragePercent: number;
  findings: QcFinding[];
}

const STATIC_CAMERA_TERMS = /\b(static|locked|tripod|stationary)\b/i;
const MOVING_CAMERA_TERMS = /\b(dolly|orbit|pan|tilt|track|tracking|handheld|crane|push[- ]?in|pull[- ]?out)\b/i;

function normalizeIdea(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function round(value: number, digits = 2): number {
  const power = 10 ** digits;
  return Math.round(value * power) / power;
}

export function runScenePlanQc(input: ScenePlanQcInput): ScenePlanQcResult {
  const findings: QcFinding[] = [];
  const stale = input.currentSourceIntegrityHash !== input.planSourceIntegrityHash;

  if (stale) {
    findings.push({
      severity: "BLOCKER",
      code: "SOURCE_STALE",
      message: "The source artifact has changed since this plan version was created.",
    });
  }

  const availableReferences = new Set(input.availableReferences ?? []);
  let totalDurationSeconds = 0;
  const narrationSpans: Array<{
    start: number;
    end: number;
    sceneOrdinal: number;
    shotOrdinal: number;
  }> = [];
  let previousVisualIdea: string | null = null;

  input.scenes.forEach((scene, sceneIndex) => {
    const expectedSceneOrdinal = sceneIndex + 1;
    if (scene.ordinal !== expectedSceneOrdinal) {
      findings.push({
        severity: "BLOCKER",
        code: "SCENE_ORDER_INVALID",
        message: `Scene ordinal ${scene.ordinal} should be ${expectedSceneOrdinal}.`,
        sceneOrdinal: scene.ordinal,
      });
    }

    const sceneShotDuration = scene.shots.reduce((sum, shot) => sum + shot.durationSeconds, 0);
    totalDurationSeconds += sceneShotDuration;
    if (Math.abs(scene.durationSeconds - sceneShotDuration) > 0.05) {
      findings.push({
        severity: "BLOCKER",
        code: "SCENE_DURATION_MISMATCH",
        message: `Scene duration ${scene.durationSeconds}s does not equal its shot total ${round(sceneShotDuration)}s.`,
        sceneOrdinal: scene.ordinal,
      });
    }

    scene.shots.forEach((shot, shotIndex) => {
      const expectedShotOrdinal = shotIndex + 1;
      if (shot.ordinal !== expectedShotOrdinal) {
        findings.push({
          severity: "BLOCKER",
          code: "SHOT_ORDER_INVALID",
          message: `Shot ordinal ${shot.ordinal} should be ${expectedShotOrdinal} within scene ${scene.ordinal}.`,
          sceneOrdinal: scene.ordinal,
          shotOrdinal: shot.ordinal,
        });
      }

      if (!(shot.durationSeconds > 0)) {
        findings.push({
          severity: "BLOCKER",
          code: "SHOT_DURATION_INVALID",
          message: "Shot duration must be greater than zero.",
          sceneOrdinal: scene.ordinal,
          shotOrdinal: shot.ordinal,
        });
      }

      if (!shot.creativeDirection.trim()) {
        findings.push({
          severity: "BLOCKER",
          code: "MISSING_CREATIVE_DIRECTION",
          message: "Shot creative direction is required.",
          sceneOrdinal: scene.ordinal,
          shotOrdinal: shot.ordinal,
        });
      }

      if (!shot.masterVisualPrompt.trim()) {
        findings.push({
          severity: "BLOCKER",
          code: "MISSING_VISUAL_PROMPT",
          message: "Provider-neutral master visual prompt is required.",
          sceneOrdinal: scene.ordinal,
          shotOrdinal: shot.ordinal,
        });
      }

      if (shot.aspectRatio !== input.expectedAspectRatio) {
        findings.push({
          severity: "BLOCKER",
          code: "ASPECT_RATIO_MISMATCH",
          message: `Shot aspect ratio ${shot.aspectRatio} does not match project ratio ${input.expectedAspectRatio}.`,
          sceneOrdinal: scene.ordinal,
          shotOrdinal: shot.ordinal,
        });
      }

      const references = [...(shot.subjectRefs ?? []), ...(shot.locationRefs ?? [])];
      const missingRefs = references.filter((reference) => !availableReferences.has(reference));
      if (missingRefs.length > 0) {
        findings.push({
          severity: "BLOCKER",
          code: "UNRESOLVED_REFERENCE",
          message: `Unresolved visual references: ${missingRefs.join(", ")}.`,
          sceneOrdinal: scene.ordinal,
          shotOrdinal: shot.ordinal,
        });
      }

      const cameraMotion = shot.cameraMotion ?? "";
      if (STATIC_CAMERA_TERMS.test(cameraMotion) && MOVING_CAMERA_TERMS.test(cameraMotion)) {
        findings.push({
          severity: "WARNING",
          code: "CAMERA_MOTION_CONFLICT",
          message: "Camera instructions combine static and moving directions; review before generation.",
          sceneOrdinal: scene.ordinal,
          shotOrdinal: shot.ordinal,
        });
      }

      const currentVisualIdea = normalizeIdea(shot.creativeDirection);
      if (previousVisualIdea && currentVisualIdea && previousVisualIdea === currentVisualIdea) {
        findings.push({
          severity: "WARNING",
          code: "DUPLICATE_VISUAL_IDEA",
          message: "Consecutive shots repeat the same creative direction.",
          sceneOrdinal: scene.ordinal,
          shotOrdinal: shot.ordinal,
        });
      }
      if (currentVisualIdea) previousVisualIdea = currentVisualIdea;

      if (shot.generationRequirements?.generatedDialogue === true) {
        findings.push({
          severity: "BLOCKER",
          code: "GENERATED_DIALOGUE_NOT_ALLOWED",
          message: "Video providers may not invent spoken dialogue outside the canonical narration.",
          sceneOrdinal: scene.ordinal,
          shotOrdinal: shot.ordinal,
        });
      }

      const start = shot.narrationStartChar;
      const end = shot.narrationEndChar;
      const hasSpan = start !== null || end !== null;
      if (hasSpan) {
        if (start === null || end === null || start < 0 || end < start || end > input.canonicalNarration.length) {
          findings.push({
            severity: "BLOCKER",
            code: "NARRATION_SPAN_INVALID",
            message: "Narration source span is invalid.",
            sceneOrdinal: scene.ordinal,
            shotOrdinal: shot.ordinal,
          });
        } else {
          const canonicalSlice = input.canonicalNarration.slice(start, end);
          if (shot.narrationText !== canonicalSlice) {
            findings.push({
              severity: "BLOCKER",
              code: "NARRATION_REWRITTEN",
              message: "Shot narration does not exactly match the canonical source span.",
              sceneOrdinal: scene.ordinal,
              shotOrdinal: shot.ordinal,
            });
          }
          narrationSpans.push({ start, end, sceneOrdinal: scene.ordinal, shotOrdinal: shot.ordinal });
        }
      } else if (shot.narrationText.trim()) {
        findings.push({
          severity: "BLOCKER",
          code: "NARRATION_SPAN_MISSING",
          message: "Narrated shot must reference an exact canonical source span.",
          sceneOrdinal: scene.ordinal,
          shotOrdinal: shot.ordinal,
        });
      }
    });
  });

  narrationSpans.sort((left, right) => left.start - right.start || left.end - right.end);
  let cursor = 0;
  for (const span of narrationSpans) {
    if (span.start > cursor) {
      const gap = input.canonicalNarration.slice(cursor, span.start);
      if (/\S/.test(gap)) {
        findings.push({
          severity: "BLOCKER",
          code: "NARRATION_GAP",
          message: `Canonical narration has an uncovered range at characters ${cursor}-${span.start}.`,
          sceneOrdinal: span.sceneOrdinal,
          shotOrdinal: span.shotOrdinal,
        });
      }
    }
    if (span.start < cursor) {
      findings.push({
        severity: "BLOCKER",
        code: "NARRATION_OVERLAP",
        message: `Narration span overlaps a previous shot at character ${span.start}.`,
        sceneOrdinal: span.sceneOrdinal,
        shotOrdinal: span.shotOrdinal,
      });
    }
    cursor = Math.max(cursor, span.end);
  }

  if (cursor < input.canonicalNarration.length) {
    const trailing = input.canonicalNarration.slice(cursor);
    if (/\S/.test(trailing)) {
      findings.push({
        severity: "BLOCKER",
        code: "NARRATION_GAP",
        message: `Canonical narration has an uncovered trailing range at characters ${cursor}-${input.canonicalNarration.length}.`,
      });
    }
  }

  const significantPositions = Array.from(input.canonicalNarration, (character) => /\S/.test(character));
  const coveredPositions = new Array(input.canonicalNarration.length).fill(false) as boolean[];
  for (const span of narrationSpans) {
    const start = Math.max(0, span.start);
    const end = Math.min(input.canonicalNarration.length, span.end);
    for (let index = start; index < end; index += 1) coveredPositions[index] = true;
  }

  const significantCount = significantPositions.filter(Boolean).length;
  const coveredSignificantCount = significantPositions.reduce(
    (count, significant, index) => count + (significant && coveredPositions[index] ? 1 : 0),
    0,
  );
  const narrationCoveragePercent =
    significantCount === 0 ? 100 : round((coveredSignificantCount / significantCount) * 100);

  const tolerance = input.durationToleranceSeconds ?? Math.max(1, input.targetDurationSeconds * 0.05);
  const targetDelta = Math.abs(totalDurationSeconds - input.targetDurationSeconds);
  if (targetDelta > tolerance) {
    findings.push({
      severity: "WARNING",
      code: "TARGET_DURATION_MISMATCH",
      message: `Planned runtime ${round(totalDurationSeconds)}s differs from target ${input.targetDurationSeconds}s by ${round(targetDelta)}s.`,
    });
  }

  return {
    stale,
    totalDurationSeconds: round(totalDurationSeconds),
    narrationCoveragePercent,
    findings,
  };
}
