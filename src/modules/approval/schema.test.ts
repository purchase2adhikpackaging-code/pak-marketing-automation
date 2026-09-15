import { describe, expect, it } from "vitest";

const schemaModulePath = "./schema";

async function loadSchema() {
  return import(schemaModulePath) as Promise<{
    approvalDecisionSchema: { safeParse(value: unknown): { success: boolean } };
    approvalTargetTypeSchema: { safeParse(value: unknown): { success: boolean } };
    decideApprovalInputSchema: {
      safeParse(value: unknown): { success: boolean; data?: { comment?: string } };
    };
    submitApprovalInputSchema: { safeParse(value: unknown): { success: boolean } };
  }>;
}

describe("Approval Center input contracts", () => {
  it("accepts only the two Phase 9 generic target types", async () => {
    const { approvalTargetTypeSchema } = await loadSchema();

    expect(approvalTargetTypeSchema.safeParse("CONTENT_ARTIFACT").success).toBe(true);
    expect(approvalTargetTypeSchema.safeParse("MEDIA_ASSET").success).toBe(true);
    expect(approvalTargetTypeSchema.safeParse("SCENE_PLAN_VERSION").success).toBe(false);
  });

  it("accepts only explicit approval decisions", async () => {
    const { approvalDecisionSchema } = await loadSchema();

    expect(approvalDecisionSchema.safeParse("APPROVE").success).toBe(true);
    expect(approvalDecisionSchema.safeParse("REQUEST_CHANGES").success).toBe(true);
    expect(approvalDecisionSchema.safeParse("REJECT").success).toBe(true);
    expect(approvalDecisionSchema.safeParse("SUPERSEDE").success).toBe(false);
  });

  it("accepts bounded object publication intent and rejects non-object or oversized context", async () => {
    const { submitApprovalInputSchema } = await loadSchema();
    const base = {
      organizationId: "932a5898-a85f-4ba6-b571-66d6fe8cd9e8",
      targetType: "CONTENT_ARTIFACT",
      targetId: "1a575e22-ebb8-48d5-9167-d3eb26f8462a",
    };

    expect(
      submitApprovalInputSchema.safeParse({ ...base, publicationIntent: { channel: "META", placement: "FEED" } }).success,
    ).toBe(true);
    expect(submitApprovalInputSchema.safeParse({ ...base, publicationIntent: [] }).success).toBe(false);
    expect(submitApprovalInputSchema.safeParse({ ...base, publicationIntent: "META" }).success).toBe(false);
    expect(
      submitApprovalInputSchema.safeParse({ ...base, publicationIntent: { note: "x".repeat(8_300) } }).success,
    ).toBe(false);
  });

  it("requires a trimmed non-empty comment for request-changes and reject", async () => {
    const { decideApprovalInputSchema } = await loadSchema();
    const base = {
      organizationId: "932a5898-a85f-4ba6-b571-66d6fe8cd9e8",
      requestId: "1a575e22-ebb8-48d5-9167-d3eb26f8462a",
    };

    expect(decideApprovalInputSchema.safeParse({ ...base, decision: "REQUEST_CHANGES", comment: "   " }).success).toBe(false);
    expect(decideApprovalInputSchema.safeParse({ ...base, decision: "REJECT" }).success).toBe(false);

    const parsed = decideApprovalInputSchema.safeParse({
      ...base,
      decision: "REQUEST_CHANGES",
      comment: "  Clarify the CTA.  ",
    });
    expect(parsed.success).toBe(true);
    expect(parsed.success ? parsed.data?.comment : undefined).toBe("Clarify the CTA.");
  });

  it("allows approve without a comment and caps all decision comments at 2000 characters", async () => {
    const { decideApprovalInputSchema } = await loadSchema();
    const base = {
      organizationId: "932a5898-a85f-4ba6-b571-66d6fe8cd9e8",
      requestId: "1a575e22-ebb8-48d5-9167-d3eb26f8462a",
    };

    expect(decideApprovalInputSchema.safeParse({ ...base, decision: "APPROVE" }).success).toBe(true);
    expect(
      decideApprovalInputSchema.safeParse({ ...base, decision: "APPROVE", comment: "x".repeat(2_001) }).success,
    ).toBe(false);
  });
});
