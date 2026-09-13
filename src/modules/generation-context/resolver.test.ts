import { describe, expect, it, vi } from "vitest";

import type { OrganizationBrandKit } from "@/modules/brand-kit/types";
import type { GenerationContextKnowledgeRecord } from "./types";
import type { OrganizationProfile } from "@/modules/organization-profile/types";
import { resolveOrganizationGenerationContext, type GenerationContextRepositoryPort } from "./resolver";

const organizationId = "11111111-1111-4111-8111-111111111111";
const otherOrganizationId = "99999999-9999-4999-8999-999999999999";
const coreA = "22222222-2222-4222-8222-222222222222";
const coreB = "33333333-3333-4333-8333-333333333333";
const selectedA = "44444444-4444-4444-8444-444444444444";
const selectedB = "55555555-5555-4555-8555-555555555555";

const profile: OrganizationProfile = {
  organizationId,
  officialName: "Polish Railway Academy",
  shortName: "PAK",
  about: "Official railway education and training institution.",
  socialLinks: {},
  defaultLanguage: "en",
  timezone: "Europe/Warsaw",
  legalIdentifiers: {},
  revision: 7,
  createdAt: "2026-09-12T00:00:00.000Z",
  updatedAt: "2026-09-13T00:00:00.000Z",
};

const brandKit: OrganizationBrandKit = {
  organizationId,
  primaryColor: "#102A43",
  secondaryColor: "#FFFFFF",
  brandVoice: "Authoritative, precise and institutional.",
  primaryLogoAssetId: "66666666-6666-4666-8666-666666666666",
  approvedImageryAssetIds: ["77777777-7777-4777-8777-777777777777"],
  revision: 5,
  createdAt: "2026-09-12T00:00:00.000Z",
  updatedAt: "2026-09-13T00:00:00.000Z",
};

function knowledge(input: {
  id: string;
  title: string;
  content?: string;
  isCore?: boolean;
  status?: "DRAFT" | "ACTIVE" | "ARCHIVED";
  organization?: string;
  createdAt?: string;
  revision?: number;
}): GenerationContextKnowledgeRecord {
  return {
    id: input.id,
    organizationId: input.organization ?? organizationId,
    title: input.title,
    content: input.content ?? `${input.title} content`,
    status: input.status ?? "ACTIVE",
    sourceType: "MANUAL",
    isCore: input.isCore ?? false,
    revision: input.revision ?? 1,
    createdAt: input.createdAt ?? "2026-09-13T00:00:00.000Z",
    updatedAt: "2026-09-13T00:00:00.000Z",
  };
}

function repository(overrides: Partial<GenerationContextRepositoryPort> = {}): GenerationContextRepositoryPort {
  return {
    getProfile: vi.fn().mockResolvedValue(profile),
    getBrandKit: vi.fn().mockResolvedValue(brandKit),
    listCoreKnowledge: vi.fn().mockResolvedValue([]),
    getKnowledgeByIds: vi.fn().mockResolvedValue([]),
    ...overrides,
  };
}

describe("resolveOrganizationGenerationContext", () => {
  it("automatically resolves profile, Brand Kit, deterministic Core Knowledge and first-requested selected Knowledge with immutable provenance", async () => {
    const coreLater = knowledge({ id: coreB, title: "Core B", isCore: true, createdAt: "2026-09-13T00:00:00.000Z", revision: 3 });
    const coreEarlier = knowledge({ id: coreA, title: "Core A", isCore: true, createdAt: "2026-09-12T00:00:00.000Z", revision: 2 });
    const explicitB = knowledge({ id: selectedB, title: "Selected B", revision: 9 });
    const explicitA = knowledge({ id: selectedA, title: "Selected A", revision: 4 });
    const repo = repository({
      listCoreKnowledge: vi.fn().mockResolvedValue([coreLater, coreEarlier]),
      getKnowledgeByIds: vi.fn().mockResolvedValue([explicitA, coreEarlier, explicitB]),
    });

    const result = await resolveOrganizationGenerationContext({
      organizationId,
      selectedKnowledgeRecordIds: [selectedB, coreA, selectedA, selectedB],
      additionalContext: "  Focus on current admissions.  ",
    }, repo);

    expect(repo.getProfile).toHaveBeenCalledWith(organizationId);
    expect(repo.getBrandKit).toHaveBeenCalledWith(organizationId);
    expect(repo.listCoreKnowledge).toHaveBeenCalledWith(organizationId);
    expect(repo.getKnowledgeByIds).toHaveBeenCalledWith(organizationId, [selectedB, coreA, selectedA]);
    expect(result.profile).toEqual(profile);
    expect(result.brandKit).toEqual(brandKit);
    expect(result.coreKnowledge.map((record) => record.id)).toEqual([coreA, coreB]);
    expect(result.selectedKnowledge.map((record) => record.id)).toEqual([selectedB, selectedA]);
    expect(result.additionalContext).toBe("Focus on current admissions.");
    expect(result.provenance).toEqual({
      profileRevision: 7,
      brandKitRevision: 5,
      knowledge: [
        { id: coreA, revision: 2, isCore: true },
        { id: coreB, revision: 3, isCore: true },
        { id: selectedB, revision: 9, isCore: false },
        { id: selectedA, revision: 4, isCore: false },
      ],
    });
    expect(result.knowledgeContext).toContain("[Core Knowledge: Core A]");
    expect(result.knowledgeContext).toContain("[Selected Knowledge: Selected B]");
    expect(result.knowledgeContext).toContain("[Additional task context]");
  });

  it("rejects missing/cross-organization selected IDs instead of allowing untrusted grounding", async () => {
    const crossOrg = knowledge({ id: selectedA, title: "Wrong tenant", organization: otherOrganizationId });
    const repo = repository({
      getKnowledgeByIds: vi.fn().mockResolvedValue([crossOrg]),
    });

    await expect(resolveOrganizationGenerationContext({
      organizationId,
      selectedKnowledgeRecordIds: [selectedA],
    }, repo)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("rejects non-ACTIVE selected Knowledge and malformed Core rows defensively", async () => {
    const draft = knowledge({ id: selectedA, title: "Draft", status: "DRAFT" });
    await expect(resolveOrganizationGenerationContext({
      organizationId,
      selectedKnowledgeRecordIds: [selectedA],
    }, repository({ getKnowledgeByIds: vi.fn().mockResolvedValue([draft]) }))).rejects.toMatchObject({ code: "CONFLICT" });

    const malformedCore = knowledge({ id: coreA, title: "Not core", isCore: false });
    await expect(resolveOrganizationGenerationContext({ organizationId }, repository({
      listCoreKnowledge: vi.fn().mockResolvedValue([malformedCore]),
    }))).rejects.toMatchObject({ code: "INTERNAL_ERROR" });
  });

  it("fails closed when the combined Knowledge plus task context exceeds the existing 12k grounding budget", async () => {
    const largeCore = knowledge({ id: coreA, title: "Large", isCore: true, content: "x".repeat(11950) });
    await expect(resolveOrganizationGenerationContext({
      organizationId,
      additionalContext: "y".repeat(200),
    }, repository({ listCoreKnowledge: vi.fn().mockResolvedValue([largeCore]) }))).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });
});
