import { describe, expect, it } from "vitest";

import { buildDashboardOrganizationSummary, resolveDashboardNextAction } from "./service";

const organizationId = "11111111-1111-4111-8111-111111111111";
const projectId = "22222222-2222-4222-8222-222222222222";

const readyInput = {
  profileRevision: 3,
  brandKitRevision: 2,
  knowledgeDrafts: 0,
  generatedContent: 4,
  projects: 2,
  plansNeedingWork: 0,
  activeGeneration: 0,
  assemblyActive: 0,
  completedAssemblies: 0,
};

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

describe("resolveDashboardNextAction", () => {
  it("prioritizes incomplete institutional identity before all downstream work", () => {
    expect(resolveDashboardNextAction({
      ...readyInput,
      profileRevision: null,
      knowledgeDrafts: 4,
      generatedContent: 12,
      projects: 5,
      plansNeedingWork: 2,
      activeGeneration: 1,
      assemblyActive: 1,
      completedAssemblies: 3,
      actionableProjectId: projectId,
    })).toMatchObject({ href: "/settings", label: "Complete institutional setup" });
    expect(resolveDashboardNextAction({ ...readyInput, brandKitRevision: null }).href).toBe("/settings");
  });

  it("sends draft Knowledge to review before content or production work", () => {
    expect(resolveDashboardNextAction({ ...readyInput, knowledgeDrafts: 2 })).toMatchObject({
      label: "Review Knowledge drafts",
      href: "/knowledge-base",
    });
  });

  it("routes an empty generated-content state to Content Studio", () => {
    expect(resolveDashboardNextAction({ ...readyInput, generatedContent: 0 })).toMatchObject({
      label: "Create content",
      href: "/content-studio",
    });
  });

  it("routes generated content without a project to the Scene Planning handoff in Content Studio", () => {
    expect(resolveDashboardNextAction({ ...readyInput, projects: 0 })).toMatchObject({
      label: "Create a Scene Plan",
      href: "/content-studio",
    });
  });

  it("uses the DB-derived actionable project for unfinished plans, generation, and assembly", () => {
    const href = `/scene-planning?project=${projectId}`;
    expect(resolveDashboardNextAction({ ...readyInput, plansNeedingWork: 1, activeGeneration: 3, assemblyActive: 1, actionableProjectId: projectId })).toMatchObject({
      label: "Continue Scene Planning",
      href,
    });
    expect(resolveDashboardNextAction({ ...readyInput, activeGeneration: 3, assemblyActive: 1, actionableProjectId: projectId })).toMatchObject({
      label: "Review generation progress",
      href,
    });
    expect(resolveDashboardNextAction({ ...readyInput, assemblyActive: 1, actionableProjectId: projectId })).toMatchObject({
      label: "Continue final assembly",
      href,
    });
  });

  it("falls back to generic Scene Planning when no actionable project identifier is available", () => {
    expect(resolveDashboardNextAction({ ...readyInput, plansNeedingWork: 1 })).toMatchObject({
      href: "/scene-planning",
    });
  });

  it("routes completed assemblies to Media Library and otherwise falls back without guessing an entity id", () => {
    expect(resolveDashboardNextAction({ ...readyInput, completedAssemblies: 2 })).toMatchObject({
      label: "Open completed media",
      href: "/media-library",
    });
    expect(resolveDashboardNextAction(readyInput)).toEqual({
      label: "Create or continue content",
      href: "/content-studio",
      reason: "Production prerequisites are ready. Continue with an implemented workflow.",
    });
  });
});
