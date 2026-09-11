import { describe, expect, it } from "vitest";

import { buildDashboardOrganizationSummary } from "./service";

const organizationId = "11111111-1111-4111-8111-111111111111";

describe("dashboard summary service", () => {
  it("maps only implemented-domain operational facts", () => {
    const summary = buildDashboardOrganizationSummary({
      organizationId,
      organizationName: "Polish Railway Academy",
      role: "OWNER",
      generatedContentCount: 8,
      failedContentCount: 2,
      activeKnowledgeCount: 5,
      draftKnowledgeCount: 3,
      openAiStatus: "CONFIGURED",
      lastContentUpdatedAt: "2026-09-10T15:13:38.808Z",
    });

    expect(summary).toEqual({
      organizationId,
      organizationName: "Polish Railway Academy",
      role: "OWNER",
      generatedContentCount: 8,
      failedContentCount: 2,
      activeKnowledgeCount: 5,
      draftKnowledgeCount: 3,
      openAiStatus: "CONFIGURED",
      lastContentUpdatedAt: "2026-09-10T15:13:38.808Z",
    });

    expect(summary).not.toHaveProperty("approvalCount");
    expect(summary).not.toHaveProperty("publishingCount");
    expect(summary).not.toHaveProperty("analyticsCount");
    expect(summary).not.toHaveProperty("sceneCount");
    expect(summary).not.toHaveProperty("videoCount");
    expect(summary).not.toHaveProperty("podcastCount");
    expect(summary).not.toHaveProperty("testimonialCount");
    expect(summary).not.toHaveProperty("calendarCount");
  });

  it("preserves truthful zero values and defaults missing OpenAI metadata", () => {
    expect(
      buildDashboardOrganizationSummary({
        organizationId,
        organizationName: "Polish Railway Academy",
        role: "EDITOR",
        generatedContentCount: 0,
        failedContentCount: 0,
        activeKnowledgeCount: 0,
        draftKnowledgeCount: 0,
      }),
    ).toEqual({
      organizationId,
      organizationName: "Polish Railway Academy",
      role: "EDITOR",
      generatedContentCount: 0,
      failedContentCount: 0,
      activeKnowledgeCount: 0,
      draftKnowledgeCount: 0,
      openAiStatus: "NOT_CONFIGURED",
    });
  });
});
