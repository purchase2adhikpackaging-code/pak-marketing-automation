import { describe, expect, it, vi } from "vitest";

import type { OrganizationBrandKit } from "@/modules/brand-kit/types";
import type { OrganizationProfile } from "@/modules/organization-profile/types";
import { GenerationContextRepository, type GenerationContextPersistence } from "./repository";

const organizationId = "11111111-1111-4111-8111-111111111111";
const selectedId = "22222222-2222-4222-8222-222222222222";

const profile: OrganizationProfile = {
  organizationId,
  officialName: "Polish Railway Academy",
  socialLinks: {},
  defaultLanguage: "en",
  timezone: "Europe/Warsaw",
  legalIdentifiers: {},
  revision: 1,
  createdAt: "2026-09-12T00:00:00.000Z",
  updatedAt: "2026-09-12T00:00:00.000Z",
};

const brandKit: OrganizationBrandKit = {
  organizationId,
  approvedImageryAssetIds: [],
  revision: 1,
  createdAt: "2026-09-12T00:00:00.000Z",
  updatedAt: "2026-09-12T00:00:00.000Z",
};

describe("GenerationContextRepository", () => {
  it("keeps every read explicitly organization-scoped", async () => {
    const persistence: GenerationContextPersistence = {
      getProfile: vi.fn().mockResolvedValue(profile),
      getBrandKit: vi.fn().mockResolvedValue(brandKit),
      listCoreKnowledge: vi.fn().mockResolvedValue([]),
      getKnowledgeByIds: vi.fn().mockResolvedValue([]),
    };
    const repository = new GenerationContextRepository(persistence);

    await repository.getProfile(organizationId);
    await repository.getBrandKit(organizationId);
    await repository.listCoreKnowledge(organizationId);
    await repository.getKnowledgeByIds(organizationId, [selectedId]);

    expect(persistence.getProfile).toHaveBeenCalledWith(organizationId);
    expect(persistence.getBrandKit).toHaveBeenCalledWith(organizationId);
    expect(persistence.listCoreKnowledge).toHaveBeenCalledWith(organizationId);
    expect(persistence.getKnowledgeByIds).toHaveBeenCalledWith(organizationId, [selectedId]);
  });

  it("does not issue a selected-Knowledge query when there are no IDs", async () => {
    const persistence: GenerationContextPersistence = {
      getProfile: vi.fn(),
      getBrandKit: vi.fn(),
      listCoreKnowledge: vi.fn(),
      getKnowledgeByIds: vi.fn(),
    };
    const repository = new GenerationContextRepository(persistence);

    expect(await repository.getKnowledgeByIds(organizationId, [])).toEqual([]);
    expect(persistence.getKnowledgeByIds).not.toHaveBeenCalled();
  });
});
