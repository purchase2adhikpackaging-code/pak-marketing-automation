import { z } from "zod";

export const ScenePlanStatusSchema = z.enum([
  "DRAFT",
  "PLANNING",
  "QC_REQUIRED",
  "REVIEW_REQUIRED",
  "APPROVED",
  "FAILED",
  "STALE",
  "SUPERSEDED",
]);

export const QcSeveritySchema = z.enum(["BLOCKER", "WARNING", "INFO"]);

const JsonObjectSchema = z.record(z.string(), z.unknown());
const StringListSchema = z.array(z.string().trim().min(1)).max(100);

export const VideoProjectInputSchema = z
  .object({
    organizationId: z.string().uuid(),
    sourceContentId: z.string().uuid(),
    sourceArtifactId: z.string().uuid(),
    sourceArtifactRevision: z.number().int().positive(),
    sourceIntegrityHash: z.string().trim().min(16),
    language: z.enum(["EN", "PL", "HI"]),
    title: z.string().trim().min(1).max(300),
    purpose: z.string().trim().max(4000).default(""),
    targetPlatforms: StringListSchema.default([]),
    aspectRatio: z.enum(["16:9", "9:16", "1:1", "4:5"]),
    targetDurationSeconds: z.number().positive().max(3600),
    qualityProfile: z.enum(["STANDARD", "PREMIUM", "CINEMATIC"]),
    audience: JsonObjectSchema.default({}),
    productionConstraints: JsonObjectSchema.default({}),
  })
  .strict();

export const VisualBibleSchema = z
  .object({
    characters: z.array(JsonObjectSchema).max(100).default([]),
    wardrobe: z.array(JsonObjectSchema).max(100).default([]),
    locations: z.array(JsonObjectSchema).max(100).default([]),
    props: z.array(JsonObjectSchema).max(100).default([]),
    palette: JsonObjectSchema.default({}),
    lightingLanguage: z.string().max(4000).default(""),
    realismLevel: z.string().max(2000).default(""),
    cinematographyLanguage: z.string().max(4000).default(""),
    logoTreatment: z.string().max(2000).default(""),
    typographyTreatment: z.string().max(2000).default(""),
    culturalConstraints: StringListSchema.default([]),
    forbiddenTraits: StringListSchema.default([]),
    globalNegativeConstraints: StringListSchema.default([]),
  })
  .strict();

export const GenerationRequirementsSchema = z
  .object({
    preserveNarration: z.boolean().default(true),
    providerNeutral: z.boolean().default(true),
    generatedDialogue: z.boolean().default(false),
    requiresReferenceImages: z.boolean().optional(),
    requiresPostProductionTextOverlay: z.boolean().optional(),
  })
  .strict();

export const ShotSchema = z
  .object({
    ordinal: z.number().int().positive(),
    durationSeconds: z.number().positive().max(600),
    narrationStartChar: z.number().int().min(0).nullable(),
    narrationEndChar: z.number().int().min(0).nullable(),
    narrationText: z.string(),
    creativeDirection: z.string().trim().min(1).max(8000),
    masterVisualPrompt: z.string().trim().min(1).max(16000),
    negativeConstraints: StringListSchema.default([]),
    subjectRefs: StringListSchema.default([]),
    locationRefs: StringListSchema.default([]),
    composition: z.string().max(4000).default(""),
    shotSize: z.string().max(1000).default(""),
    cameraAngle: z.string().max(1000).default(""),
    lensIntent: z.string().max(2000).default(""),
    cameraMotion: z.string().max(2000).default(""),
    subjectMotion: z.string().max(2000).default(""),
    environmentMotion: z.string().max(2000).default(""),
    depthOfFieldIntent: z.string().max(2000).default(""),
    lighting: z.string().max(4000).default(""),
    mood: z.string().max(2000).default(""),
    transitionIn: z.string().max(1000).default(""),
    transitionOut: z.string().max(1000).default(""),
    ambienceIntent: z.string().max(4000).default(""),
    sfxIntent: z.string().max(4000).default(""),
    musicIntent: z.string().max(4000).default(""),
    aspectRatio: z.enum(["16:9", "9:16", "1:1", "4:5"]),
    continuityState: JsonObjectSchema.default({}),
    generationRequirements: GenerationRequirementsSchema,
    humanModified: z.boolean().optional(),
  })
  .strict()
  .superRefine((shot, context) => {
    const hasStart = shot.narrationStartChar !== null;
    const hasEnd = shot.narrationEndChar !== null;

    if (hasStart !== hasEnd) {
      context.addIssue({
        code: "custom",
        message: "Narration start/end must both be present or both be null",
        path: ["narrationStartChar"],
      });
      return;
    }

    if (!hasStart && shot.narrationText.trim().length > 0) {
      context.addIssue({
        code: "custom",
        message: "Narrated shots require an exact canonical source span",
        path: ["narrationText"],
      });
    }

    if (
      hasStart &&
      shot.narrationStartChar !== null &&
      shot.narrationEndChar !== null &&
      shot.narrationEndChar < shot.narrationStartChar
    ) {
      context.addIssue({
        code: "custom",
        message: "Narration end must be greater than or equal to narration start",
        path: ["narrationEndChar"],
      });
    }
  });

export const SceneSchema = z
  .object({
    ordinal: z.number().int().positive(),
    title: z.string().trim().min(1).max(300),
    narrativeRole: z.enum(["HOOK", "SETUP", "EXPLANATION", "PROOF", "TRANSITION", "CTA", "OTHER"]),
    durationSeconds: z.number().positive().max(3600),
    narrationText: z.string().optional(),
    narrationStartChar: z.number().int().min(0).nullable().optional(),
    narrationEndChar: z.number().int().min(0).nullable().optional(),
    narrativeObjective: z.string().max(4000).optional(),
    emotionalObjective: z.string().max(4000).optional(),
    creativeDirection: z.string().trim().min(1).max(8000),
    continuityContext: JsonObjectSchema.default({}),
    shots: z.array(ShotSchema).min(1).max(200),
  })
  .strict()
  .superRefine((scene, context) => {
    const ordinals = scene.shots.map((shot) => shot.ordinal);
    if (new Set(ordinals).size !== ordinals.length) {
      context.addIssue({
        code: "custom",
        message: "Shot ordinals must be unique within a scene",
        path: ["shots"],
      });
    }
  });

export const ScenePlanGenerationSchema = z
  .object({
    scenes: z.array(SceneSchema).min(1).max(200),
  })
  .strict()
  .superRefine((plan, context) => {
    const ordinals = plan.scenes.map((scene) => scene.ordinal);
    if (new Set(ordinals).size !== ordinals.length) {
      context.addIssue({
        code: "custom",
        message: "Scene ordinals must be unique",
        path: ["scenes"],
      });
    }
  });

export const QcFindingSchema = z
  .object({
    severity: QcSeveritySchema,
    code: z.string().trim().min(1).max(200),
    message: z.string().trim().min(1).max(8000),
    sceneOrdinal: z.number().int().positive().optional(),
    shotOrdinal: z.number().int().positive().optional(),
  })
  .strict();

export type VideoProjectInput = z.infer<typeof VideoProjectInputSchema>;
export type VisualBible = z.infer<typeof VisualBibleSchema>;
export type ScenePlanGeneration = z.infer<typeof ScenePlanGenerationSchema>;
export type Scene = z.infer<typeof SceneSchema>;
export type Shot = z.infer<typeof ShotSchema>;
export type QcFinding = z.infer<typeof QcFindingSchema>;
export type ScenePlanStatus = z.infer<typeof ScenePlanStatusSchema>;
