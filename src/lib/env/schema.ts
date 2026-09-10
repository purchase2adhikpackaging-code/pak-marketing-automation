import { z } from "zod";

const publicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
});

const optionalTrimmedString = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.string().trim().min(1).optional(),
);

const serverEnvSchema = publicEnvSchema
  .extend({
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
    INTEGRATION_VAULT_ENCRYPTION_KEY: optionalTrimmedString,
    OPENAI_API_KEY: optionalTrimmedString,
    LTX_WORKER_SHARED_SECRET: z.string().min(1),
    AI_TEXT_PROVIDER: z.enum(["fake", "openai"]).default("fake"),
    OPENAI_TEXT_MODEL: optionalTrimmedString,
  })
  .superRefine((env, ctx) => {
    if (env.AI_TEXT_PROVIDER === "openai" && !env.OPENAI_API_KEY) {
      ctx.addIssue({
        code: "custom",
        path: ["OPENAI_API_KEY"],
        message: "OPENAI_API_KEY is required when AI_TEXT_PROVIDER=openai until vault runtime resolution is enabled",
      });
    }
  });

export type PublicEnv = z.infer<typeof publicEnvSchema>;
export type ServerEnv = z.infer<typeof serverEnvSchema>;

export function parsePublicEnv(input: unknown): PublicEnv {
  return publicEnvSchema.parse(input);
}

export function parseServerEnv(input: unknown): ServerEnv {
  return serverEnvSchema.parse(input);
}
