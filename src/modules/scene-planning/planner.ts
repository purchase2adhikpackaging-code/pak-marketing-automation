import { AppError } from "@/lib/errors/app-error";
import type { TextGenerationProvider } from "@/modules/ai/text/provider";
import { ScenePlanGenerationSchema, type ScenePlanGeneration } from "./schema";

export type ScenePlannerModel = "gpt-5.6-terra" | "gpt-5.6-luna";

export interface ScenePlannerInput {
  canonicalNarration: string;
  language: "EN" | "PL" | "HI";
  targetDurationSeconds: number;
  aspectRatio: string;
  qualityProfile: "STANDARD" | "PREMIUM" | "CINEMATIC" | string;
  targetPlatforms: string[];
  productionConstraints?: string[];
  visualBible: Record<string, unknown>;
  replan?: {
    scope: "SHOT" | "SCENE";
    targetSceneOrdinal: number;
    targetShotOrdinal?: number;
    preserveHumanModifiedShots?: boolean;
    currentPlanContext?: unknown;
  };
}

export interface ScenePlannerRequest {
  model: ScenePlannerModel;
  responseFormat: { type: "json_object" };
  prompt: string;
}

export type GenerateScenePlanOptions = {
  input: ScenePlannerInput;
  provider: TextGenerationProvider;
  model?: ScenePlannerModel;
  idempotencyKey?: string;
};

export type GenerateScenePlanResult = {
  plan: ScenePlanGeneration;
  provider: string;
  model: string;
};

export function selectScenePlannerModel(model?: string): ScenePlannerModel {
  if (!model) return "gpt-5.6-terra";
  if (model === "gpt-5.6-terra" || model === "gpt-5.6-luna") return model;
  throw new AppError("VALIDATION_ERROR", `Scene planner model ${model} is not allowed.`);
}

function stableJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

export function buildScenePlannerRequest(
  input: ScenePlannerInput,
  model?: ScenePlannerModel,
): ScenePlannerRequest {
  const selectedModel = selectScenePlannerModel(model);
  const replanBlock = input.replan
    ? `\nREPLAN_SCOPE: ${input.replan.scope}\nTARGET_SCENE_ORDINAL: ${input.replan.targetSceneOrdinal}${
        input.replan.targetShotOrdinal ? `\nTARGET_SHOT_ORDINAL: ${input.replan.targetShotOrdinal}` : ""
      }\n${
        input.replan.preserveHumanModifiedShots
          ? "Do not overwrite human-modified shots. Preserve them exactly unless the explicit target is one of those shots."
          : ""
      }\nCURRENT_PLAN_CONTEXT:\n${stableJson(input.replan.currentPlanContext ?? {})}\n`
    : "";

  const prompt = `You are the Scene Planning Director for an international-standard institutional video production system.

NON-NEGOTIABLE NARRATION RULE
DO NOT rewrite, paraphrase, shorten, expand, translate, or invent narration.
The canonical narration below is authoritative. Every narrated shot must point to an exact [start,end) character range using narrationStartChar and narrationEndChar, and narrationText must be byte-for-byte equivalent to that source slice.
Silent/B-roll shots must use null narrationStartChar and narrationEndChar with an empty narrationText.

PLANNING MODEL
- Scene = narrative unit.
- Shot = generation unit.
- Scene boundaries follow meaning; shot boundaries follow camera/action changes.
- Prefer adaptive 5-10 second shots unless creative pacing needs otherwise.
- Remain provider-neutral. Do not emit provider execution metadata, external job identifiers, URLs, or vendor-specific request objects.
- Preserve continuity of recurring people, wardrobe, locations, props, lighting, screen direction, camera grammar, and prior-shot action state.
- No unsupported factual claims. Grounding already happened upstream; you are directing visuals, not rewriting facts.
- No provider-generated substitute dialogue. Canonical narration remains the spoken authority.
- Treat complex logos and typography as post-production overlays unless the brief explicitly says otherwise.

OUTPUT REQUIREMENTS
Return strict JSON only. The top-level object must contain scenes[]. Every scene must contain:
- ordinal
- title
- narrativeRole
- durationSeconds
- creativeDirection
- continuityContext
- shots[]

Every shot must contain at minimum:
- ordinal
- durationSeconds
- narrationStartChar
- narrationEndChar
- narrationText
- creativeDirection
- masterVisualPrompt
- negativeConstraints
- subjectRefs
- locationRefs
- composition
- shotSize
- cameraAngle
- lensIntent
- cameraMotion
- subjectMotion
- environmentMotion
- depthOfFieldIntent
- lighting
- mood
- transitionIn
- transitionOut
- ambienceIntent
- sfxIntent
- musicIntent
- aspectRatio
- continuityState
- generationRequirements

creativeDirection explains why the shot exists in the film. masterVisualPrompt is the detailed provider-neutral generation specification. Keep them separate.

generationRequirements must always preserve narration and remain provider-neutral.

PRODUCTION BRIEF
LANGUAGE: ${input.language}
TARGET_DURATION_SECONDS: ${input.targetDurationSeconds}
ASPECT_RATIO: ${input.aspectRatio}
QUALITY_PROFILE: ${input.qualityProfile}
TARGET_PLATFORMS: ${input.targetPlatforms.join(", ")}
PRODUCTION_CONSTRAINTS:
${stableJson(input.productionConstraints ?? [])}

VISUAL_BIBLE:
${stableJson(input.visualBible)}
${replanBlock}
CANONICAL_NARRATION_BEGIN
${input.canonicalNarration}
CANONICAL_NARRATION_END
`;

  return {
    model: selectedModel,
    responseFormat: { type: "json_object" },
    prompt,
  };
}

export async function generateScenePlan({
  input,
  provider,
  model,
  idempotencyKey,
}: GenerateScenePlanOptions): Promise<GenerateScenePlanResult> {
  const request = buildScenePlannerRequest(input, model);
  await provider.validateConfiguration();

  const result = await provider.generate({
    topic: "Generate a provider-neutral Scene Planning JSON document for the approved canonical narration.",
    language: input.language,
    systemInstructions: request.prompt,
    idempotencyKey:
      idempotencyKey ??
      `scene-plan:${request.model}:${input.language}:${input.targetDurationSeconds}:${input.canonicalNarration.length}`,
  });

  let parsed: unknown;
  try {
    parsed = JSON.parse(result.text);
  } catch {
    throw new AppError("PROVIDER_ERROR", "Planner did not return valid Scene Planning JSON.");
  }

  const validated = ScenePlanGenerationSchema.safeParse(parsed);
  if (!validated.success) {
    throw new AppError("PROVIDER_ERROR", "Planner response failed the Scene Planning schema.");
  }

  return {
    plan: validated.data,
    provider: result.provider,
    model: result.model,
  };
}
