import { z } from "zod";
import { APPROVAL_DECISIONS, APPROVAL_TARGET_TYPES } from "./types";

const MAX_PUBLICATION_INTENT_BYTES = 8 * 1024;
const MAX_DECISION_COMMENT_LENGTH = 2_000;

export const approvalTargetTypeSchema = z.enum(APPROVAL_TARGET_TYPES);
export const approvalDecisionSchema = z.enum(APPROVAL_DECISIONS);

const publicationIntentSchema = z
  .record(z.string(), z.unknown())
  .refine(
    (value) => new TextEncoder().encode(JSON.stringify(value)).byteLength <= MAX_PUBLICATION_INTENT_BYTES,
    "Publication intent must not exceed 8 KiB.",
  );

export const submitApprovalInputSchema = z
  .object({
    organizationId: z.string().uuid(),
    targetType: approvalTargetTypeSchema,
    targetId: z.string().uuid(),
    publicationIntent: publicationIntentSchema.optional(),
  })
  .strict();

export const decideApprovalInputSchema = z
  .object({
    organizationId: z.string().uuid(),
    requestId: z.string().uuid(),
    decision: approvalDecisionSchema,
    comment: z.string().trim().max(MAX_DECISION_COMMENT_LENGTH).optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if ((value.decision === "REQUEST_CHANGES" || value.decision === "REJECT") && !value.comment) {
      context.addIssue({
        code: "custom",
        path: ["comment"],
        message: "A comment is required for this decision.",
      });
    }
  });

export type SubmitApprovalInputSchema = z.infer<typeof submitApprovalInputSchema>;
export type DecideApprovalInputSchema = z.infer<typeof decideApprovalInputSchema>;
